import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  asRecord,
  normalizeListings,
  normalizeRent,
  rentalGroup,
} from "../src/lib/propertydata-normalize";
import type {
  LiveFeed,
  LiveProperty,
  RentalEvidence,
} from "../src/lib/live-types";
import {
  emptySalesEvidence,
  normalizeSalesResponse,
  parseSalesQuery,
  salesPeriodStart,
  SALES_TYPE_RESOURCE,
  type SalesEvidence,
  type SalesQuery,
} from "../src/lib/sales-types";

const DAY = 86_400_000;
// Reserve five seconds for staging files before the eight-minute job budget.
const COLLECTION_BUDGET = 8 * 60_000 - 5_000;
const PROPERTYDATA_GAP = 3_000;
const RENT_TYPES = {
  Flat: "flat",
  Terraced: "terraced_house",
  "Semi-detached": "semi-detached_house",
  Detached: "detached_house",
};

export type DailySales = {
  fetchedAt: string;
  records: Record<string, SalesEvidence>;
};
export type RefreshStats = {
  listings: number;
  propertyDataRequests: number;
  rentalGroups: number;
  freshRentProperties: number;
  retainedRentProperties: number;
  salesQueries: number;
  freshSalesGroups: number;
  retainedSalesGroups: number;
  rateLimitedUntil: string | null;
};
export type DailyCollection = {
  feed: LiveFeed;
  sales: DailySales;
  stats: RefreshStats;
};
type Dependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  budgetMs?: number;
  sourcingSnapshot?: { payload: unknown; fetchedAt: string };
};
export class RefreshError extends Error {}
class ProviderError extends RefreshError {
  constructor(
    message: string,
    readonly halt: boolean = false,
  ) {
    super(message);
  }
}

/** Numeric and HTTP-date Retry-After values are both supported; no retry occurs in this job. */
export function retryAfterDate(value: string | null, now: number): string {
  const seconds = value?.trim() ? Number(value) : Number.NaN;
  const date = value ? Date.parse(value) : Number.NaN;
  const until =
    Number.isFinite(seconds) && seconds >= 0
      ? now + seconds * 1000
      : Number.isFinite(date) && date > now
        ? date
        : now + 5 * 60_000;
  return new Date(Math.max(now + 1000, until)).toISOString();
}

export function salesQueryUrl(query: SalesQuery, now: Date): URL {
  const sparql = `
PREFIX ppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX common: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?transaction ?price ?date ?paon ?saon ?street ?postcode ?propertyType ?tenure ?newBuild ?category
WHERE {
  ?address common:postcode ${JSON.stringify(query.postcode)}.
  ?transaction ppi:propertyAddress ?address;
    ppi:pricePaid ?price;
    ppi:transactionDate ?date;
    ppi:propertyType common:${SALES_TYPE_RESOURCE[query.propertyType]};
    ppi:propertyType ?propertyType;
    ppi:newBuild false;
    ppi:newBuild ?newBuild;
    ppi:transactionCategory ?category.
  FILTER (?date >= ${JSON.stringify(salesPeriodStart(now))}^^xsd:date)
  ?address common:postcode ?postcode.
  OPTIONAL { ?address common:paon ?paon. }
  OPTIONAL { ?address common:saon ?saon. }
  OPTIONAL { ?address common:street ?street. }
  OPTIONAL { ?transaction ppi:estateType ?tenure. }
}
ORDER BY DESC(?date) ?transaction
LIMIT 13`;
  const url = new URL("https://landregistry.data.gov.uk/landregistry/query");
  url.searchParams.set("query", sparql);
  url.searchParams.set("output", "json");
  return url;
}

function ageWithin(timestamp: string | null, now: number, maxAge: number) {
  const age = timestamp ? now - Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(age) && age >= 0 && age <= maxAge;
}

/** Collect everything first. Failed sourcing never reaches the file-writing step. */
export async function collectDailyData(
  apiKey: string,
  previousFeed: LiveFeed | null,
  previousSales: DailySales | null,
  deps: Dependencies = {},
): Promise<DailyCollection> {
  if (!apiKey.trim())
    throw new RefreshError(
      "PROPERTYDATA_API_KEY is missing; saved data was kept.",
    );
  const fetchData = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline =
    now() + Math.min(deps.budgetMs ?? COLLECTION_BUDGET, COLLECTION_BUDGET);
  const stats: RefreshStats = {
    listings: 0,
    propertyDataRequests: 0,
    rentalGroups: 0,
    freshRentProperties: 0,
    retainedRentProperties: 0,
    salesQueries: 0,
    freshSalesGroups: 0,
    retainedSalesGroups: 0,
    rateLimitedUntil: null,
  };
  let lastPropertyDataStart = -Infinity;
  let providerHalted = false;
  const hasTime = () => now() < deadline;
  const timeout = (maximum: number) =>
    AbortSignal.timeout(Math.max(1, Math.min(maximum, deadline - now())));

  async function propertyData(
    endpoint: string,
    params: Record<string, string>,
  ) {
    if (providerHalted)
      throw new ProviderError(
        "Rental evidence is unavailable in this daily update.",
        true,
      );
    const wait = Math.max(
      0,
      PROPERTYDATA_GAP - (now() - lastPropertyDataStart),
    );
    if (now() + wait >= deadline)
      throw new ProviderError("The daily update reached its time limit.", true);
    if (wait) await sleep(wait);
    lastPropertyDataStart = now();
    stats.propertyDataRequests++;
    let response: Response;
    try {
      response = await fetchData(
        `https://api.propertydata.co.uk/${endpoint}?${new URLSearchParams(params)}`,
        {
          headers: { "X-API-Key": apiKey.trim(), Accept: "application/json" },
          signal: timeout(endpoint === "sourced-properties" ? 60_000 : 12_000),
        },
      );
    } catch {
      throw new ProviderError(
        "PropertyData did not respond during the daily update.",
      );
    }
    if (response.status === 429) {
      stats.rateLimitedUntil = retryAfterDate(
        response.headers.get("retry-after"),
        now(),
      );
      providerHalted = true;
      await response.body?.cancel().catch(() => {});
      throw new ProviderError(
        "PropertyData paused requests; no further requests were made this run.",
        true,
      );
    }
    let payload: Record<string, unknown>;
    try {
      payload = asRecord(await response.json());
    } catch {
      throw new ProviderError("PropertyData returned an unreadable response.");
    }
    // The API may echo credentials in params. Never log or persist its raw envelope.
    if (!response.ok || payload.status !== "success") {
      const halt =
        response.status === 401 ||
        response.status === 403 ||
        ["X04", "X13", "X14"].includes(String(payload.code));
      if (halt) providerHalted = true;
      throw new ProviderError(
        payload.code === "X08"
          ? "Not enough matching advertised-rent evidence was available."
          : "PropertyData could not complete this daily update.",
        halt,
      );
    }
    return payload;
  }

  let source: unknown;
  try {
    source =
      deps.sourcingSnapshot?.payload ??
      (await propertyData("sourced-properties", {
        location: "53.4808,-2.2426",
        radius: "8",
        results: "500",
        exclude_sstc: "1",
        list: "high-yield-properties,reduced-properties,properties-with-no-chain",
        standardised_type:
          "flat,terraced_house,semi-detached_house,detached_house",
      }));
  } catch (error) {
    throw new RefreshError(
      `${error instanceof RefreshError ? error.message : "Listing refresh failed."} Saved data was kept.`,
    );
  }
  const fetchedAt =
    deps.sourcingSnapshot?.fetchedAt ?? new Date(now()).toISOString();
  const properties = normalizeListings(source, fetchedAt);
  if (!properties.length)
    throw new RefreshError(
      "The listing refresh returned no usable properties; saved data was kept.",
    );
  stats.listings = properties.length;
  const groups = new Map<string, typeof properties>();
  for (const property of properties) {
    const key = rentalGroup(property);
    groups.set(key, [...(groups.get(key) ?? []), property]);
  }
  stats.rentalGroups = groups.size;
  for (const [key, group] of groups) {
    const anchor = group[0];
    let rent: RentalEvidence | null = null;
    let failure =
      "Rental evidence is unavailable in this daily update. Enter your own estimate.";
    const supported = anchor.bedrooms !== null && anchor.bedrooms <= 5;
    if (supported && !providerHalted && hasTime()) {
      try {
        const payload = await propertyData("rents", {
          postcode: anchor.postcode,
          bedrooms: String(anchor.bedrooms),
          type: RENT_TYPES[anchor.propertyType],
          points: "15",
        });
        rent = normalizeRent(
          payload,
          anchor.postcode,
          new Date(now()).toISOString(),
        );
        if (!rent)
          failure =
            "No suitable advertised-rent sample within 3 miles. Enter your own estimate.";
      } catch (error) {
        if (error instanceof ProviderError) {
          failure = error.message;
          if (error.halt) providerHalted = true;
        }
      }
    } else if (!supported) {
      failure =
        "A matching bedroom sample is unavailable. Enter your own rent estimate.";
    }
    if (rent) stats.freshRentProperties += group.length;
    else if (supported) {
      // Only reuse the same cohort and search anchor, retaining the evidence's real date.
      rent =
        previousFeed?.properties.find(
          (property) =>
            rentalGroup(property) === key &&
            property.rent?.searchPostcode === anchor.postcode &&
            ageWithin(property.rent.fetchedAt, now(), 2 * DAY),
        )?.rent ?? null;
      if (rent) stats.retainedRentProperties += group.length;
    }
    for (const property of group) {
      property.rent = rent;
      if (!rent) property.rentError = failure;
    }
  }

  const collectedSales = await collectSalesEvidence(
    properties,
    previousSales,
    deps,
  );
  stats.salesQueries = collectedSales.stats.salesQueries;
  stats.freshSalesGroups = collectedSales.stats.freshSalesGroups;
  stats.retainedSalesGroups = collectedSales.stats.retainedSalesGroups;
  return {
    feed: {
      market: "Manchester",
      fetchedAt,
      properties,
      warnings: [
        "Asking-rent samples are shared by postcode district, bedroom count and property type. Each sample shows its search postcode and radius; it is not a property valuation.",
      ],
      scope: `Up to 500 high-yield, reduced-price or chain-free strategy matches within 8 miles of central Manchester. ${properties.length} returned in this update; not the whole market or a guarantee of letting suitability.`,
      inventory: {
        returned: properties.length,
        requested: 500,
        radiusMiles: 8,
        capped: properties.length >= 500,
      },
    },
    sales: collectedSales.sales,
    stats,
  };
}

/** Sales have their own time budget: rental requests must not starve free recorded-sale evidence. */
export async function collectSalesEvidence(
  properties: LiveProperty[],
  previousSales: DailySales | null,
  deps: Dependencies = {},
) {
  const fetchData = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline =
    now() + Math.min(deps.budgetMs ?? COLLECTION_BUDGET, COLLECTION_BUDGET);
  const timeout = (maximum: number) =>
    AbortSignal.timeout(Math.max(1, Math.min(maximum, deadline - now())));
  const stats = {
    salesQueries: 0,
    freshSalesGroups: 0,
    retainedSalesGroups: 0,
  };
  const records: Record<string, SalesEvidence> = {};
  const salesQueries = new Map<string, SalesQuery>();
  for (const property of properties) {
    const query = parseSalesQuery(property.postcode, property.propertyType);
    if (query)
      salesQueries.set(`${query.postcode}:${query.propertyType}`, query);
  }
  let salesHalted = false;
  let lastSalesEnd = -Infinity;
  for (const [key, query] of salesQueries) {
    const cached = previousSales?.records[key];
    if (
      cached?.policyVersion === 2 &&
      ["ready", "empty"].includes(cached.status) &&
      ageWithin(cached.fetchedAt, now(), 7 * DAY)
    ) {
      records[key] = cached;
      stats.retainedSalesGroups++;
      continue;
    }
    let evidence: SalesEvidence | null = null;
    const wait = Math.max(0, 200 - (now() - lastSalesEnd));
    if (!salesHalted && now() + wait < deadline) {
      if (wait) await sleep(wait);
      stats.salesQueries++;
      try {
        const response = await fetchData(
          salesQueryUrl(query, new Date(now())),
          {
            headers: { Accept: "application/sparql-results+json" },
            signal: timeout(12_000),
          },
        );
        if (response.status === 429) salesHalted = true;
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          throw new Error("Unavailable");
        }
        evidence = normalizeSalesResponse(
          await response.json(),
          query,
          new Date(now()),
        );
        stats.freshSalesGroups++;
      } catch {
        // A missing result is never represented as a successful empty sales cohort.
      } finally {
        lastSalesEnd = now();
      }
    }
    if (!evidence) {
      const prior = previousSales?.records[key];
      if (
        prior &&
        ["ready", "empty"].includes(prior.status) &&
        prior.postcode === query.postcode &&
        prior.propertyType === query.propertyType &&
        ageWithin(prior.fetchedAt, now(), 30 * DAY)
      ) {
        evidence = prior;
        stats.retainedSalesGroups++;
      } else {
        evidence = emptySalesEvidence(
          query,
          "unavailable",
          "Recorded sales were unavailable in the latest daily update.",
          new Date(now()),
        );
      }
    }
    records[key] = evidence;
  }

  return {
    sales: { fetchedAt: new Date(now()).toISOString(), records },
    stats,
  };
}

async function readSaved<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new RefreshError(
      "A saved data file could not be read; files were kept unchanged.",
    );
  }
}

/** Both outputs are staged before either is replaced; each rename is atomic. */
export async function refreshDataFiles(
  dataDirectory: string,
  apiKey: string,
  deps: Dependencies = {},
): Promise<RefreshStats> {
  const feedPath = join(dataDirectory, "live-snapshot.json");
  const salesPath = join(dataDirectory, "daily-sales.json");
  const [previousFeed, previousSales] = await Promise.all([
    readSaved<LiveFeed>(feedPath),
    readSaved<DailySales>(salesPath),
  ]);
  const result = await collectDailyData(
    apiKey,
    previousFeed,
    previousSales,
    deps,
  );
  const token = randomUUID();
  const staged = [
    { path: feedPath, temp: `${feedPath}.${token}.tmp`, data: result.feed },
    { path: salesPath, temp: `${salesPath}.${token}.tmp`, data: result.sales },
  ];
  try {
    for (const file of staged)
      await writeFile(file.temp, `${JSON.stringify(file.data, null, 2)}\n`, {
        flag: "wx",
      });
    for (const file of staged) await rename(file.temp, file.path);
  } finally {
    await Promise.allSettled(
      staged.map((file) => rm(file.temp, { force: true })),
    );
  }
  return result.stats;
}
