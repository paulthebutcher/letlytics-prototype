import type { ListingEnrichment } from "./enrichment-types";
import type { OfficialEvidence } from "./official-types";
import type { Assumptions, Financials } from "./types";

export interface RentalComparable {
  address: string;
  monthlyRent: number;
  bedrooms: number | null;
  propertyType: string;
  listingUrl: string | null;
}
export interface RentalEvidence {
  monthlyEstimate: number;
  monthlyLow: number | null;
  monthlyHigh: number | null;
  sampleSize: number;
  radiusMiles: number | null;
  searchPostcode: string;
  fetchedAt: string;
  comparables: RentalComparable[];
}
export interface LiveProperty {
  id: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number | null;
  propertyType: "Flat" | "Terraced" | "Semi-detached" | "Detached";
  floorAreaSqFt: number | null;
  daysOnMarket: number | null;
  listingUrl: string | null;
  imageUrl?: string | null;
  summary: string;
  providerDetails?: {
    type?: string;
    summary?: string;
    yearsRemaining?: number;
  };
  enrichment?: ListingEnrichment;
  official?: OfficialEvidence;
  preciseAddress?: string;
  sameAddressListingIds?: string[];
  strategies: string[];
  fetchedAt: string;
  rent: RentalEvidence | null;
  rentError?: string;
  annualServiceCharge: number | null;
  annualCouncilTax: number | null;
  tenure: string | null;
  epcRating: string | null;
}
export interface LiveFeed {
  market: string;
  fetchedAt: string;
  properties: LiveProperty[];
  warnings: string[];
  scope: string;
  inventory?: {
    returned: number;
    requested: number;
    radiusMiles: number;
    capped: boolean;
  };
}
export interface LiveOverrides {
  monthlyRent?: number;
  annualServiceCharge?: number;
  annualCouncilTax?: number;
  annualGroundRent?: number;
  rentSource?: "local" | "agent";
  buyerCount?: number;
  vacancyPct?: number;
  purchasePrice?: number;
}
export interface LiveCalculation {
  financials: Financials | null;
  monthlyRent: number | null;
  purchasePrice: number;
  missingCosts: string[];
  hasUserRent: boolean;
  rentSource: string;
  cashOnly: boolean;
  annualServiceCharge: number | null;
  annualGroundRent: number | null;
  knownAcquisitionFees: number;
  auctionFee: number | null;
  buyerPackFee: number | null;
  buyingCosts: number;
  initialCash: number;
  warnings: string[];
}
export type LiveAssumptions = Assumptions;
