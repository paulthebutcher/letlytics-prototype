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
}
export interface LiveOverrides {
  monthlyRent?: number;
  annualServiceCharge?: number;
  annualCouncilTax?: number;
  vacancyPct?: number;
  purchasePrice?: number;
}
export interface LiveCalculation {
  financials: Financials | null;
  monthlyRent: number | null;
  purchasePrice: number;
  missingCosts: string[];
  hasUserRent: boolean;
}
export type LiveAssumptions = Assumptions;
