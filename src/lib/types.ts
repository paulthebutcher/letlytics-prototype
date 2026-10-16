export type Grade = "A" | "B" | "C" | "D" | "F";
export type Emphasis =
  "Balanced" | "Cash flow first" | "Growth first" | "Lowest risk";
export type CategoryKey = "cashFlow" | "demand" | "quality" | "health" | "risk";
export type EPCRating = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface Property {
  id: string;
  address: string;
  neighbourhood: string;
  postcode: string;
  lat: number;
  lng: number;
  price: number;
  monthlyRent: number;
  propertyType: "Flat" | "Terraced" | "Semi-detached" | "Detached";
  bedrooms: number;
  yearBuilt: number;
  tenure: "freehold" | "leasehold";
  annualServiceCharge: number;
  epcRating: EPCRating;
  councilTaxBand: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  annualCouncilTax: number;
  daysOnMarket: number;
  floodRisk: "low" | "medium" | "high";
  /** Higher means a quieter illustrative environment; not a measured noise reading. */
  noiseScore: number;
  area: {
    /** Annual percentage points, e.g. 2 means 2%. */
    populationGrowth: number;
    incomeGrowth: number;
    walkability: number;
    transit: number;
    schools: number;
    /** Percentage of annual rent reserved for vacancy, e.g. 5 means 5%. */
    vacancyRate: number;
  };
  description: string;
  sourceLabel: "Synthetic demo data";
}

export interface Assumptions {
  depositPct: number;
  mortgageRate: number;
  rentGrowth: number;
  valueGrowth: number;
  mortgageTermYears: number;
  mortgageType: "interest-only" | "repayment";
  /** Percentage of gross rent, not a percentage of property value. */
  maintenancePct: number;
  lettingFeePct: number;
  annualInsurance: number;
  /** Editable illustrative acquisition costs; does not calculate statutory tax. */
  buyingCosts: number;
  landlordPaysCouncilTax: boolean;
}

export interface ProjectionYear {
  year: number;
  propertyValue: number;
  annualRent: number;
  annualCashFlow: number;
  cumulativeCashFlow: number;
  mortgageBalance: number;
  equity: number;
  /** Equity + cumulative pre-tax cash flow - initial cash. Excludes sale costs and taxes. */
  totalGain: number;
}

export interface Financials {
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyInsurance: number;
  monthlyMaintenance: number;
  monthlyVacancy: number;
  monthlyLettingFee: number;
  monthlyServiceCharge: number;
  monthlyCouncilTax: number;
  monthlyCosts: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  grossYield: number;
  netYield: number;
  cashOnCash: number;
  deposit: number;
  loan: number;
  initialCash: number;
  projection: ProjectionYear[];
}

export interface ScoreCategory {
  key: CategoryKey;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface ScoreBreakdown {
  total: number;
  grade: Grade;
  categories: ScoreCategory[];
  financials: Financials;
}
