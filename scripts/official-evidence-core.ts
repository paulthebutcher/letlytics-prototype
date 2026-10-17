import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { asRecord, numeric } from "../src/lib/propertydata-normalize";
import type { LiveProperty, LiveFeed } from "../src/lib/live-types";
import type {
  OfficialEvidence,
  OfficialStore,
} from "../src/lib/official-types";
import { plainText } from "./listing-extraction";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const pc = (v: unknown) => text(v).toUpperCase().replace(/\s/g, "");
const normalizeAddress = (v: string) =>
  v
    .toUpperCase()
    .replace(/\b(APARTMENT|APT|UNIT)\b/g, "FLAT")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/** A building/postcode match is insufficient. Require the same flat number and every address token. */
export function sameFlat(
  source: string,
  address: string,
  postcode: string,
): boolean {
  const a = normalizeAddress(source),
    b = normalizeAddress(address);
  const unit = (s: string) => s.match(/\bFLAT\s+([0-9]+[A-Z]?)\b/)?.[1];
  if (!unit(a) || unit(a) !== unit(b) || !pc(source).includes(pc(postcode)))
    return false;
  const tokens = new Set(b.split(" "));
  return a.split(" ").every((token) => tokens.has(token));
}
function date(v: unknown): string | null {
  const value = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;
}
export function unresolved(
  p: LiveProperty,
  at: string,
  message: string,
  status: OfficialEvidence["status"] = "unresolved",
): OfficialEvidence {
  return {
    listingId: p.id,
    attemptedAt: at,
    retrievedAt: null,
    status,
    message,
    match: null,
    epc: null,
    leases: [],
    sales: [],
    warnings: [],
  };
}
export function normalizeMatch(
  p: LiveProperty,
  payload: unknown,
  at: string,
): OfficialEvidence["match"] {
  const d = asRecord(asRecord(payload).data),
    uprn = String(d.uprn ?? "");
  if (
    !/^R\d+$/.test(p.id) ||
    asRecord(payload).status !== "success" ||
    d.portal !== "rightmove" ||
    String(d.listing_id) !== p.id.slice(1) ||
    !/^\d{1,12}$/.test(uprn) ||
    pc(d.postcode) !== pc(p.postcode)
  )
    return null;
  const address = text(d.address);
  if (
    !address ||
    (p.propertyType === "Flat" &&
      !/\b(?:FLAT|APARTMENT|UNIT)\s+\d+/i.test(address))
  )
    return null;
  // A supplier-provided precise address is another check, never a substitute for the listing resolver.
  if (
    p.preciseAddress &&
    p.propertyType === "Flat" &&
    !sameFlat(p.preciseAddress, address, p.postcode)
  )
    return null;
  return {
    uprn,
    address,
    postcode: p.postcode,
    sourceUrl: `https://www.rightmove.co.uk/properties/${p.id.slice(1)}`,
    retrievedAt: at,
    method: "listing-address",
  };
}
export function normalizeProfile(
  p: LiveProperty,
  match: NonNullable<OfficialEvidence["match"]>,
  payload: unknown,
  at: string,
): OfficialEvidence {
  const result = unresolved(
    p,
    at,
    "Exact property resolved through PropertyData; official datasets supplied through its property profile.",
  );
  result.match = match;
  const d = asRecord(asRecord(payload).data),
    identity = asRecord(d.identity);
  if (
    asRecord(payload).status !== "success" ||
    identity.data_status !== "found" ||
    String(identity.uprn) !== match.uprn ||
    pc(asRecord(identity.address_parts).postcode) !== pc(p.postcode) ||
    (p.propertyType === "Flat" &&
      !sameFlat(text(identity.address), match.address, p.postcode))
  ) {
    result.status = "unavailable";
    result.message =
      "The property profile could not be confirmed against the resolved address. No profile facts were accepted.";
    return result;
  }
  result.status = "matched";
  result.retrievedAt = at;
  const building = asRecord(d.building),
    certificateId = text(building.epc_certificate);
  if (
    building.data_status === "found" &&
    /^\d{4}(?:-\d{4}){4}$/.test(certificateId)
  ) {
    result.epc = {
      certificateId,
      rating: /^[A-G]$/.test(text(building.energy_rating))
        ? text(building.energy_rating)
        : null,
      score: numeric(building.energy_score),
      areaSqM: null,
      assessedAt: null,
      validUntil: null,
      sourceUrl: `https://find-energy-certificate.service.gov.uk/energy-certificate/${certificateId}`,
      retrievedAt: at,
      verification: "provider-reference",
      excerpt:
        "EPC reference and rating returned by PropertyData; certificate has not yet been independently checked.",
    };
  }
  const title = asRecord(d.title);
  for (const raw of title.data_status === "found" &&
  Array.isArray(title.registered_leases)
    ? title.registered_leases
    : []) {
    const lease = asRecord(raw),
      description = text(lease.registerPropertyDescription);
    if (
      !sameFlat(description, match.address, p.postcode) ||
      !text(lease.term)
    ) {
      result.warnings.push(
        "A registered lease did not match this exact flat and was excluded.",
      );
      continue;
    }
    result.leases.push({
      term: text(lease.term),
      startDate: date(lease.term_start_date),
      endDate: date(lease.term_end_date),
      propertyDescription: description,
      sourceUrl:
        "https://use-land-property-data.service.gov.uk/datasets/leases",
      retrievedAt: at,
    });
  }
  const sales = asRecord(d.sales);
  for (const raw of sales.data_status === "found" &&
  Array.isArray(sales.transactions)
    ? sales.transactions
    : []) {
    const s = asRecord(raw),
      id = text(s.transaction_id).replace(/[{}]/g, ""),
      price = numeric(s.price),
      soldAt = date(s.date);
    if (
      price === null ||
      price <= 0 ||
      !soldAt ||
      soldAt > at.slice(0, 10) ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
    )
      continue;
    result.sales.push({
      price,
      date: soldAt,
      sourceUrl: `https://landregistry.data.gov.uk/data/ppi/transaction/${id.toUpperCase()}/current`,
    });
  }
  result.sales.sort((a, b) => b.date.localeCompare(a.date));
  if (building.data_status === "unavailable")
    result.warnings.push(
      "EPC data was temporarily unavailable from the provider.",
    );
  if (title.data_status === "unavailable")
    result.warnings.push(
      "Registered lease data was temporarily unavailable from the provider.",
    );
  return result;
}
export function verifyCertificate(
  html: string,
  evidence: OfficialEvidence,
  at: string,
): OfficialEvidence["epc"] {
  const epc = evidence.epc,
    match = evidence.match;
  if (!epc || !match) return null;
  const address = plainText(
    html.match(
      /<p[^>]*class="[^"]*epc-address[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1] ?? "",
  );
  const content = plainText(html).replace(/\s+/g, " ");
  if (
    !sameFlat(address, match.address, match.postcode) ||
    !content.includes(epc.certificateId)
  )
    return null;
  const rating = plainText(
    html.match(
      /<p[^>]*class="[^"]*epc-rating-result[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1] ?? "",
  );
  if (!/^[A-G]$/.test(rating)) return null;
  const parseDate = (label: string) => {
    const value = content.match(
      new RegExp(`${label}\\s+(\\d{1,2} [A-Za-z]+ \\d{4})`),
    )?.[1];
    return value && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString().slice(0, 10)
      : null;
  };
  const area = numeric(
    content.match(/Total floor area\s+([\d.]+) square metres/i)?.[1],
  );
  return {
    ...epc,
    rating,
    score: numeric(
      content.match(/energy rating is [A-G] with a score of (\d+)/i)?.[1],
    ),
    areaSqM: area !== null && area > 0 ? area : null,
    assessedAt: parseDate("Date of assessment"),
    validUntil: parseDate("Valid until"),
    verification: "official-certificate",
    retrievedAt: at,
    excerpt: `${address}; EPC ${rating}; ${area ?? "unknown"} square metres.`,
  };
}

type Deps = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxCredits?: number;
  maxAttempts?: number;
  budgetMs?: number;
};
export async function collectOfficialEvidence(
  properties: LiveProperty[],
  previous: OfficialStore,
  apiKey: string,
  deps: Deps = {},
) {
  const fetchData = deps.fetch ?? fetch,
    now = deps.now ?? Date.now,
    sleep =
      deps.sleep ??
      ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const records = { ...previous.records },
    deadline = now() + Math.min(deps.budgetMs ?? 180000, 180000);
  let remaining = deps.maxCredits ?? 30,
    attempts = 0,
    reserved = 0,
    halted = false,
    lastCall = -Infinity;
  const call = async (endpoint: string, params: Record<string, string>) => {
    const wait = Math.max(0, 3100 - (now() - lastCall));
    if (now() + wait >= deadline) throw new Error("Budget reached");
    await sleep(wait);
    lastCall = now();
    const r = await fetchData(
      `https://api.propertydata.co.uk/${endpoint}?${new URLSearchParams(params)}`,
      {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(25000, deadline - now())),
        ),
      },
    );
    if ([401, 403, 429].includes(r.status)) {
      halted = true;
      throw new Error("Provider unavailable");
    }
    const body = asRecord(await r.json());
    if (["X04", "X13", "X14"].includes(String(body.code))) halted = true;
    return body;
  };
  if (!apiKey)
    return {
      records: previous.records,
      stats: { attempts, reservedCredits: reserved },
    };
  // Never exhaust the account during a daily background job; leave 50 credits for normal collection.
  try {
    const account = await call("account/credits", {});
    const available = numeric(asRecord(account.result).credits_remaining);
    if (available === null) remaining = 0;
    else remaining = Math.min(remaining, Math.max(0, available - 50));
  } catch {
    remaining = 0;
  }
  // Missing records first, then older cached failures/successes. Cache matching by listing ID.
  const candidates = [...properties].sort(
    (a, b) =>
      Number(Boolean(records[a.id])) - Number(Boolean(records[b.id])) ||
      (records[a.id]?.attemptedAt ?? "").localeCompare(
        records[b.id]?.attemptedAt ?? "",
      ),
  );
  for (const p of candidates) {
    if (!/^R\d+$/.test(p.id)) continue;
    const prior = records[p.id],
      age = prior
        ? now() -
          Date.parse(
            prior.status === "matched"
              ? (prior.retrievedAt ?? prior.attemptedAt)
              : prior.attemptedAt,
          )
        : Infinity;
    if (
      prior &&
      (!prior.match || pc(prior.match.postcode) === pc(p.postcode)) &&
      age >= 0 &&
      age < (prior.status === "matched" ? 30 : 7) * 86400000
    )
      continue;
    if (
      remaining < 30 ||
      halted ||
      attempts >= (deps.maxAttempts ?? 10) ||
      now() >= deadline
    )
      break;
    attempts++;
    remaining -= 30;
    reserved += 30;
    const at = new Date(now()).toISOString();
    try {
      const payload = await call("listing-address", {
        url: `https://www.rightmove.co.uk/properties/${p.id.slice(1)}`,
      });
      const match = normalizeMatch(p, payload, new Date(now()).toISOString());
      if (!match) {
        records[p.id] = unresolved(
          p,
          at,
          payload.code === "4404"
            ? "The provider could not resolve this listing to an exact flat. Ask the agent for the full address or EPC certificate."
            : "An exact address match was not confirmed. No building-level facts were assigned to this flat.",
          halted ? "unavailable" : "unresolved",
        );
        // Documented no-match error is free. Other failures reserve the budget conservatively.
        if (payload.code === "4404") {
          remaining += 30;
          reserved -= 30;
        }
        continue;
      }
      const profile = await call("property", { uprn: match.uprn });
      const result = normalizeProfile(
        p,
        match,
        profile,
        new Date(now()).toISOString(),
      );
      if (result.status === "unavailable" && prior?.retrievedAt) {
        records[p.id] = {
          ...prior,
          attemptedAt: at,
          message:
            "Profile recheck unavailable; previous evidence and its original dates retained.",
        };
      } else {
        await checkOfficialCertificate(result, fetchData, now);
        records[p.id] = result;
      }
    } catch {
      records[p.id] = prior?.retrievedAt
        ? {
            ...prior,
            attemptedAt: at,
            message:
              "Recheck unavailable; previous evidence and its original dates retained.",
          }
        : unresolved(
            p,
            at,
            "The exact-property check could not complete. No official facts were inferred.",
            "unavailable",
          );
    }
  }
  return { records, stats: { attempts, reservedCredits: reserved } };
}
export async function checkOfficialCertificate(
  result: OfficialEvidence,
  fetchData = fetch,
  now = Date.now,
) {
  if (!result.epc) return;
  try {
    const r = await fetchData(result.epc.sourceUrl, {
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
    if (!r.ok) throw new Error("Unavailable");
    const html = await r.text();
    if (html.length > 1500000) throw new Error("Too large");
    const verified = verifyCertificate(
      html,
      result,
      new Date(now()).toISOString(),
    );
    if (verified) result.epc = verified;
    else
      result.warnings.push(
        "The certificate page did not match the exact flat; its details were not imported.",
      );
  } catch {
    result.warnings.push(
      "The official EPC page could not be checked; the supplier's certificate reference is shown separately.",
    );
  }
}
export async function refreshOfficialFile(
  directory: string,
  apiKey: string,
  deps: Deps = {},
) {
  const feed = JSON.parse(
    await readFile(join(directory, "live-snapshot.json"), "utf8"),
  ) as LiveFeed;
  const path = join(directory, "official-evidence.json");
  let previous: OfficialStore = { records: {} };
  try {
    previous = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const result = await collectOfficialEvidence(
    feed.properties,
    previous,
    apiKey,
    deps,
  );
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(
    temp,
    JSON.stringify({ records: result.records }, null, 2) + "\n",
  );
  await rename(temp, path);
  return result.stats;
}
