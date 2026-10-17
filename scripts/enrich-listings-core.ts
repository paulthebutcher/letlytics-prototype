import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { LiveFeed, LiveProperty } from "../src/lib/live-types";
import type {
  EnrichmentStore,
  ListingEnrichment,
  SourceAttempt,
} from "../src/lib/enrichment-types";
import { asRecord } from "../src/lib/propertydata-normalize";
import {
  EXTRACTOR_VERSION,
  extractTextFacts,
  findConflicts,
  parsePortal,
  plainText,
} from "./listing-extraction";
const DAY = 86400000;
const ALLOWED_HOSTS = new Set([
  "propertydata.co.uk",
  "www.rightmove.co.uk",
  "rightmove.co.uk",
  "www.zoopla.co.uk",
  "www.onthemarket.com",
  "webservices.acquaintcrm.co.uk",
  "www.stevensonwhyte.co.uk",
]);
export function allowedSource(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ALLOWED_HOSTS.has(u.hostname) &&
      ![...u.searchParams.keys()].some((k) => /key|token|secret/i.test(k))
    );
  } catch {
    return false;
  }
}
export function providerSignature(p: LiveProperty) {
  return JSON.stringify([
    p.price,
    p.bedrooms,
    p.propertyType,
    p.postcode,
    p.tenure,
    p.annualServiceCharge,
  ]);
}
type Deps = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  force?: boolean;
  budgetMs?: number;
  apiKey?: string;
  onProgress?: (id: string, status: string) => void;
};
class SourceError extends Error {
  constructor(
    readonly outcome: SourceAttempt["outcome"],
    message: string,
    readonly sourceUrl?: string,
    readonly retryAfter?: string,
  ) {
    super(message);
  }
}

/** Single worker (bounded concurrency = 1). Public document reads only; no cookies or challenges. */
export async function enrichListings(
  feed: LiveFeed,
  previous: EnrichmentStore = { records: {} },
  deps: Deps = {},
): Promise<EnrichmentStore> {
  const fetcher = deps.fetch ?? fetch,
    now = deps.now ?? Date.now,
    sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const deadline = now() + Math.min(deps.budgetMs ?? 300000, 300000);
  let providerLast = -Infinity,
    providerHalted = false;
  const records: EnrichmentStore["records"] = {};
  const cooldowns = new Map<string, number>();
  for (const record of Object.values(previous.records))
    for (const attempt of record.attempts) {
      if (attempt.retryAfter && Date.parse(attempt.retryAfter) > now())
        cooldowns.set(
          new URL(attempt.url).hostname,
          Date.parse(attempt.retryAfter),
        );
    }
  const signal = () =>
    AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - now())));
  async function document(url: string): Promise<{ url: string; body: string }> {
    let current = url;
    for (let redirects = 0; redirects < 5; redirects++) {
      if (!allowedSource(current))
        throw new SourceError(
          "unsupported",
          "Source host requires an approved adapter; no request made.",
        );
      const host = new URL(current).hostname;
      const cooldown = cooldowns.get(host);
      if (cooldown && cooldown > now())
        throw new SourceError(
          "blocked",
          "Host paused after a rate limit; no request made.",
          current,
          new Date(cooldown).toISOString(),
        );
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (now() >= deadline)
          throw new SourceError(
            "unavailable",
            "Enrichment job time budget reached.",
          );
        try {
          response = await fetcher(current, {
            redirect: "manual",
            headers: {
              "User-Agent": "LetlyticsPrototype/1.0 (listing evidence)",
              Accept: "text/html,application/xhtml+xml",
            },
            signal: signal(),
          });
        } catch {
          if (attempt === 1)
            throw new SourceError(
              "unavailable",
              "Source timed out or network unavailable.",
            );
        }
        if (response && response.status < 500) break;
        if (response) await response.body?.cancel();
        if (attempt === 0) await sleep(750);
      }
      if (!response)
        throw new SourceError("unavailable", "Source unavailable.");
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location)
          throw new SourceError("unavailable", "Redirect had no location.");
        current = new URL(location, current).href;
        continue;
      }
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const seconds = retry?.trim() ? Number(retry) : NaN;
        const until = Number.isFinite(seconds)
          ? now() + Math.max(1, seconds) * 1000
          : retry && Number.isFinite(Date.parse(retry))
            ? Math.max(now() + 1000, Date.parse(retry))
            : now() + 6 * 3600000;
        cooldowns.set(host, until);
        await response.body?.cancel();
        throw new SourceError(
          "blocked",
          "HTTP 429; host paused for the retry window. No bypass attempted.",
          current,
          new Date(until).toISOString(),
        );
      }
      if ([401, 403].includes(response.status)) {
        await response.body?.cancel();
        throw new SourceError(
          "blocked",
          `HTTP ${response.status}; no access-control bypass or retry attempted.`,
          current,
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new SourceError(
          "unavailable",
          `HTTP ${response.status}.`,
          current,
        );
      }
      if (
        !/text\/html|application\/xhtml/i.test(
          response.headers.get("content-type") ?? "",
        )
      ) {
        await response.body?.cancel();
        throw new SourceError(
          "unsupported",
          "Document format unsupported; no facts inferred.",
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new SourceError("unavailable", "Empty response.");
      let length = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 2500000) {
          await reader.cancel();
          throw new SourceError(
            "unsupported",
            "Document exceeds 2.5 MB limit.",
          );
        }
        chunks.push(chunk.value);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      if (
        /<title>[^<]*(?:access denied|just a moment|captcha|robot check)/i.test(
          body,
        )
      )
        throw new SourceError(
          "blocked",
          "Access challenge; no bypass attempted.",
        );
      if (new URL(current).hostname === "propertydata.co.uk") {
        const forward = body.match(
          /(?:let|const|var) forwardUrl = "(https:\/\/propertydata\.co\.uk\/outbound\/[^" ]+\/forward)"/,
        );
        if (forward) {
          current = forward[1];
          continue;
        }
      }
      return { url: current, body };
    }
    throw new SourceError("unavailable", "Too many redirects.");
  }
  for (const p of feed.properties) {
    const old = previous.records[p.id];
    const oldMatches =
      old?.listingUrl === p.listingUrl && old.version === EXTRACTOR_VERSION;
    // Success cache: 24 hours. Failures cool down for 6 hours. No timestamps are advanced on cache hits.
    const last = old?.status === "ready" ? old.enrichedAt : old?.attemptedAt;
    const age = last ? now() - Date.parse(last) : Infinity;
    if (
      !deps.force &&
      oldMatches &&
      old.providerSignature === providerSignature(p) &&
      age >= 0 &&
      age < (old.status === "ready" ? DAY : DAY / 4)
    ) {
      records[p.id] = old;
      deps.onProgress?.(p.id, "cached");
      continue;
    }
    const attemptedAt = new Date(now()).toISOString();
    const e: ListingEnrichment = {
      version: EXTRACTOR_VERSION,
      providerSignature: providerSignature(p),
      listingUrl: p.listingUrl,
      canonicalUrl: null,
      attemptedAt,
      retrievedAt: null,
      enrichedAt: null,
      status: "unavailable",
      facts: [],
      conflicts: [],
      attempts: [],
      linkedSources: [],
    };
    const recordFailure = (url: string, error: unknown) =>
      e.attempts.push({
        url: error instanceof SourceError ? (error.sourceUrl ?? url) : url,
        attemptedAt: new Date(now()).toISOString(),
        outcome: error instanceof SourceError ? error.outcome : "unavailable",
        ...(error instanceof SourceError && error.retryAfter
          ? { retryAfter: error.retryAfter }
          : {}),
        detail:
          error instanceof SourceError
            ? error.message
            : "Source could not be processed.",
      });
    // Prefer provider detail fields where supplied. The extra endpoint does not supply lease charges;
    // use it for a backfill, not redundantly when the sourcing refresh already retained these fields.
    let provider = p.providerDetails;
    if (!provider && oldMatches) {
      e.facts.push(...old.facts.filter((f) => f.sourceKind === "provider"));
      provider = {};
    }
    if (!provider && deps.apiKey && !providerHalted && now() < deadline) {
      const wait = Math.max(0, 3000 - (now() - providerLast));
      if (wait) await sleep(wait);
      providerLast = now();
      if (now() >= deadline) providerHalted = true;
      try {
        if (providerHalted)
          throw new SourceError(
            "unavailable",
            "Enrichment job time budget reached.",
          );
        const url = `https://api.propertydata.co.uk/sourced-property?property_id=${encodeURIComponent(p.id)}`;
        const r = await fetcher(url, {
          headers: { "X-API-Key": deps.apiKey, Accept: "application/json" },
          signal: signal(),
        });
        if ([401, 403, 429].includes(r.status)) providerHalted = true;
        if (!r.ok) {
          await r.body?.cancel();
          recordFailure(
            "https://propertydata.co.uk/api/documentation/sourced-property",
            new SourceError(
              r.status === 429 ? "blocked" : "unavailable",
              `Provider detail HTTP ${r.status}.`,
            ),
          );
        } else {
          const payload = asRecord(await r.json()),
            v = asRecord(payload.property);
          if (payload.status === "success" && v.id === p.id)
            provider = {
              summary: typeof v.summary === "string" ? v.summary : undefined,
              type: typeof v.type === "string" ? v.type : undefined,
            };
        }
      } catch {
        recordFailure(
          "https://propertydata.co.uk/api/documentation/sourced-property",
          new SourceError("unavailable", "Provider detail unavailable."),
        );
      }
    }
    if (provider?.summary)
      e.facts.push(
        ...extractTextFacts(
          provider.summary,
          p.listingUrl ?? "https://propertydata.co.uk",
          attemptedAt,
          "provider",
        ),
      );
    try {
      if (!p.listingUrl)
        throw new SourceError(
          "unavailable",
          "No original listing URL supplied.",
        );
      const page = await document(p.listingUrl);
      e.canonicalUrl = page.url;
      const parsed = parsePortal(
        page.body,
        page.url,
        p,
        new Date(now()).toISOString(),
      );
      if (!parsed)
        throw new SourceError(
          "unsupported",
          "No supported listing document with a matching listing ID. No page facts accepted.",
        );
      e.facts.push(...parsed.facts);
      e.linkedSources = parsed.links;
      e.retrievedAt = new Date(now()).toISOString();
      e.enrichedAt = e.retrievedAt;
      e.status = "ready";
      e.attempts.push({
        url: page.url,
        attemptedAt: e.retrievedAt,
        outcome: "retrieved",
        detail: "Exact portal listing ID verified against provider ID.",
      });
      // Linked original-agent brochures supplement sparse adverts. A direct link AND reference match
      // are required: a building/address match alone cannot identify an apartment.
      if (
        parsed.facts.filter((f) =>
          ["annualServiceCharge", "annualGroundRent", "lease"].includes(f.key),
        ).length < 2
      ) {
        for (const url of e.linkedSources.slice(0, 1)) {
          try {
            const brochure = await document(url),
              text = plainText(brochure.body);
            const reference = parsed.reference?.split("_")[0];
            if (!reference || !`${brochure.url} ${text}`.includes(reference))
              throw new SourceError(
                "identity-mismatch",
                "Linked source does not confirm the agent listing reference.",
              );
            e.facts.push(
              ...extractTextFacts(
                text,
                brochure.url,
                new Date(now()).toISOString(),
                "brochure",
              ),
            );
            e.attempts.push({
              url: brochure.url,
              attemptedAt: new Date(now()).toISOString(),
              outcome: "retrieved",
              detail: `Direct portal brochure link and agent reference ${reference} matched.`,
            });
          } catch (error) {
            recordFailure(url, error);
          }
        }
      }
    } catch (error) {
      if (error instanceof SourceError && error.sourceUrl)
        e.canonicalUrl = error.sourceUrl;
      recordFailure(
        e.canonicalUrl ?? p.listingUrl ?? "https://propertydata.co.uk",
        error,
      );
      e.status = e.attempts.some((a) => a.outcome === "blocked")
        ? "blocked"
        : "unavailable";
      // An old verified linked original source may be retried even when its portal is now blocked.
      if (oldMatches && old.linkedSources.length) {
        for (const url of old.linkedSources.slice(0, 1)) {
          try {
            await document(url);
            e.attempts.push({
              url,
              attemptedAt: new Date(now()).toISOString(),
              outcome: "identity-mismatch",
              detail:
                "Original source accessible, but current portal identity could not be reverified. No new facts accepted.",
            });
          } catch (err) {
            recordFailure(url, err);
          }
        }
      }
      if (oldMatches && old.retrievedAt) {
        e.facts = structuredClone(old.facts);
        e.canonicalUrl = old.canonicalUrl;
        e.linkedSources = old.linkedSources;
        e.retrievedAt = old.retrievedAt;
        e.enrichedAt = old.enrichedAt;
        e.status = "partial";
      }
    }
    if (e.status === "ready") e.enrichedAt = new Date(now()).toISOString();
    e.conflicts = findConflicts(p, e.facts);
    records[p.id] = e;
    deps.onProgress?.(p.id, e.status);
    if (now() < deadline) await sleep(250);
  }
  return { records };
}
export async function enrichDataFiles(directory: string, deps: Deps = {}) {
  const feed = JSON.parse(
    await readFile(join(directory, "live-snapshot.json"), "utf8"),
  ) as LiveFeed;
  const path = join(directory, "listing-enrichment.json");
  let previous: EnrichmentStore = { records: {} };
  try {
    previous = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const result = await enrichListings(feed, previous, deps);
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
  return result;
}
