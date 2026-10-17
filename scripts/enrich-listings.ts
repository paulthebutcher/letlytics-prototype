import { loadEnvConfig } from "@next/env";
import { join } from "node:path";
import { enrichDataFiles } from "./enrich-listings-core";
loadEnvConfig(process.cwd());
enrichDataFiles(join(process.cwd(), "src/data"), {
  apiKey: process.env.PROPERTYDATA_API_KEY,
  force: process.argv.includes("--force"),
  onProgress: (id, status) => console.log(`${id}: ${status}`),
})
  .then((result) => {
    const counts: Record<string, number> = {};
    for (const e of Object.values(result.records))
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    console.log("Saved enrichment:", JSON.stringify(counts));
  })
  .catch(() => {
    console.error("Enrichment failed; check saved files and configuration.");
    process.exitCode = 1;
  });
