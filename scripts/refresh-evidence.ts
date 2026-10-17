import { loadEnvConfig } from "@next/env";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { collectSalesEvidence, type DailySales } from "./refresh-data-core";
import { refreshOfficialFile } from "./official-evidence-core";
import type { LiveFeed } from "../src/lib/live-types";

async function main() {
  loadEnvConfig(process.cwd());
  const directory = join(process.cwd(), "src/data");
  const feed = JSON.parse(
    await readFile(join(directory, "live-snapshot.json"), "utf8"),
  ) as LiveFeed;
  const path = join(directory, "daily-sales.json");
  const previous = JSON.parse(await readFile(path, "utf8")) as DailySales;
  const result = await collectSalesEvidence(feed.properties, previous);
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(result.sales, null, 2) + "\n");
  await rename(temp, path);
  console.log("Sales evidence:", result.stats);
  console.log(
    "Exact-property checks:",
    await refreshOfficialFile(
      directory,
      process.env.PROPERTYDATA_API_KEY ?? "",
    ),
  );
}
main().catch(() => {
  console.error(
    "Evidence refresh failed; inspect the saved evidence dates and retry the job.",
  );
  process.exitCode = 1;
});
