import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectDailyData,
  refreshDataFiles,
  retryAfterDate,
  type DailySales,
} from "../scripts/refresh-data-core";
import {
  normalizeListings,
  normalizeRent,
} from "../src/lib/propertydata-normalize";
import type { LiveFeed } from "../src/lib/live-types";
import { normalizeSalesResponse } from "../src/lib/sales-types";

const date = "2026-10-16T12:00:00.000Z";
const start = Date.parse(date);
const secret = "test-secret-never-save";
const listing = {
  id: "R123",
  address: "Example Road",
  postcode: "M2 1HN",
  price: 200000,
  lat: "53.48",
  lng: "-2.24",
  type_standardised: "Flat",
  bedrooms: 2,
  sstc: 0,
  url: "https://propertydata.co.uk/outbound/rightmove/123",
};
const rentPayload = {
  status: "success",
  params: { key: secret },
  data: {
    long_let: {
      unit: "gbp_per_week",
      average: 300,
      points_analysed: 15,
      radius: 0.4,
      "80pc_range": [240, 360],
      raw_data: [],
    },
  },
};
const response = (payload: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(payload), { status, headers });
function clock() {
  let time = start;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
  };
}
function previousFeed(properties = [listing], timestamp = date): LiveFeed {
  return {
    market: "Manchester",
    fetchedAt: timestamp,
    warnings: [],
    scope: "test",
    properties: normalizeListings({ properties }, timestamp).map(
      (property) => ({
        ...property,
        rent: normalizeRent(rentPayload, property.postcode, timestamp),
      }),
    ),
  };
}

test("daily collection spaces PropertyData calls, deduplicates cohorts, and strips provider envelopes", async () => {
  const c = clock();
  const calls: { url: URL; at: number }[] = [];
  const fetchMock = (async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, at: c.now() });
    if (url.hostname === "api.propertydata.co.uk") {
      assert.equal(new Headers(init?.headers).get("X-API-Key"), secret);
      assert.ok(!url.toString().includes(secret));
      if (url.pathname === "/sourced-properties")
        return response({
          status: "success",
          params: { key: secret },
          properties: [
            listing,
            { ...listing, id: "R124" },
            { ...listing, id: "R125", postcode: "M1 1AA", bedrooms: 1 },
          ],
        });
      return response(rentPayload);
    }
    assert.equal(new Headers(init?.headers).get("X-API-Key"), null);
    assert.match(
      url.searchParams.get("query")!,
      /standardPricePaidTransaction/,
    );
    return response({ results: { bindings: [] } });
  }) as typeof fetch;
  const result = await collectDailyData(secret, null, null, {
    ...c,
    fetch: fetchMock,
  });
  const paidCalls = calls.filter(
    ({ url }) => url.hostname === "api.propertydata.co.uk",
  );
  assert.deepEqual(
    paidCalls.map(({ at }) => at - start),
    [0, 3000, 6000],
  );
  assert.equal(result.stats.propertyDataRequests, 3);
  assert.equal(result.stats.rentalGroups, 2);
  assert.equal(result.stats.salesQueries, 2);
  assert.equal(result.feed.properties[0].rent?.monthlyEstimate, 1300);
  assert.equal(
    result.feed.properties[1].rent?.fetchedAt,
    result.feed.properties[0].rent?.fetchedAt,
  );
  assert.equal(result.sales.records["M2 1HN:Flat"].status, "empty");
  assert.ok(!JSON.stringify(result).includes(secret));
});

test("429 stops all subsequent PropertyData calls; only matching rent younger than 48h is retained", async () => {
  const c = clock();
  const current = [
    listing,
    { ...listing, id: "R124", postcode: "M1 1AA" },
    { ...listing, id: "R125", postcode: "M3 1AA" },
  ];
  const previous = previousFeed(current);
  previous.properties[0].rent!.fetchedAt = "2026-10-15T12:00:00.000Z";
  previous.properties[1].rent!.fetchedAt = "2026-10-13T12:00:00.000Z";
  previous.properties[2].rent!.searchPostcode = "M3 2AA";
  let paidCalls = 0;
  const fetchMock = (async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.propertydata.co.uk") {
      paidCalls++;
      if (url.pathname === "/sourced-properties")
        return response({ status: "success", properties: current });
      return response({ params: { key: secret } }, 429, {
        "retry-after": "3600",
      });
    }
    return response({ results: { bindings: [] } });
  }) as typeof fetch;
  const result = await collectDailyData(secret, previous, null, {
    ...c,
    fetch: fetchMock,
  });
  assert.equal(paidCalls, 2);
  assert.equal(result.stats.rateLimitedUntil, "2026-10-16T13:00:03.000Z");
  assert.equal(
    result.feed.properties[0].rent?.fetchedAt,
    "2026-10-15T12:00:00.000Z",
  );
  assert.equal(result.feed.properties[1].rent, null);
  assert.equal(result.feed.properties[2].rent, null);
  assert.equal(result.stats.retainedRentProperties, 1);
});

test("failed sales refresh retains only recent records with their original timestamps", async () => {
  const c = clock();
  const current = [listing, { ...listing, id: "R124", postcode: "M1 1AA" }];
  const recent = normalizeSalesResponse(
    { results: { bindings: [] } },
    { postcode: "M2 1HN", propertyType: "Flat" },
    new Date("2026-10-15T12:00:00Z"),
  );
  const expired = normalizeSalesResponse(
    { results: { bindings: [] } },
    { postcode: "M1 1AA", propertyType: "Flat" },
    new Date("2026-09-01T12:00:00Z"),
  );
  const previous: DailySales = {
    fetchedAt: date,
    records: { "M2 1HN:Flat": recent, "M1 1AA:Flat": expired },
  };
  const fetchMock = (async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/sourced-properties")
      return response({ status: "success", properties: current });
    if (url.pathname === "/rents") return response(rentPayload);
    return response({}, 503);
  }) as typeof fetch;
  const result = await collectDailyData(secret, null, previous, {
    ...c,
    fetch: fetchMock,
  });
  assert.equal(result.sales.records["M2 1HN:Flat"].fetchedAt, recent.fetchedAt);
  assert.equal(result.sales.records["M2 1HN:Flat"].status, "empty");
  assert.equal(result.sales.records["M1 1AA:Flat"].status, "unavailable");
  assert.equal(result.sales.records["M1 1AA:Flat"].fetchedAt, null);
  assert.equal(result.stats.retainedSalesGroups, 1);
});

test("failed or empty sourcing leaves both saved files byte-for-byte unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "letlytics-refresh-"));
  const feedBytes = JSON.stringify(previousFeed());
  const salesBytes = JSON.stringify({ fetchedAt: date, records: {} });
  try {
    await writeFile(join(directory, "live-snapshot.json"), feedBytes);
    await writeFile(join(directory, "daily-sales.json"), salesBytes);
    for (const upstream of [
      response({}, 503),
      response({ status: "success", properties: [] }),
    ]) {
      await assert.rejects(
        refreshDataFiles(directory, secret, {
          ...clock(),
          fetch: (async () => upstream) as typeof fetch,
        }),
        /saved data was kept/i,
      );
      assert.equal(
        await readFile(join(directory, "live-snapshot.json"), "utf8"),
        feedBytes,
      );
      assert.equal(
        await readFile(join(directory, "daily-sales.json"), "utf8"),
        salesBytes,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("collection deadline stops new calls instead of waiting for rate spacing beyond its budget", async () => {
  let paidCalls = 0;
  const result = await collectDailyData(secret, null, null, {
    ...clock(),
    budgetMs: 2000,
    fetch: (async (input) => {
      if (new URL(String(input)).hostname === "api.propertydata.co.uk") {
        paidCalls++;
        return response({ status: "success", properties: [listing] });
      }
      return response({ results: { bindings: [] } });
    }) as typeof fetch,
  });
  assert.equal(paidCalls, 1);
  assert.equal(result.feed.properties[0].rent, null);
});

test("Retry-After HTTP dates are respected without attempting a retry", () => {
  assert.equal(
    retryAfterDate("Fri, 16 Oct 2026 13:00:00 GMT", start),
    "2026-10-16T13:00:00.000Z",
  );
  assert.equal(retryAfterDate(null, start), "2026-10-16T12:05:00.000Z");
});
