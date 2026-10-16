import assert from "node:assert/strict";
import test from "node:test";
import { getDailyFeed, getDailySales } from "../src/lib/daily-data";

test("reading the daily dataset does not contact either provider or need an API key", () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PROPERTYDATA_API_KEY;
  globalThis.fetch = (() => {
    throw new Error("A page must not fetch upstream data");
  }) as typeof fetch;
  delete process.env.PROPERTYDATA_API_KEY;
  try {
    const feed = getDailyFeed();
    assert.ok(feed.properties.length > 0);
    assert.ok(Number.isFinite(Date.parse(feed.fetchedAt)));
    const first = feed.properties[0];
    const sales = getDailySales({
      postcode: first.postcode,
      propertyType: first.propertyType,
    });
    assert.equal(sales.postcode, first.postcode);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PROPERTYDATA_API_KEY;
    else process.env.PROPERTYDATA_API_KEY = previousKey;
  }
});

test("missing saved sales are unavailable rather than an invented empty market", () => {
  const result = getDailySales({
    postcode: "ZZ1 1ZZ",
    propertyType: "Detached",
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.fetchedAt, null);
  assert.match(result.message!, /daily update/);
});
