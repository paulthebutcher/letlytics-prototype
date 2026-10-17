import { financials } from "./scoring";
import type { Assumptions } from "./types";
import type {
  LiveCalculation,
  LiveOverrides,
  LiveProperty,
} from "./live-types";
import type { AuctionFee } from "./enrichment-types";
import { verifiedFact, listingWarnings } from "./listing-evidence";

export function auctionFeeAmount(
  price: number,
  fee: AuctionFee | null,
): number | null {
  // If VAT or the minimum are unspecified, the total cannot be verified.
  if (!fee || !fee.includesVat || fee.minimum === null) return null;
  return (
    Math.round(Math.max((price * fee.percent) / 100, fee.minimum) * 100) / 100
  );
}
/** Unknowns remain null in the result; the pure calculator excludes them, with explicit disclosure. */
export function liveFinancials(
  property: LiveProperty,
  assumptions: Assumptions,
  overrides: LiveOverrides = {},
): LiveCalculation {
  const valid = (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  const userRent = valid(overrides.monthlyRent);
  const studioMismatch =
    verifiedFact<boolean>(property, "studio") === true &&
    property.bedrooms !== 0;
  const local = studioMismatch
    ? null
    : (property.rent?.monthlyEstimate ?? null);
  const agent = verifiedFact<number>(property, "agentRent");
  // Neither an achieved tenancy nor an agent estimate silently replaces the local sample.
  const rentDefault = overrides.rentSource === "agent" ? agent : local;
  const monthlyRent = userRent ?? rentDefault;
  const rentSource =
    userRent !== null
      ? "Your rent assumption"
      : overrides.rentSource === "agent"
        ? "Agent estimate (not achieved rent)"
        : studioMismatch
          ? "Rent needed: studio / bedroom conflict"
          : "Local advertised-rent estimate";
  const purchasePrice =
    valid(overrides.purchasePrice) ||
    verifiedFact<number>(property, "price") ||
    property.price;
  const charge =
    valid(overrides.annualServiceCharge) ??
    verifiedFact<number>(property, "annualServiceCharge") ??
    property.annualServiceCharge;
  const ground =
    valid(overrides.annualGroundRent) ??
    verifiedFact<number>(property, "annualGroundRent");
  const councilTax =
    valid(overrides.annualCouncilTax) ?? property.annualCouncilTax;
  // A reported cash restriction or contradictory cash-only facts must also stop mortgage defaults.
  const cashOnly =
    property.enrichment?.facts.some(
      (f) => f.key === "cashOnly" && f.value === true,
    ) ?? false;
  const auction = verifiedFact<boolean>(property, "auction");
  const auctionFee = auctionFeeAmount(
    purchasePrice,
    verifiedFact<AuctionFee>(property, "auctionFee"),
  );
  const buyerPackFee = verifiedFact<number>(property, "buyerPackFee");
  const buyerCheck = verifiedFact<number>(property, "buyerCheckFee");
  const buyers = Math.max(1, Math.floor(valid(overrides.buyerCount) ?? 1));
  const knownAcquisitionFees =
    (auctionFee ?? 0) + (buyerPackFee ?? 0) + (buyerCheck ?? 0) * buyers;
  // Existing allowance is explicitly ALL-IN. Known fees are itemised within it, never added twice.
  const buyingCosts = Math.max(
    valid(assumptions.buyingCosts) ?? 0,
    knownAcquisitionFees,
  );
  const initialCash =
    purchasePrice * (cashOnly ? 1 : assumptions.depositPct / 100) + buyingCosts;
  const warnings = listingWarnings(property);
  if (knownAcquisitionFees > assumptions.buyingCosts)
    warnings.push(
      "Known acquisition fees exceed your allowance; the known total is used. Add tax and legal costs separately to the all-in allowance.",
    );
  if (studioMismatch && overrides.rentSource !== "agent" && userRent === null)
    warnings.push(
      "Select the agent estimate or enter a studio rent; the mismatched bedroom sample is excluded.",
    );
  const missingCosts = [
    ...(charge === null ? ["Service / estate charges"] : []),
    ...(ground === null ? ["Ground rent"] : []),
    ...(assumptions.landlordPaysCouncilTax && councilTax === null
      ? ["Landlord council tax"]
      : []),
    ...(auction && auctionFee === null
      ? ["Auction fees (VAT / minimum unverified)"]
      : []),
  ];
  return {
    monthlyRent,
    purchasePrice,
    missingCosts,
    hasUserRent: userRent !== null,
    rentSource,
    cashOnly,
    annualServiceCharge: charge,
    annualGroundRent: ground,
    knownAcquisitionFees,
    auctionFee,
    buyerPackFee,
    buyingCosts,
    initialCash,
    warnings,
    financials:
      monthlyRent === null
        ? null
        : financials(
            {
              price: purchasePrice,
              monthlyRent,
              annualServiceCharge: (charge ?? 0) + (ground ?? 0),
              annualCouncilTax: councilTax ?? 0,
              area: {
                vacancyRate: Math.min(100, valid(overrides.vacancyPct) ?? 5),
              },
            },
            {
              ...assumptions,
              depositPct: cashOnly ? 100 : assumptions.depositPct,
              buyingCosts,
            },
          ),
  };
}
