import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySalesEvidence,
  normalizeSalesResponse,
  parseSalesQuery,
  salesPeriodStart,
  type SalesQuery,
} from "../src/lib/sales-types";

const now = new Date("2026-10-16T12:00:00.000Z");
const query: SalesQuery = { postcode: "M19 3FP", propertyType: "Terraced" };
const literal = (value: string) => ({ type: "literal", value });
const uri = (value: string) => ({ type: "uri", value });
const common = "http://landregistry.data.gov.uk/def/common/";
const ppi = "http://landregistry.data.gov.uk/def/ppi/";

function row(index = 1, overrides: Record<string, unknown> = {}) {
  return {
    transaction: uri(
      `http://landregistry.data.gov.uk/data/ppi/transaction/44F406B6-8B72-1095-E063-${String(index).padStart(12, "0")}/current`,
    ),
    price: literal("277500"),
    date: literal("2025-10-30"),
    paon: literal("29"),
    street: literal("GUILDFORD ROAD"),
    postcode: literal("M19 3FP"),
    propertyType: uri(`${common}terraced`),
    tenure: uri(`${common}freehold`),
    newBuild: literal("false"),
    category: uri(`${ppi}standardPricePaidTransaction`),
    ...overrides,
  };
}
const payload = (bindings: unknown[]) => ({ results: { bindings } });

test("sales query accepts complete postcodes and only explicit supported property types", () => {
  assert.deepEqual(parseSalesQuery("m193fp", "Terraced"), query);
  assert.deepEqual(parseSalesQuery("M2 1HN", "Flat"), {
    postcode: "M2 1HN",
    propertyType: "Flat",
  });
  assert.equal(parseSalesQuery("M19", "Terraced"), null);
  assert.equal(parseSalesQuery('M19 3FP".} UNION {', "Terraced"), null);
  assert.equal(parseSalesQuery("M19 3FP", "Other"), null);
  assert.equal(parseSalesQuery(null, "Flat"), null);
});

test("recorded sale preserves flat address, known tenure and independent transaction source", () => {
  const evidence = normalizeSalesResponse(
    payload([row(1, { saon: literal("FLAT 2") })]),
    query,
    now,
  );
  assert.equal(evidence.status, "ready");
  assert.equal(evidence.fetchedAt, now.toISOString());
  assert.equal(evidence.periodStart, "2023-10-16");
  assert.equal(evidence.sales[0].address, "FLAT 2, 29, GUILDFORD ROAD");
  assert.equal(evidence.sales[0].tenure, "Freehold");
  assert.equal(evidence.sales[0].price, 277500);
  assert.equal(evidence.sales[0].newBuild, false);
  assert.equal(evidence.sales[0].category, "A");
  assert.match(
    evidence.sales[0].sourceUrl,
    /^https:\/\/landregistry\.data\.gov\.uk\//,
  );
  assert.equal(evidence.medianPrice, null);
});

test("decoder rejects wrong cohorts, invalid values and false source URLs", () => {
  const invalid = [
    row(1, { postcode: literal("M2 1HN") }),
    row(2, { propertyType: uri(`${common}flat-maisonette`) }),
    row(3, { category: uri(`${ppi}unknownTransaction`) }),
    row(4, { newBuild: literal("true") }),
    row(5, { date: literal("2022-01-01") }),
    row(6, { date: literal("2026-10-17") }),
    row(7, { date: literal("2025-02-30") }),
    row(8, { price: literal("NaN") }),
    row(9, { price: literal("0") }),
    row(10, {
      transaction: uri(
        "https://example.com/44F406B6-8B72-1095-E063-000000000010",
      ),
    }),
    row(11, { street: undefined }),
    row(12, { newBuild: undefined }),
  ];
  const evidence = normalizeSalesResponse(payload(invalid), query, now);
  assert.equal(evidence.status, "empty");
  assert.equal(evidence.count, 0);
  assert.equal(evidence.medianPrice, null);
  assert.match(evidence.message ?? "", /does not mean no properties have sold/);
});

test("unknown tenure remains unknown; duplicate IDs do not inflate the sample", () => {
  const item = row(1, { tenure: undefined });
  const evidence = normalizeSalesResponse(payload([item, item]), query, now);
  assert.equal(evidence.sales[0].tenure, null);
  assert.equal(evidence.count, 1);
  assert.equal(evidence.medianPrice, null);
});

test("median is absent for fewer than three sales and calculated from displayed values only", () => {
  const rows = [
    row(1, { price: literal("100000") }),
    row(2, { price: literal("250000") }),
    row(3, { price: literal("900000") }),
    row(4, { price: literal("350000") }),
  ];
  assert.equal(
    normalizeSalesResponse(payload(rows.slice(0, 2)), query, now).medianPrice,
    null,
  );
  assert.equal(
    normalizeSalesResponse(payload(rows.slice(0, 3)), query, now).medianPrice,
    250000,
  );
  assert.equal(
    normalizeSalesResponse(payload(rows), query, now).medianPrice,
    300000,
  );
});

test("results are ordered by recent sale date, capped at twelve and mark truncation", () => {
  const rows = Array.from({ length: 13 }, (_, index) =>
    row(index + 1, {
      date: literal(`2025-10-${String(index + 1).padStart(2, "0")}`),
      price: literal(String((index + 1) * 10000)),
    }),
  );
  const evidence = normalizeSalesResponse(payload(rows), query, now);
  assert.equal(evidence.count, 12);
  assert.equal(evidence.truncated, true);
  assert.equal(evidence.sales[0].date, "2025-10-13");
  assert.equal(evidence.sales.at(-1)?.date, "2025-10-02");
  assert.equal(evidence.medianPrice, 75000);
  assert.match(evidence.scope, /Categories A and B, existing buildings only/);
  assert.match(evidence.caveat, /not a valuation/);
});

test("malformed upstream data is distinguishable from valid empty results", () => {
  assert.throws(() =>
    normalizeSalesResponse({ error: "unavailable" }, query, now),
  );
  assert.equal(normalizeSalesResponse(payload([]), query, now).status, "empty");
  const failure = emptySalesEvidence(
    query,
    "unavailable",
    "Try again later",
    now,
  );
  assert.equal(failure.fetchedAt, null);
  assert.equal(failure.medianPrice, null);
  assert.equal(salesPeriodStart(now), "2023-10-16");
});

test("Category B investor/company transactions are included but excluded from the standard-sale median", () => {
  const evidence = normalizeSalesResponse(
    payload([
      row(1, { price: literal("100000") }),
      row(2, { price: literal("200000") }),
      row(3, { price: literal("300000") }),
      row(4, {
        category: uri(`${ppi}additionalPricePaidTransaction`),
        price: literal("9000000"),
      }),
    ]),
    query,
    now,
  );
  assert.equal(evidence.count, 4);
  assert.equal(evidence.medianPrice, 200000);
  assert.equal(evidence.sales.find((s) => s.price === 9000000)?.category, "B");
});
