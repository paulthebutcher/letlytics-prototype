import { loadEnvConfig } from "@next/env";
import { join } from "node:path";
import { RefreshError, refreshDataFiles } from "./refresh-data-core";

import { enrichDataFiles } from "./enrich-listings-core";
import { refreshOfficialFile } from "./official-evidence-core";

async function main() {
  loadEnvConfig(process.cwd());
  const stats = await refreshDataFiles(
    join(process.cwd(), "src/data"),
    process.env.PROPERTYDATA_API_KEY ?? "",
  );
  const enriched = await enrichDataFiles(join(process.cwd(), "src/data"));
  const official = await refreshOfficialFile(
    join(process.cwd(), "src/data"),
    process.env.PROPERTYDATA_API_KEY ?? "",
  );
  console.log(
    `Exact-property checks: ${official.attempts} attempted; at most ${official.reservedCredits} API credits reserved.`,
  );
  console.log(
    `Enrichment: ${Object.values(enriched.records).filter((e) => e.status === "ready").length} ready of ${stats.listings}.`,
  );
  console.log(
    `Daily data saved: ${stats.listings} listings; rental evidence for ${stats.freshRentProperties} refreshed + ${stats.retainedRentProperties} retained properties; ${stats.freshSalesGroups} sales groups refreshed + ${stats.retainedSalesGroups} retained.`,
  );
  console.log(
    `Requests: ${stats.propertyDataRequests} PropertyData, ${stats.salesQueries} Land Registry.`,
  );
  if (stats.rateLimitedUntil)
    console.warn(
      `PropertyData rate limit: no retries were made. Provider retry window ends ${stats.rateLimitedUntil}.`,
    );
}

main().catch((error: unknown) => {
  // Unexpected errors may contain response or request data: never print them verbatim.
  console.error(
    error instanceof RefreshError
      ? error.message
      : "Daily refresh failed. Check the workflow configuration and saved data files.",
  );
  process.exitCode = 1;
});
