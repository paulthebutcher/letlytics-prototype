import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTextFacts,
  findConflicts,
  parsePortal,
} from "../scripts/listing-extraction";
import { enrichListings, allowedSource, providerSignature } from "../scripts/enrich-listings-core";
import { verifiedFact } from "../src/lib/listing-evidence";
import { liveFinancials, auctionFeeAmount } from "../src/lib/live-financials";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/scoring";
import type { LiveProperty, LiveFeed } from "../src/lib/live-types";
import type { ListingEnrichment } from "../src/lib/enrichment-types";
const at = "2026-10-16T12:00:00.000Z";
const url = "https://www.rightmove.co.uk/properties/123";
const p: LiveProperty = {
  id: "R123",
  address: "Example flat",
  postcode: "M4 1PH",
  lat: 53.48,
  lng: -2.24,
  price: 65000,
  bedrooms: 1,
  propertyType: "Flat",
  floorAreaSqFt: null,
  daysOnMarket: null,
  listingUrl: "https://propertydata.co.uk/outbound/rightmove/123",
  summary: "",
  strategies: [],
  fetchedAt: at,
  rent: {
    monthlyEstimate: 1100,
    monthlyLow: 900,
    monthlyHigh: 1300,
    sampleSize: 15,
    radiusMiles: 0.5,
    searchPostcode: "M4 1PH",
    fetchedAt: at,
    comparables: [],
  },
  annualServiceCharge: null,
  annualCouncilTax: null,
  tenure: null,
  epcRating: null,
};
const feed: LiveFeed = {
  market: "Manchester",
  fetchedAt: at,
  properties: [p],
  warnings: [],
  scope: "test",
};
const model = (text: string, id = "123") =>
  `<script>window.__PAGE_MODEL = ${JSON.stringify({ propertyData: { id, text: { description: text }, prices: { primaryPrice: "£65,000", displayPriceQualifier: "Guide Price" }, bedrooms: 1, tenure: { tenureType: "LEASEHOLD" }, keyFeatures: [] } })};</script>`;
function enriched(text: string): LiveProperty {
  const facts = extractTextFacts(text, url, at);
  const e: ListingEnrichment = {
    version: 1,
    providerSignature: providerSignature(p),
    listingUrl: p.listingUrl,
    canonicalUrl: url,
    attemptedAt: at,
    retrievedAt: at,
    enrichedAt: at,
    status: "ready",
    facts,
    conflicts: findConflicts(p, facts),
    attempts: [],
    linkedSources: [],
  };
  return { ...p, enrichment: e };
}
const advert =
  "Studio apartment\nCash buyers only\nFor sale by the Modern Method of Auction\nAnnual service charge: £939.73\nAnnual ground rent: £171.92\nLength of lease: 125 years from 2004\nEst. rental income: £1,000 pcm\nReservation Fee of 4.5% including VAT, subject to a minimum of £6,600 including VAT.\nBuyer Information Pack: buyer will pay £349.00 including VAT.";
test("explicit facts have provenance, fees and estimate type; content is never executed", () => {
  const property = enriched(advert + "\n<script>process.exit()</script>");
  assert.equal(verifiedFact(property, "annualServiceCharge"), 939.73);
  assert.equal(verifiedFact(property, "annualGroundRent"), 171.92);
  assert.equal(verifiedFact(property, "agentRent"), 1000);
  assert.equal(verifiedFact(property, "achievedRent"), null);
  assert.equal(verifiedFact(property, "buyerPackFee"), 349);
  assert.ok(
    property.enrichment!.facts.every(
      (f) =>
        f.sourceUrl === url &&
        f.retrievedAt === at &&
        f.excerpt &&
        f.status === "verified",
    ),
  );
});
test("annual and monthly charges normalize without inferring units or turning unknown into zero", () => {
  const property = enriched(
    "Service charge £100 pcm\nGround rent (yearly) - £200 per annum",
  );
  assert.equal(verifiedFact(property, "annualServiceCharge"), 1200);
  assert.equal(verifiedFact(property, "annualGroundRent"), 200);
  assert.equal(
    verifiedFact(enriched("Service charge £400"), "annualServiceCharge"),
    null,
  );
  assert.equal(
    verifiedFact(enriched("Service charge: £0"), "annualServiceCharge"),
    0,
  );
  assert.equal(
    verifiedFact(enriched("Ground rent: peppercorn"), "annualGroundRent"),
    null,
  );
  assert.equal(
    verifiedFact(enriched("Ground rent: £0.50"), "annualGroundRent"),
    null,
  );
});
test("conflicting costs are retained as evidence and cannot become defaults", () => {
  const property = enriched(
    "Annual service charge: £900\nService charge £100 pcm",
  );
  assert.equal(property.enrichment!.facts.length, 2);
  assert.ok(
    property.enrichment!.facts.every((f) => f.status === "conflicting"),
  );
  assert.equal(verifiedFact(property, "annualServiceCharge"), null);
  assert.ok(
    liveFinancials(property, DEFAULT_ASSUMPTIONS).missingCosts.includes(
      "Service / estate charges",
    ),
  );
});
test("ownership staircasing stays intact and never scales the purchase price", () => {
  const property = enriched(
    "The property is currently 50% ownership and will be sold staircase to 100% ownership.",
  );
  assert.match(verifiedFact<string>(property, "ownership")!, /50%.*100%/);
  assert.equal(
    liveFinancials(property, DEFAULT_ASSUMPTIONS).purchasePrice,
    65000,
  );
});
test("lease disagreement and studio classification are exposed without replacing provider data", () => {
  const property = enriched(advert);
  property.enrichment!.facts.push({
    ...property.enrichment!.facts[0],
    key: "leaseYearsRemaining",
    value: 124,
  });
  const conflicts = findConflicts(property, property.enrichment!.facts);
  assert.ok(conflicts.some((s) => s.includes("Lease conflict")));
  assert.ok(conflicts.some((s) => s.includes("studio")));
  assert.equal(property.bedrooms, 1);
  assert.equal(verifiedFact(property, "leaseYearsRemaining"), null);
  assert.equal(liveFinancials(property, DEFAULT_ASSUMPTIONS).monthlyRent, null);
  assert.equal(
    liveFinancials(property, DEFAULT_ASSUMPTIONS, { rentSource: "agent" })
      .monthlyRent,
    1000,
  );
});
test("percentage fee uses minimum, scales with offer, and excludes unverified VAT/minimum", () => {
  const fee = { percent: 4.5, minimum: 6600, includesVat: true };
  assert.equal(auctionFeeAmount(65000, fee), 6600);
  assert.equal(auctionFeeAmount(200000, fee), 9000);
  assert.equal(auctionFeeAmount(65000, { ...fee, includesVat: false }), null);
  assert.equal(auctionFeeAmount(65000, { ...fee, minimum: null }), null);
});
test("cash-only finance includes recurring costs, fees are within allowance, and overrides survive reset", () => {
  const property = enriched(advert);
  const base = liveFinancials(property, DEFAULT_ASSUMPTIONS, {
    rentSource: "agent",
  });
  assert.equal(base.financials!.loan, 0);
  assert.equal(base.financials!.monthlyMortgage, 0);
  assert.equal(base.financials!.monthlyCashFlow, 647.36);
  assert.equal(base.knownAcquisitionFees, 6949);
  assert.equal(base.initialCash, 77000);
  const low = liveFinancials(
    property,
    { ...DEFAULT_ASSUMPTIONS, buyingCosts: 1000 },
    { rentSource: "agent" },
  );
  assert.equal(low.initialCash, 71949);
  const user = liveFinancials(property, DEFAULT_ASSUMPTIONS, {
    monthlyRent: 1200,
    annualServiceCharge: 0,
    annualGroundRent: 0,
    purchasePrice: 70000,
  });
  assert.equal(user.monthlyRent, 1200);
  assert.equal(user.annualServiceCharge, 0);
  assert.equal(user.purchasePrice, 70000);
  assert.equal(
    liveFinancials(property, DEFAULT_ASSUMPTIONS, {
      rentSource: "agent",
      annualServiceCharge: undefined,
    }).annualServiceCharge,
    939.73,
  );
});
test("rent evidence distinguishes asking, achieved and weekly agent estimates", () => {
  const property = enriched(
    "Estimated rent: £300 per week\nCurrently let at £900 pcm\nAdvertised rent: £1000 pcm",
  );
  assert.equal(verifiedFact(property, "agentRent"), 1300);
  assert.equal(verifiedFact(property, "achievedRent"), 900);
  assert.equal(verifiedFact(property, "advertisedRent"), 1000);
});
test("parser requires exact listing identity and ignores unrelated page scripts", () => {
  assert.equal(parsePortal(model(advert, "999"), url, p, at), null);
  assert.ok(parsePortal(model(advert), url, p, at)?.facts.length);
  assert.equal(allowedSource("https://127.0.0.1/private"), false);
  assert.equal(
    allowedSource("https://www.rightmove.co.uk.evil.test/properties/123"),
    false,
  );
});
test("cache hits perform no fetch and retain success timestamps; failed refresh retains original dates", async () => {
  const old = enriched(advert).enrichment!;
  const cached = await enrichListings(
    feed,
    { records: { R123: old } },
    {
      now: () => Date.parse(at) + 1000,
      fetch: async () => {
        throw Error("must not fetch");
      },
      sleep: async () => {},
    },
  );
  assert.equal(cached.records.R123, old);
  let calls = 0;
  const result = await enrichListings(
    feed,
    { records: { R123: old } },
    {
      force: true,
      now: () => Date.parse(at) + 86400000,
      fetch: async () => {
        calls++;
        return new Response("", { status: 403 });
      },
      sleep: async () => {},
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.records.R123.status, "partial");
  assert.equal(result.records.R123.enrichedAt, at);
  assert.equal(result.records.R123.retrievedAt, at);
  assert.equal(result.records.R123.attempts[0].outcome, "blocked");
});
test("transient failure retries once; outbound forwarding and exact portal identity succeed", async () => {
  let calls = 0;
  const result = await enrichListings(
    feed,
    { records: {} },
    {
      now: () => Date.parse(at),
      sleep: async () => {},
      fetch: async (input) => {
        calls++;
        const u = String(input);
        if (calls === 1) return new Response("", { status: 503 });
        if (u === p.listingUrl)
          return new Response(
            '<script>let forwardUrl = "https://propertydata.co.uk/outbound/rightmove/123/forward";</script>',
            { headers: { "content-type": "text/html" } },
          );
        if (u.endsWith("/forward"))
          return new Response("", { status: 302, headers: { location: url } });
        return new Response(model(advert), {
          headers: { "content-type": "text/html" },
        });
      },
    },
  );
  assert.equal(calls, 4);
  assert.equal(result.records.R123.status, "ready");
  assert.equal(result.records.R123.canonicalUrl, url);
});

test("one 429 halts the entire host and its persisted Retry-After also prevents future requests", async () => {
  let calls = 0;
  const many = {
    ...feed,
    properties: [
      p,
      {
        ...p,
        id: "R456",
        listingUrl: "https://propertydata.co.uk/outbound/rightmove/456",
      },
    ],
  };
  const result = await enrichListings(
    many,
    { records: {} },
    {
      now: () => Date.parse(at),
      sleep: async () => {},
      fetch: async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "retry-after": "7200" },
        });
      },
    },
  );
  assert.equal(calls, 1);
  assert.match(result.records.R456.attempts[0].detail, /no request made/);
  assert.equal(
    result.records.R123.attempts[0].retryAfter,
    "2026-10-16T14:00:00.000Z",
  );
  await enrichListings(many, result, {
    force: true,
    now: () => Date.parse(at) + 1000,
    sleep: async () => {},
    fetch: async () => {
      throw Error("No requests allowed during persisted cooldown");
    },
  });
});

test("deadline stops fetching new properties; invalid URLs cannot redirect to private hosts", async () => {
  let calls = 0;
  const expired = await enrichListings(
    feed,
    { records: {} },
    {
      budgetMs: 0,
      now: () => Date.parse(at),
      sleep: async () => {},
      fetch: async () => {
        calls++;
        throw Error("must not run");
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(expired.records.R123.retrievedAt, null);
  const redirect = await enrichListings(
    feed,
    { records: {} },
    {
      now: () => Date.parse(at),
      sleep: async () => {},
      fetch: async () => {
        calls++;
        return new Response("", {
          status: 302,
          headers: { location: "https://127.0.0.1/private" },
        });
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(redirect.records.R123.status, "unavailable");
  assert.equal(redirect.records.R123.attempts[0].outcome, "unsupported");
});

test("OnTheMarket structured evidence uses only the matching property, not similar listings", () => {
  const prop = {
    id: 123,
    description: "Service charge £100 per month",
    keyInfo: [
      { title: "Ground rent", value: "£200 per annum" },
      { title: "Tenure", value: "Leasehold | 100 yrs left" },
    ],
    priceRaw: 200000,
    price: "£200,000",
    epc: { rating: "C" },
    similarProperties: { description: "Service charge £999 per month" },
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialReduxState: { property: prop } } } })}</script>`;
  const result = parsePortal(
    html,
    "https://www.onthemarket.com/details/123/",
    { ...p, id: "O123" },
    at,
  )!;
  assert.equal(
    result.facts.find((f) => f.key === "annualServiceCharge")?.value,
    1200,
  );
  assert.equal(
    result.facts.find((f) => f.key === "annualGroundRent")?.value,
    200,
  );
  assert.equal(
    parsePortal(
      html,
      "https://www.onthemarket.com/details/123/",
      { ...p, id: "O999" },
      at,
    ),
    null,
  );
});

test("provider value changes invalidate cache and surface conflicts with retained advert evidence", async () => {
  const old = enriched("Annual service charge £1200").enrichment!;
  old.facts.push({
    key: "price",
    value: 65000,
    excerpt: "£65,000",
    sourceUrl: url,
    retrievedAt: at,
    status: "verified",
    sourceKind: "portal",
  });
  let calls = 0;
  const result = await enrichListings(
    { ...feed, properties: [{ ...p, price: 70000 }] },
    { records: { R123: old } },
    {
      now: () => Date.parse(at) + 1000,
      sleep: async () => {},
      fetch: async () => {
        calls++;
        return new Response("", { status: 403 });
      },
    },
  );
  assert.equal(calls, 1);
  assert.ok(
    result.records.R123.conflicts.some((w) =>
      w.includes("Provider price: 70000"),
    ),
  );
  assert.equal(result.records.R123.retrievedAt, at);
});
