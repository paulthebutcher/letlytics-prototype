/** None of the prototype inputs were acquired from the services linked by the UI. */
export const DEMO_PROVENANCE = {
  sourceName: "Synthetic demo data",
  kind: "synthetic",
  description:
    "Invented example for this prototype. Not a listing, valuation, market observation or record from a public register.",
} as const;

export const FINANCIAL_METHODOLOGY = {
  grossYield:
    "Annual gross rent ÷ purchase price × 100. Synthetic price and rent; excludes all costs.",
  netYield:
    "Annual rent less vacancy, insurance, maintenance, letting fees, service charges and any landlord council tax ÷ purchase price × 100. Pre-tax and independent of financing.",
  cashOnCash:
    "Annual cash flow after operating expenses and mortgage payments ÷ (cash deposit + editable buying costs) × 100. Pre-tax; buying costs are an illustration, not a tax calculation.",
  projection:
    "Year one uses current rent, then rent and value grow at your assumptions. Mortgage rate and fixed operating costs remain constant. Repayment equity uses remaining principal; interest-only debt remains payable at term end. Cumulative cash flow is separate from equity. Excludes tax, sale costs, refinancing and major one-off works.",
} as const;
