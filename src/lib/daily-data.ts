import enrichment from "../data/listing-enrichment.json";
import type { EnrichmentStore } from "./enrichment-types";
import savedFeed from "../data/live-snapshot.json";
import savedSales from "../data/daily-sales.json";
import savedOfficial from "../data/official-evidence.json";
import type { OfficialStore } from "./official-types";
import type { LiveFeed } from "./live-types";
import {
  emptySalesEvidence,
  type SalesEvidence,
  type SalesQuery,
} from "./sales-types";

// These are build inputs. Provider requests belong only to scripts/refresh-data.ts.
export function getDailyFeed(): LiveFeed {
  const feed = savedFeed as LiveFeed;
  const records = (enrichment as EnrichmentStore).records;
  return {
    ...feed,
    properties: feed.properties.map((p) => ({
      ...p,
      sameAddressListingIds: p.preciseAddress
        ? feed.properties
            .filter(
              (other) =>
                other.id !== p.id &&
                other.preciseAddress
                  ?.toUpperCase()
                  .replace(/[^A-Z0-9]/g, "") ===
                  p.preciseAddress!.toUpperCase().replace(/[^A-Z0-9]/g, ""),
            )
            .map((other) => other.id)
        : [],
      official: (savedOfficial as OfficialStore).records[p.id],
      enrichment:
        records[p.id]?.listingUrl === p.listingUrl ? records[p.id] : undefined,
    })),
  };
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
