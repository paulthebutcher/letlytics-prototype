import { asRecord } from "../src/lib/propertydata-normalize";
import type { LiveProperty } from "../src/lib/live-types";
import type {
  FactKey,
  FactValue,
  ListingFact,
} from "../src/lib/enrichment-types";

export const EXTRACTOR_VERSION = 1;
export function plainText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(?:br\b[^>]*|\/p|\/div|\/li|\/h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:pound|#163);/gi, "£")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
const amount = (s: string) => Number(s.replace(/[,£\s]/g, ""));
export function extractTextFacts(
  text: string,
  sourceUrl: string,
  retrievedAt: string,
  sourceKind: ListingFact["sourceKind"] = "portal",
): ListingFact[] {
  const facts: ListingFact[] = [];
  const add = (key: FactKey, value: FactValue, excerpt: string) => {
    if (
      !facts.some(
        (f) =>
          f.key === key && JSON.stringify(f.value) === JSON.stringify(value),
      )
    )
      facts.push({
        key,
        value,
        sourceUrl,
        retrievedAt,
        excerpt: excerpt.trim().slice(0, 240),
        status: sourceKind === "provider" ? "reported" : "verified",
        sourceKind,
      });
  };
  for (const line of text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    // Conservative: only explicit restrictions, never generic mortgage/auction glossary text.
    if (
      /\b(?:cash buyers? only|restricted to cash buyers? only)\b/i.test(line) &&
      !/not (?:restricted to )?cash buyers? only/i.test(line)
    )
      add("cashOnly", true, line.match(/.{0,25}cash buyers? only.{0,30}/i)![0]);
    if (
      /\b(?:for sale by (?:the )?(?:modern method of )?auction|sold (?:by|via|at) auction|auction sale)\b/i.test(
        line,
      )
    )
      add("auction", true, line.slice(0, 130));
    if (
      /\bstudio (?:apartment|flat)\b/i.test(line) &&
      !/potential|convert|could|not a studio/i.test(line)
    )
      add(
        "studio",
        true,
        line.match(/.{0,20}studio (?:apartment|flat).{0,30}/i)![0],
      );
    const tenure = line.match(
      /(?:^|\btenure\s*[:\-]?\s*)(leasehold|freehold|share of freehold)\b/i,
    );
    if (tenure) add("tenure", tenure[1].toLowerCase(), tenure[0]);
    for (const [key, name] of [
      ["annualServiceCharge", "(?:service|estate) charge"],
      ["annualGroundRent", "ground rent"],
    ] as const) {
      const re = new RegExp(
        `(?:annual |yearly |monthly )?${name}s?\\s*(?:\\((?:yearly|annual|monthly)\\))?\\s*[:\\-–]?\\s*(?:approximately |approx\\.? |circa )?£([\\d,]+(?:\\.\\d{1,2})?)(?:\\s*(?:per (?:annum|year|month)|p\\.?a\\.?|pcm|a year|a month))?`,
        "ig",
      );
      for (const m of line.matchAll(re)) {
        const context = m[0];
        if (
          !/annual|yearly|monthly|per annum|per year|per month|p\.?a\.?\b|pcm|a year|a month/i.test(
            context,
          )
        )
          continue;
        const n =
          amount(m[1]) *
          (/monthly|per month|pcm|a month/i.test(context) ? 12 : 1);
        add(key, Math.round(n * 100) / 100, context);
      }
      const zero = line.match(
        new RegExp(
          `${name}\\s*[:\\-]?\\s*(?:nil|none|£0(?:\\.00)?(?![\\d.,]))`,
          "i",
        ),
      );
      if (zero) add(key, 0, zero[0]);
    }
    const symbolic = line.match(/ground rent\s*[:\-]?\s*peppercorn/i);
    if (symbolic)
      add(
        "groundRentTerms",
        "Peppercorn; monetary amount unconfirmed",
        symbolic[0],
      );
    const lease = line.match(
      /(?:length of lease\s*:\s*|lease\s*[:\-]?\s*)?(\d{2,3}) years?\s+(?:from|commencing|starting)\s+((?:\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+)?(?:19|20)\d{2})/i,
    );
    if (lease) add("lease", `${lease[1]} years from ${lease[2]}`, lease[0]);
    const remaining = line.match(
      /(?:lease(?: length)? remaining|remaining lease(?: length)?)\s*[:\-]?\s*(\d{1,3}) years/i,
    );
    if (remaining)
      add("leaseYearsRemaining", Number(remaining[1]), remaining[0]);
    const epc = line.match(
      /\b(?:EPC|energy performance)(?: rating| grade)?\s*[:\-]?\s*([A-G])\b/i,
    );
    if (epc) add("epc", epc[1].toUpperCase(), epc[0]);
    const rent = line.match(
      /\b(est\.? rental income|estimated rent(?:al income)?|rental estimate|potential rent(?:al income)?|achievable rent|currently (?:let|rented) (?:at|for)|achieved rent|achieving|advertised rent)\s*[:\-]?\s*(?:of |at )?£([\d,]+(?:\.\d{1,2})?)\s*(pcm|per month|pw|per week|per annum|pa)\b/i,
    );
    if (rent)
      add(
        /currently|achieved|achieving/i.test(rent[1])
          ? "achievedRent"
          : /advertised/i.test(rent[1])
            ? "advertisedRent"
            : "agentRent",
        Math.round(
          amount(rent[2]) *
            (/pw|per week/i.test(rent[3])
              ? 52 / 12
              : /annum|pa/i.test(rent[3])
                ? 1 / 12
                : 1) *
            100,
        ) / 100,
        rent[0],
      );
    if (
      /\b(?:ownership|shared ownership|staircas|share of (?:the )?property)/i.test(
        line,
      )
    ) {
      const sentences = line.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences)
        if (
          /(?:\d+%.*(?:ownership|share)|(?:ownership|share).*\d+%|shared ownership|staircas)/i.test(
            sentence,
          )
        )
          add("ownership", sentence.trim().slice(0, 300), sentence);
    }
    const fee = line.match(
      /(?:reservation|auction|buyer(?:'s)?) fee[^\n£%]{0,65}?(\d+(?:\.\d+)?)%[^\n]{0,160}/i,
    );
    if (fee) {
      const min = fee[0].match(/minimum (?:of )?£([\d,]+(?:\.\d{1,2})?)/i);
      add(
        "auctionFee",
        {
          percent: Number(fee[1]),
          minimum: min ? amount(min[1]) : null,
          includesVat: /includ(?:ing|es) VAT|inc\.? VAT/i.test(fee[0]),
        },
        fee[0],
      );
    }
    const pack =
      /buyer information pack/i.test(line) &&
      line.match(/(?:pay|costs?|fee(?: of)?)\s*£([\d,]+(?:\.\d{1,2})?)/i);
    if (pack)
      add(
        "buyerPackFee",
        amount(pack[1]),
        line.match(/.{0,40}£[\d,.]+.{0,60}/)![0],
      );
    const check =
      /anti.money laundering|AML/i.test(line) &&
      line.match(
        /fee of £([\d,]+(?:\.\d{1,2})?)\s*(?:inc(?:luding)?\.? VAT\s*)?per buyer/i,
      );
    if (check) add("buyerCheckFee", amount(check[1]), check[0]);
  }
  return facts;
}

/** Decode JSON embedded in a public document. Never evaluate page scripts. */
function jsonObjectAt(text: string, start: number): unknown {
  const begin = text.indexOf("{", start);
  if (begin < 0) throw new Error("No JSON");
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = begin; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0)
      return JSON.parse(text.slice(begin, i + 1));
  }
  throw new Error("Incomplete JSON");
}
export function rightmoveModel(html: string): Record<string, unknown> | null {
  const start = html.indexOf("window.__PAGE_MODEL =");
  if (start < 0) return null;
  try {
    const outer = asRecord(jsonObjectAt(html, start));
    if (outer.propertyData) return asRecord(outer.propertyData);
    const table = JSON.parse(String(outer.data));
    if (!Array.isArray(table) || table.length > 30000) return null;
    function decode(i: number, ancestors: number[] = []): unknown {
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= table.length ||
        ancestors.includes(i) ||
        ancestors.length > 35
      )
        return null;
      const v = table[i];
      if (Array.isArray(v)) return v.map((n) => decode(n, [...ancestors, i]));
      if (v && typeof v === "object")
        return Object.fromEntries(
          Object.entries(v).map(([k, n]) => [
            k,
            decode(n as number, [...ancestors, i]),
          ]),
        );
      return v;
    }
    return asRecord(asRecord(decode(0)).propertyData);
  } catch {
    return null;
  }
}
export function parsePortal(
  html: string,
  url: string,
  p: LiveProperty,
  at: string,
) {
  if (new URL(url).hostname === "www.onthemarket.com")
    return parseOnTheMarket(html, url, p, at);
  const model = rightmoveModel(html);
  if (!model || String(model.id) !== p.id.replace(/^R/, "")) return null;
  const text = asRecord(model.text),
    prices = asRecord(model.prices),
    tenure = asRecord(model.tenure);
  const description = plainText(String(text.description ?? ""));
  const features = Array.isArray(model.keyFeatures)
    ? model.keyFeatures.filter((x) => typeof x === "string").join("\n")
    : "";
  const facts = extractTextFacts(`${features}\n${description}`, url, at);
  const add = (key: FactKey, value: FactValue, excerpt: string) =>
    facts.push({
      key,
      value,
      excerpt: excerpt.slice(0, 200),
      sourceUrl: url,
      retrievedAt: at,
      status: "verified",
      sourceKind: "portal",
    });
  const price = String(prices.primaryPrice ?? "").match(/^£([\d,]+(?:\.\d+)?)/);
  if (price) add("price", amount(price[1]), price[0]);
  const qualifier = String(prices.displayPriceQualifier ?? "");
  if (qualifier)
    add(
      "priceQualifier",
      /offers over/i.test(qualifier)
        ? "Offers over"
        : /guide price/i.test(qualifier)
          ? "Guide price"
          : qualifier,
      qualifier,
    );
  if (tenure.tenureType)
    add(
      "tenure",
      String(tenure.tenureType).toLowerCase(),
      `Tenure: ${tenure.tenureType}`,
    );
  if (typeof tenure.yearsRemainingOnLease === "number")
    add(
      "leaseYearsRemaining",
      tenure.yearsRemainingOnLease,
      `Portal lease years remaining: ${tenure.yearsRemainingOnLease}`,
    );
  if (String(model.propertySubType).toLowerCase() === "studio")
    add("studio", true, "Property type: Studio");
  if (typeof model.bedrooms === "number")
    add("bedrooms", model.bedrooms, `Portal bedrooms: ${model.bedrooms}`);
  const links = (Array.isArray(model.brochures) ? model.brochures : [])
    .map((x) => String(asRecord(x).url ?? ""))
    .filter((x) => x.startsWith("https://"))
    .slice(0, 3);
  const reference =
    plainText(String(text.disclaimer ?? "")).match(
      /Property reference ([\w-]+)/i,
    )?.[1] ?? null;
  return { facts, links, reference, description };
}
export function findConflicts(p: LiveProperty, facts: ListingFact[]): string[] {
  const warnings: string[] = [];
  const verified = facts.filter((f) => f.status !== "reported");
  for (const key of new Set(verified.map((f) => f.key))) {
    const group = verified.filter((f) => f.key === key);
    if (new Set(group.map((f) => JSON.stringify(f.value))).size > 1) {
      group.forEach((f) => (f.status = "conflicting"));
      warnings.push(
        `Sources disagree on ${key}; verify with the agent before using a default.`,
      );
    }
  }
  if (
    verified.some((f) => f.key === "studio" && f.value === true) &&
    p.bedrooms !== null &&
    p.bedrooms > 0
  )
    warnings.push(
      `Description identifies a studio; provider lists ${p.bedrooms} bedroom(s). Local bedroom-based rent sample is not used by default.`,
    );
  for (const [key, value] of [
    ["price", p.price],
    ["bedrooms", p.bedrooms],
    ["tenure", p.tenure],
    ["annualServiceCharge", p.annualServiceCharge],
    ["epc", p.epcRating],
  ] as const) {
    const f = verified.find((f) => f.key === key);
    if (f && value !== null && f.value !== value)
      warnings.push(
        `Provider ${key}: ${value}; original advert: ${f.value}. Provider value retained.`,
      );
  }
  for (const report of facts.filter((f) => f.status === "reported")) {
    const matched = verified.filter((f) => f.key === report.key);
    if (
      matched.length &&
      !matched.some(
        (f) => JSON.stringify(f.value) === JSON.stringify(report.value),
      )
    )
      warnings.push(
        `Provider reports ${report.key}: ${String(report.value)}; original listing differs. Both sources retained.`,
      );
  }
  const lease = verified.find((f) => f.key === "lease"),
    remaining = verified.find((f) => f.key === "leaseYearsRemaining");
  if (lease && remaining) {
    const m = String(lease.value).match(/(\d+) years from .*?(\d{4})$/);
    if (m) {
      const approximate =
        Number(m[1]) +
        Number(m[2]) -
        new Date(lease.retrievedAt).getUTCFullYear();
      if (Math.abs(approximate - Number(remaining.value)) > 1) {
        remaining.status = "conflicting";
        warnings.push(
          `Lease conflict: description implies about ${approximate} years remaining; portal says ${remaining.value}. Confirm the lease document.`,
        );
      }
    }
  }
  return [...new Set(warnings)];
}

function parseOnTheMarket(
  html: string,
  url: string,
  p: LiveProperty,
  at: string,
) {
  try {
    const raw = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1];
    if (!raw) return null;
    const data = JSON.parse(raw)?.props?.pageProps?.initialReduxState?.property;
    if (!data || String(data.id) !== p.id.replace(/^O/, "")) return null;
    const keyInfo = Array.isArray(data.keyInfo)
      ? data.keyInfo
          .map(
            (v: Record<string, unknown>) =>
              `${v.title}: ${typeof v.value === "string" ? v.value : ""}`,
          )
          .join("\n")
      : "";
    const features = Array.isArray(data.features)
      ? data.features
          .map((v: Record<string, unknown>) => String(v.feature ?? ""))
          .join("\n")
      : "";
    const description = plainText(String(data.description ?? ""));
    const facts = extractTextFacts(
      `${features}\n${description}\n${keyInfo}`,
      url,
      at,
    );
    const add = (key: FactKey, value: FactValue, excerpt: string) =>
      facts.push({
        key,
        value,
        excerpt,
        sourceUrl: url,
        retrievedAt: at,
        status: "verified",
        sourceKind: "portal",
      });
    if (typeof data.priceRaw === "number")
      add("price", data.priceRaw, String(data.price));
    if (data.priceQualifier)
      add(
        "priceQualifier",
        /offers (?:over|in excess)/i.test(data.priceQualifier)
          ? "Offers over"
          : String(data.priceQualifier),
        String(data.priceQualifier),
      );
    if (typeof data.bedrooms === "number")
      add("bedrooms", data.bedrooms, `Portal bedrooms: ${data.bedrooms}`);
    if (/^[A-G]$/.test(data.epc?.rating))
      add("epc", data.epc.rating, `EPC rating: ${data.epc.rating}`);
    const lease = keyInfo.match(/(\d+) yrs left/);
    if (lease) add("leaseYearsRemaining", Number(lease[1]), lease[0]);
    const links = (Array.isArray(data.documents) ? data.documents : [])
      .map((v: Record<string, unknown>) => String(v.url ?? ""))
      .filter((u: string) => u.startsWith("https://"))
      .slice(0, 3);
    const reference =
      plainText(JSON.stringify(data.disclaimers ?? [])).match(
        /Property reference ([\w-]+)/i,
      )?.[1] ?? null;
    return { facts, links, reference, description };
  } catch {
    return null;
  }
}
