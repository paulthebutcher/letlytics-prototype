import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMatch,
  normalizeProfile,
  verifyCertificate,
  sameFlat,
  collectOfficialEvidence,
} from "../scripts/official-evidence-core";
import { leaseYearsRemaining } from "../src/lib/official-types";
import type { LiveProperty } from "../src/lib/live-types";

const at = "2026-10-17T04:00:00Z";
const p = {
  id: "R123",
  address: "Example Building",
  postcode: "M4 1PH",
  propertyType: "Flat",
} as LiveProperty;
const address = "FLAT 304, THE BIRCHIN 1, JOINER STREET, MANCHESTER, M4 1PH";
const resolver = {
  status: "success",
  data: {
    portal: "rightmove",
    listing_id: 123,
    uprn: 10012202449,
    address,
    postcode: "M4 1PH",
  },
};
const match = normalizeMatch(p, resolver, at)!;
const profile = {
  status: "success",
  data: {
    identity: {
      data_status: "found",
      uprn: match.uprn,
      address,
      address_parts: { postcode: "M4 1PH" },
    },
    building: {
      data_status: "found",
      epc_certificate: "1234-1234-1234-1234-1234",
      energy_rating: "C",
    },
    title: {
      data_status: "found",
      registered_leases: [
        {
          term: "125 years from 1 January 2004",
          term_start_date: "2004-01-01",
          term_end_date: "2129-01-01",
          registerPropertyDescription: address,
        },
      ],
    },
    sales: {
      data_status: "found",
      transactions: [
        {
          date: "2006-02-17",
          price: 87000,
          transaction_id: "{6C08037E-E775-4CEA-AE25-D567AD5E7343}",
        },
      ],
    },
  },
};

test("exact-flat resolver rejects wrong listing, postcode, absent flat number and precise-address disagreement", () => {
  assert.equal(match.uprn, "10012202449");
  for (const d of [
    { listing_id: 124 },
    { postcode: "M4 1ED" },
    { address: "THE BIRCHIN 1 JOINER STREET M4 1PH" },
  ])
    assert.equal(
      normalizeMatch(p, { ...resolver, data: { ...resolver.data, ...d } }, at),
      null,
    );
  assert.equal(
    normalizeMatch(
      { ...p, preciseAddress: address.replace("304", "305") },
      resolver,
      at,
    ),
    null,
  );
});
test("flat identity accepts apartment wording but never building-only, wrong unit or different street", () => {
  assert.ok(
    sameFlat(address.replace("FLAT", "Apartment"), address, p.postcode),
  );
  for (const s of [
    address.replace("304", "305"),
    address.replace("FLAT 304, ", ""),
    address.replace("JOINER", "CHURCH"),
  ])
    assert.equal(sameFlat(s, address, p.postcode), false);
});
test("profile imports only exact-flat leases and property sales and does not conflate freehold building ownership", () => {
  const result = normalizeProfile(p, match, profile, at);
  assert.equal(result.status, "matched");
  assert.equal(result.leases.length, 1);
  assert.equal(result.sales[0].price, 87000);
  const wrong = structuredClone(profile);
  wrong.data.title.registered_leases[0].registerPropertyDescription =
    address.replace("304", "305");
  const excluded = normalizeProfile(p, match, wrong, at);
  assert.equal(excluded.leases.length, 0);
  assert.equal(excluded.warnings.length, 1);
  wrong.data.identity.uprn = "999";
  assert.equal(normalizeProfile(p, match, wrong, at).status, "unavailable");
});
test("certificate must match both certificate ID and exact flat; parses official rating, area and dates", () => {
  const e = normalizeProfile(p, match, profile, at);
  const html = `<p class="epc-address govuk-body">Apartment 304 The Birchin<br>1 Joiner Street<br>Manchester<br>M4 1PH</p><p class="epc-rating-result govuk-body">C</p><p>1234-1234-1234-1234-1234</p><p>Total floor area 25 square metres</p><p>Valid until 19 December 2027</p><p>Date of assessment 19 December 2017</p><p>This property’s energy rating is C with a score of 70.</p>`;
  const cert = verifyCertificate(html, e, at)!;
  assert.equal(cert.verification, "official-certificate");
  assert.equal(cert.areaSqM, 25);
  assert.equal(cert.score, 70);
  assert.equal(cert.assessedAt, "2017-12-19");
  assert.equal(cert.validUntil, "2027-12-19");
  assert.equal(
    verifyCertificate(html.replace("Apartment 304", "Apartment 305"), e, at),
    null,
  );
  assert.equal(
    verifyCertificate(
      html.replace("1234-1234-1234-1234-1234", "4321-4321-4321-4321-4321"),
      e,
      at,
    ),
    null,
  );
});
test("remaining lease years are calculated as of evidence retrieval, never taken from a conflicting portal field", () => {
  assert.equal(leaseYearsRemaining("2129-01-01", at), 102);
  assert.equal(leaseYearsRemaining(null, at), null);
});
test("official refresh respects credit reserve and never includes key in query URLs or saved output", async () => {
  const calls: string[] = [];
  const result = await collectOfficialEvidence([p], { records: {} }, "secret", {
    now: () => Date.parse(at),
    sleep: async () => {},
    fetch: (async (input, init) => {
      calls.push(String(input));
      assert.equal(new Headers(init?.headers).get("X-API-Key"), "secret");
      return Response.json({
        status: "success",
        result: { credits_remaining: 79 },
      });
    }) as typeof fetch,
  });
  assert.equal(calls.length, 1);
  assert.equal(result.stats.attempts, 0);
  assert.ok(!calls.join().includes("secret"));
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("unresolved listing is cached without inferring a property; rate limits halt subsequent calls", async () => {
  let time = Date.parse(at);
  let calls = 0;
  const result = await collectOfficialEvidence(
    [p, { ...p, id: "R124" }],
    { records: {} },
    "secret",
    {
      maxCredits: 60,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      fetch: (async () => {
        calls++;
        return calls === 1
          ? Response.json({
              status: "success",
              result: { credits_remaining: 500 },
            })
          : new Response("", { status: 429 });
      }) as typeof fetch,
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.records[p.id].status, "unavailable");
  assert.equal(result.records[p.id].match, null);
  const retry = await collectOfficialEvidence([p], result, "secret", {
    now: () => time,
    sleep: async () => {},
    fetch: (async () =>
      Response.json({
        status: "success",
        result: { credits_remaining: 500 },
      })) as typeof fetch,
  });
  assert.equal(retry.stats.attempts, 0);
});
