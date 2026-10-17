import { readFile, writeFile } from "node:fs/promises";
import type { LiveFeed } from "../src/lib/live-types";
import type { EnrichmentStore } from "../src/lib/enrichment-types";
import { financials, DEFAULT_ASSUMPTIONS } from "../src/lib/scoring";
import { liveFinancials } from "../src/lib/live-financials";
import { verifiedFact } from "../src/lib/listing-evidence";

async function main() {
  const feed = JSON.parse(
    await readFile("src/data/live-snapshot.json", "utf8"),
  ) as LiveFeed;
  const evidence = JSON.parse(
    await readFile("src/data/listing-enrichment.json", "utf8"),
  ) as EnrichmentStore;
  const records = feed.properties.map((provider) => {
    const p = { ...provider, enrichment: evidence.records[provider.id] };
    const before = provider.rent
      ? financials(
          {
            price: provider.price,
            monthlyRent: provider.rent.monthlyEstimate,
            annualServiceCharge: provider.annualServiceCharge ?? 0,
            annualCouncilTax: provider.annualCouncilTax ?? 0,
            area: { vacancyRate: 5 },
          },
          DEFAULT_ASSUMPTIONS,
        )
      : null;
    const after = liveFinancials(p, DEFAULT_ASSUMPTIONS);
    const agent =
      verifiedFact<number>(p, "agentRent") !== null
        ? liveFinancials(p, DEFAULT_ASSUMPTIONS, { rentSource: "agent" })
        : null;
    return {
      id: p.id,
      address: p.address,
      status: p.enrichment?.status,
      providerRetrievedAt: p.fetchedAt,
      sourceRetrievedAt: p.enrichment?.retrievedAt,
      enrichedAt: p.enrichment?.enrichedAt,
      lastAttemptAt: p.enrichment?.attemptedAt,
      source: p.enrichment?.canonicalUrl,
      verifiedFactKeys: [
        ...new Set(
          p.enrichment?.facts
            .filter((f) => f.status === "verified")
            .map((f) => f.key),
        ),
      ],
      conflicts: p.enrichment?.conflicts,
      attempts: p.enrichment?.attempts,
      financials: {
        previousDefault: {
          monthlyRent: provider.rent?.monthlyEstimate ?? null,
          monthlyCashFlow: before?.monthlyCashFlow ?? null,
          grossYield: before?.grossYield ?? null,
          initialCash: before?.initialCash ?? null,
        },
        newDefault: {
          monthlyRent: after.monthlyRent,
          rentSource: after.rentSource,
          monthlyCashFlow: after.financials?.monthlyCashFlow ?? null,
          grossYield: after.financials?.grossYield ?? null,
          initialCash: after.initialCash,
          cashOnly: after.cashOnly,
          annualServiceCharge: after.annualServiceCharge,
          annualGroundRent: after.annualGroundRent,
          knownAcquisitionFees: after.knownAcquisitionFees,
          missingCosts: after.missingCosts,
        },
        optionalAgentScenario: agent
          ? {
              monthlyRent: agent.monthlyRent,
              monthlyCashFlow: agent.financials?.monthlyCashFlow ?? null,
              grossYield: agent.financials?.grossYield ?? null,
              initialCash: agent.initialCash,
            }
          : null,
        defaultCashFlowChanged:
          before?.monthlyCashFlow !== after.financials?.monthlyCashFlow,
      },
    };
  });
  const report = {
    generatedAt: new Date().toISOString(),
    scope:
      "Current 40 saved listings; original listing enrichment only. Provider listing/rent and Land Registry snapshots were not refreshed in this backfill.",
    counts: {
      records: records.length,
      withVerifiedSource: records.filter((r) => r.sourceRetrievedAt).length,
      ready: records.filter((r) => r.status === "ready").length,
      retainedAfterFailedRecheck: records.filter((r) => r.status === "partial")
        .length,
      blockedWithoutEvidence: records.filter((r) => r.status === "blocked")
        .length,
      unavailableWithoutEvidence: records.filter(
        (r) => r.status === "unavailable",
      ).length,
      withConflicts: records.filter((r) => r.conflicts?.length).length,
      changedDefaultCashFlow: records.filter(
        (r) => r.financials.defaultCashFlowChanged,
      ).length,
    },
    records,
  };
  await writeFile(
    "reports/enrichment-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.counts));
  for (const id of ["R164386706", "R164900990", "R88560366", "R171835835"])
    console.log(JSON.stringify(records.find((r) => r.id === id)));
}
main().catch(() => {
  console.error("Report could not be generated.");
  process.exitCode = 1;
});
