export type FactKey =
  | "price"
  | "priceQualifier"
  | "auction"
  | "cashOnly"
  | "studio"
  | "bedrooms"
  | "tenure"
  | "annualServiceCharge"
  | "annualGroundRent"
  | "groundRentTerms"
  | "lease"
  | "leaseYearsRemaining"
  | "epc"
  | "agentRent"
  | "advertisedRent"
  | "achievedRent"
  | "ownership"
  | "auctionFee"
  | "buyerPackFee"
  | "buyerCheckFee";
export type AuctionFee = {
  percent: number;
  minimum: number | null;
  includesVat: boolean;
};
export type FactValue = string | number | boolean | AuctionFee;
export interface ListingFact {
  key: FactKey;
  value: FactValue;
  sourceUrl: string;
  retrievedAt: string;
  excerpt: string;
  status: "verified" | "reported" | "conflicting";
  sourceKind: "portal" | "agent" | "brochure" | "provider";
}
export interface SourceAttempt {
  url: string;
  attemptedAt: string;
  outcome:
    | "retrieved"
    | "blocked"
    | "unavailable"
    | "unsupported"
    | "identity-mismatch";
  detail: string;
  retryAfter?: string;
}
export interface ListingEnrichment {
  version: number;
  providerSignature?: string;
  listingUrl: string | null;
  canonicalUrl: string | null;
  attemptedAt: string;
  retrievedAt: string | null;
  enrichedAt: string | null;
  status: "ready" | "partial" | "blocked" | "unavailable";
  facts: ListingFact[];
  conflicts: string[];
  attempts: SourceAttempt[];
  linkedSources: string[];
}
export interface EnrichmentStore {
  records: Record<string, ListingEnrichment>;
}
