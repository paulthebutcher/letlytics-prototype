import test from "node:test";
import assert from "node:assert/strict";
import {
  listingLink,
  listingImage,
  normalizeListings,
  normalizeRent,
} from "../src/lib/propertydata-normalize";
import { liveFinancials } from "../src/lib/live-financials";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/scoring";

const date = "2026-10-16T12:00:00Z";
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
  params: { key: "never-publish" },
  image_url: "https://thirdparty.test/photo.jpg",
};
const rent = {
  data: {
    long_let: {
      unit: "gbp_per_week",
      average: 300,
      points_analysed: 15,
      radius: "0.4",
      "80pc_range": [240, 360],
      raw_data: [
        {
          address: "Nearby Road",
          price: 300,
          bedrooms: 2,
          type: "flat",
          url: "https://propertydata.co.uk/outbound/rightmove/321",
        },
      ],
    },
  },
};

test("listing whitelist keeps facts and image URLs, preserves unknowns and strips provider envelopes", () => {
  const result = normalizeListings(
    {
      params: { key: "secret" },
      properties: [
        listing,
        listing,
        { ...listing, id: "R124", price: 0 },
        { ...listing, id: "R125", sstc: 1 },
        { ...listing, id: "R126", lat: 100 },
      ],
    },
    date,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].annualServiceCharge, null);
  assert.equal(result[0].epcRating, null);
  assert.equal(result[0].rent, null);
  assert.ok(!JSON.stringify(result).includes("key"));
  assert.equal(result[0].imageUrl, listing.image_url);
});
test("listing links permit only provider HTTPS outbound links", () => {
  assert.equal(listingLink("javascript:alert(1)"), null);
  assert.equal(
    listingLink("https://propertydata.co.uk.evil.test/outbound/a"),
    null,
  );
  assert.equal(listingLink("https://propertydata.co.uk/settings"), null);
  assert.equal(listingLink(listing.url), listing.url);
});
test("weekly rent and advertised range convert using 52 weeks / 12 months", () => {
  const result = normalizeRent(rent, "M2 1HN", date)!;
  assert.equal(result.monthlyEstimate, 1300);
  assert.equal(result.monthlyLow, 1040);
  assert.equal(result.monthlyHigh, 1560);
  assert.equal(result.comparables[0].monthlyRent, 1300);
  assert.equal(result.sampleSize, 15);
  assert.equal(result.searchPostcode, "M2 1HN");
});
test("unknown units, weak and distant rental samples do not become estimates", () => {
  const d = rent.data.long_let;
  assert.equal(
    normalizeRent(
      { data: { long_let: { ...d, unit: "gbp_per_month" } } },
      "M2 1HN",
      date,
    ),
    null,
  );
  assert.equal(
    normalizeRent({ data: { long_let: { ...d, radius: 25 } } }, "M2 1HN", date),
    null,
  );
  assert.equal(
    normalizeRent(
      { data: { long_let: { ...d, points_analysed: 3 } } },
      "M2 1HN",
      date,
    ),
    null,
  );
});
test("missing rent yields no invented cash flow; explicit user inputs unlock a scenario", () => {
  const p = normalizeListings({ properties: [listing] }, date)[0];
  assert.equal(liveFinancials(p, DEFAULT_ASSUMPTIONS).financials, null);
  const draft = liveFinancials(p, DEFAULT_ASSUMPTIONS, { monthlyRent: 1200 });
  assert.deepEqual(draft.missingCosts, [
    "Service / estate charges",
    "Ground rent",
  ]);
  assert.equal(draft.hasUserRent, true);
  const checked = liveFinancials(p, DEFAULT_ASSUMPTIONS, {
    monthlyRent: 1200,
    annualServiceCharge: 1200,
  });
  assert.deepEqual(checked.missingCosts, ["Ground rent"]);
  assert.equal(
    Math.round(
      draft.financials!.monthlyCashFlow - checked.financials!.monthlyCashFlow,
    ),
    100,
  );
});
test("offer price changes financing and yield without changing the advertised price", () => {
  const p = {
    ...normalizeListings({ properties: [listing] }, date)[0],
    rent: normalizeRent(rent, "M2 1HN", date),
  };
  const asking = liveFinancials(p, DEFAULT_ASSUMPTIONS);
  const offer = liveFinancials(p, DEFAULT_ASSUMPTIONS, {
    purchasePrice: 180000,
  });
  assert.equal(p.price, 200000);
  assert.equal(offer.purchasePrice, 180000);
  assert.ok(offer.financials!.grossYield > asking.financials!.grossYield);
  assert.ok(
    offer.financials!.monthlyMortgage < asking.financials!.monthlyMortgage,
  );
});
test("unconfirmed landlord council tax is visible only when liability is enabled", () => {
  const p = normalizeListings({ properties: [listing] }, date)[0];
  const r = liveFinancials(
    p,
    { ...DEFAULT_ASSUMPTIONS, landlordPaysCouncilTax: true },
    { monthlyRent: 1200, annualServiceCharge: 0 },
  );
  assert.deepEqual(r.missingCosts, ["Ground rent", "Landlord council tax"]);
  const full = liveFinancials(
    p,
    { ...DEFAULT_ASSUMPTIONS, landlordPaysCouncilTax: true },
    { monthlyRent: 1200, annualServiceCharge: 0, annualCouncilTax: 1800 },
  );
  assert.equal(
    Math.round(
      r.financials!.monthlyCashFlow - full.financials!.monthlyCashFlow,
    ),
    150,
  );
});

test("image URLs reject credentials and non-HTTPS schemes", () => {
  assert.equal(listingImage("javascript:alert(1)"), null);
  assert.equal(listingImage("http://images.test/home.jpg"), null);
  assert.equal(
    listingImage("https://user:password@images.test/home.jpg"),
    null,
  );
  assert.equal(
    listingImage("https://images.test/home.jpg?api_key=secret"),
    null,
  );
  assert.equal(listingImage("https://127.0.0.1/home.jpg"), null);
  assert.equal(listingImage(listing.image_url), listing.image_url);
});
