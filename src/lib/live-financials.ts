import { financials } from "./scoring";
import type { Assumptions } from "./types";
import type {
  LiveCalculation,
  LiveOverrides,
  LiveProperty,
} from "./live-types";

/** Unknown operating costs are excluded, and explicitly returned as missing, never asserted to be zero. */
export function liveFinancials(
  property: LiveProperty,
  assumptions: Assumptions,
  overrides: LiveOverrides = {},
): LiveCalculation {
  const valid = (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  const userRent = valid(overrides.monthlyRent);
  const monthlyRent = userRent ?? property.rent?.monthlyEstimate ?? null;
  const purchasePrice = valid(overrides.purchasePrice) || property.price;
  const charge =
    valid(overrides.annualServiceCharge) ?? property.annualServiceCharge;
  const councilTax =
    valid(overrides.annualCouncilTax) ?? property.annualCouncilTax;
  const missingCosts = [
    ...(charge === null ? ["Service / estate charges"] : []),
    ...(assumptions.landlordPaysCouncilTax && councilTax === null
      ? ["Landlord council tax"]
      : []),
  ];
  return {
    monthlyRent,
    purchasePrice,
    missingCosts,
    hasUserRent: userRent !== null,
    financials:
      monthlyRent === null
        ? null
        : financials(
            {
              price: purchasePrice,
              monthlyRent,
              annualServiceCharge: charge ?? 0,
              annualCouncilTax: councilTax ?? 0,
              area: {
                vacancyRate: Math.min(100, valid(overrides.vacancyPct) ?? 5),
              },
            },
            assumptions,
          ),
  };
}
