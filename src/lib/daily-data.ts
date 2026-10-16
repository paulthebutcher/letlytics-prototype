import savedFeed from "../data/live-snapshot.json";
import savedSales from "../data/daily-sales.json";
import type { LiveFeed } from "./live-types";
import {
  emptySalesEvidence,
  type SalesEvidence,
  type SalesQuery,
} from "./sales-types";

// These are build inputs. Provider requests belong only to scripts/refresh-data.ts.
export function getDailyFeed(): LiveFeed {
  return savedFeed as LiveFeed;
}

export function getDailySales(query: SalesQuery): SalesEvidence {
  const records = savedSales.records as Record<string, SalesEvidence>;
  const evidence = records[`${query.postcode}:${query.propertyType}`];
  if (evidence) return evidence;
  return emptySalesEvidence(
    query,
    "unavailable",
    "Recorded sales for this postcode are not available in the saved dataset. They will be checked in the next daily update.",
  );
}
