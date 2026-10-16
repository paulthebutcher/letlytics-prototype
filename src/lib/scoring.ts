import type {
  Assumptions,
  CategoryKey,
  Emphasis,
  Financials,
  Grade,
  Property,
  ScoreBreakdown,
} from "./types";

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  depositPct: 25,
  mortgageRate: 4.5,
  rentGrowth: 3,
  valueGrowth: 3.5,
  mortgageTermYears: 25,
  mortgageType: "interest-only",
  maintenancePct: 8,
  lettingFeePct: 10,
  annualInsurance: 360,
  buyingCosts: 12_000,
  landlordPaysCouncilTax: false,
};

export const EMPHASIS_PRESETS: Record<Emphasis, Record<CategoryKey, number>> = {
  Balanced: { cashFlow: 40, demand: 25, quality: 15, health: 15, risk: 5 },
  "Cash flow first": {
    cashFlow: 55,
    demand: 20,
    quality: 10,
    health: 10,
    risk: 5,
  },
  "Growth first": {
    cashFlow: 30,
    demand: 40,
    quality: 10,
    health: 15,
    risk: 5,
  },
  "Lowest risk": {
    cashFlow: 25,
    demand: 20,
    quality: 15,
    health: 15,
    risk: 25,
  },
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 100) / 100;
const normalize = (value: number, min: number, max: number) =>
  clamp(((value - min) / (max - min)) * 100);

/** This is an illustrative preference score, not a validated prediction of investment return. */
export function gradeFor(score: number): Grade {
  return score >= 85
    ? "A"
    : score >= 70
      ? "B"
      : score >= 55
        ? "C"
        : score >= 40
          ? "D"
          : "F";
}

/** Guard the pure calculator at its boundary as well as validating inputs in the UI. */
function resolveAssumptions(overrides: Partial<Assumptions> = {}): Assumptions {
  const merged = { ...DEFAULT_ASSUMPTIONS, ...overrides };
  const finite = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback;
  return {
    ...merged,
    depositPct: clamp(finite(merged.depositPct, 25), 0, 100),
    mortgageRate: clamp(finite(merged.mortgageRate, 4.5), 0, 100),
    rentGrowth: clamp(finite(merged.rentGrowth, 3), -99, 100),
    valueGrowth: clamp(finite(merged.valueGrowth, 3.5), -99, 100),
    mortgageTermYears: clamp(finite(merged.mortgageTermYears, 25), 1, 50),
    mortgageType:
      merged.mortgageType === "repayment" ? "repayment" : "interest-only",
    maintenancePct: clamp(finite(merged.maintenancePct, 8), 0, 100),
    lettingFeePct: clamp(finite(merged.lettingFeePct, 10), 0, 100),
    annualInsurance: Math.max(0, finite(merged.annualInsurance, 360)),
    buyingCosts: Math.max(0, finite(merged.buyingCosts, 12_000)),
  };
}

/** All outputs are pre-tax. Mortgage rate is fixed throughout the illustration. */
export function financials(
  property: Pick<
    Property,
    "price" | "monthlyRent" | "annualServiceCharge" | "annualCouncilTax"
  > & { area: Pick<Property["area"], "vacancyRate"> },
  overrides: Partial<Assumptions> = {},
): Financials {
  const a = resolveAssumptions(overrides);
  const deposit = (property.price * a.depositPct) / 100;
  const loan = property.price - deposit;
  const initialCash = deposit + a.buyingCosts;
  const monthlyRate = a.mortgageRate / 100 / 12;
  const termMonths = Math.round(a.mortgageTermYears * 12);
  // Repayment: P*r/(1-(1+r)^-n). The zero-rate case is P/n.
  const monthlyMortgage =
    loan === 0
      ? 0
      : a.mortgageType === "interest-only"
        ? loan * monthlyRate
        : monthlyRate === 0
          ? loan / termMonths
          : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  const monthlyInsurance = a.annualInsurance / 12;
  const monthlyMaintenance = (property.monthlyRent * a.maintenancePct) / 100;
  const monthlyVacancy =
    (property.monthlyRent * property.area.vacancyRate) / 100;
  const monthlyLettingFee = (property.monthlyRent * a.lettingFeePct) / 100;
  const monthlyServiceCharge = property.annualServiceCharge / 12;
  const monthlyCouncilTax = a.landlordPaysCouncilTax
    ? property.annualCouncilTax / 12
    : 0;
  const fixedMonthlyCosts =
    monthlyInsurance + monthlyServiceCharge + monthlyCouncilTax;
  const rentCostFraction =
    (a.maintenancePct + a.lettingFeePct + property.area.vacancyRate) / 100;
  const monthlyOperatingCosts =
    fixedMonthlyCosts + monthlyMaintenance + monthlyVacancy + monthlyLettingFee;
  const monthlyCosts = monthlyOperatingCosts + monthlyMortgage;
  const monthlyCashFlow = property.monthlyRent - monthlyCosts;
  const annualCashFlow = monthlyCashFlow * 12;

  let balance = loan;
  let cumulativeCashFlow = 0;
  const projection: Financials["projection"] = [
    {
      year: 0,
      propertyValue: round(property.price),
      annualRent: round(property.monthlyRent * 12),
      annualCashFlow: 0,
      cumulativeCashFlow: 0,
      mortgageBalance: round(loan),
      equity: round(deposit),
      totalGain: round(-a.buyingCosts),
    },
  ];
  for (let year = 1; year <= 10; year++) {
    // Year one uses today's rent; each subsequent year's rent changes by rentGrowth.
    const rent =
      property.monthlyRent * Math.pow(1 + a.rentGrowth / 100, year - 1);
    let yearCashFlow = 0;
    for (let month = 1; month <= 12; month++) {
      const elapsedMonth = (year - 1) * 12 + month;
      let payment = 0;
      if (balance > 0 && elapsedMonth <= termMonths) {
        if (a.mortgageType === "repayment") {
          payment = Math.min(monthlyMortgage, balance * (1 + monthlyRate));
          balance = Math.max(0, balance * (1 + monthlyRate) - payment);
        } else {
          payment = balance * monthlyRate;
          // Interest-only principal is due at term end; include the balloon cash payment.
          if (elapsedMonth === termMonths) {
            payment += balance;
            balance = 0;
          }
        }
      }
      yearCashFlow +=
        rent * (1 - rentCostFraction) - fixedMonthlyCosts - payment;
    }
    cumulativeCashFlow += yearCashFlow;
    const propertyValue =
      property.price * Math.pow(1 + a.valueGrowth / 100, year);
    const equity = propertyValue - balance;
    projection.push({
      year,
      propertyValue: round(propertyValue),
      annualRent: round(rent * 12),
      annualCashFlow: round(yearCashFlow),
      cumulativeCashFlow: round(cumulativeCashFlow),
      mortgageBalance: round(balance),
      equity: round(equity),
      totalGain: round(equity + cumulativeCashFlow - initialCash),
    });
  }

  return {
    monthlyRent: property.monthlyRent,
    monthlyMortgage: round(monthlyMortgage),
    monthlyInsurance: round(monthlyInsurance),
    monthlyMaintenance: round(monthlyMaintenance),
    monthlyVacancy: round(monthlyVacancy),
    monthlyLettingFee: round(monthlyLettingFee),
    monthlyServiceCharge: round(monthlyServiceCharge),
    monthlyCouncilTax: round(monthlyCouncilTax),
    monthlyCosts: round(monthlyCosts),
    monthlyCashFlow: round(monthlyCashFlow),
    annualCashFlow: round(annualCashFlow),
    grossYield: round(((property.monthlyRent * 12) / property.price) * 100),
    // Net yield includes operating costs, service charge and voids, but excludes financing.
    netYield: round(
      (((property.monthlyRent - monthlyOperatingCosts) * 12) / property.price) *
        100,
    ),
    cashOnCash:
      initialCash > 0 ? round((annualCashFlow / initialCash) * 100) : 0,
    deposit: round(deposit),
    loan: round(loan),
    initialCash: round(initialCash),
    projection,
  };
}

export function computeScore(
  property: Property,
  assumptions: Partial<Assumptions> = {},
  emphasis: Emphasis = "Balanced",
): ScoreBreakdown {
  const f = financials(property, assumptions);
  const weights = EMPHASIS_PRESETS[emphasis];
  const area = property.area;
  const yieldScore = normalize(f.netYield, 0, 6.5);
  const cashOnCashScore = normalize(f.cashOnCash, -4, 12);
  const cashFlow = yieldScore * 0.625 + cashOnCashScore * 0.375;
  const demand =
    normalize(area.populationGrowth, 0, 4) * 0.2 +
    normalize(area.incomeGrowth, 0, 6) * 0.2 +
    clamp(area.walkability) * 0.2 +
    clamp(area.transit) * 0.25 +
    clamp(area.schools) * 0.15;
  const ageScore = normalize(property.yearBuilt, 1880, 2025);
  const typeScore =
    property.propertyType === "Flat"
      ? 60
      : property.propertyType === "Terraced"
        ? 80
        : 90;
  const serviceChargeScore =
    100 -
    normalize((property.annualServiceCharge / property.price) * 100, 0, 2);
  const quality =
    ageScore * 0.3 +
    typeScore * 0.15 +
    (100 - normalize(property.daysOnMarket, 0, 150)) * 0.35 +
    serviceChargeScore * 0.2;
  const priceToRent = property.price / (property.monthlyRent * 12);
  const health =
    (100 - normalize(priceToRent, 10, 30)) * 0.6 +
    (100 - normalize(area.vacancyRate, 2, 12)) * 0.4;
  const floodScore =
    property.floodRisk === "low"
      ? 100
      : property.floodRisk === "medium"
        ? 50
        : 0;
  const risk = floodScore * 0.7 + clamp(property.noiseScore) * 0.3;
  const source =
    " All property and area inputs are fictional synthetic demo data; these thresholds are unvalidated prototype heuristics.";
  const definitions: {
    key: CategoryKey;
    label: string;
    score: number;
    explanation: string;
  }[] = [
    {
      key: "cashFlow",
      label: "Cash flow",
      score: cashFlow,
      explanation: `Net yield ${f.netYield.toFixed(2)}% (operating income ÷ price, before financing) maps 0–6.5% to 0–100. Cash-on-cash ${f.cashOnCash.toFixed(2)}% (annual pre-tax cash flow ÷ deposit plus buying costs) maps −4–12% to 0–100. Blend: 62.5% yield, 37.5% cash-on-cash.${source}`,
    },
    {
      key: "demand",
      label: "Market demand",
      score: demand,
      explanation: `Illustrative population growth ${area.populationGrowth}% and income growth ${area.incomeGrowth}% map 0–4% and 0–6% to 0–100. Blend: population 20%, income 20%, walkability ${area.walkability}/100 (20%), transit ${area.transit}/100 (25%), schools ${area.schools}/100 (15%).${source}`,
    },
    {
      key: "quality",
      label: "Property quality",
      score: quality,
      explanation: `Blend: construction year ${property.yearBuilt} (30%; 1880–2025 maps to 0–100), property type (15%; flat 60, terrace 80, house 90), ${property.daysOnMarket} days on market (35%; 0–150 days maps to 100–0), service charge as a share of price (20%; 0–2% maps to 100–0). EPC is a separate due-diligence flag, not proof of condition.${source}`,
    },
    {
      key: "health",
      label: "Market health",
      score: health,
      explanation: `Price-to-annual-rent ratio ${priceToRent.toFixed(1)} maps 10–30× to 100–0 (60% of category). Vacancy reserve ${area.vacancyRate}% maps 2–12% to 100–0 (40%). Lower ratios and lower void assumptions score higher; low price can also signal risk.${source}`,
    },
    {
      key: "risk",
      label: "Risk resilience",
      score: risk,
      explanation: `Higher means fewer modelled risks. Flood scenario ${property.floodRisk} maps low/medium/high to 100/50/0 (70%). Illustrative quietness ${property.noiseScore}/100 supplies 30%. This limited model omits structural, legal and tenant risk; review EPC and tenure separately.${source}`,
    },
  ];
  const categories = definitions.map((category) => ({
    ...category,
    score: round(clamp(category.score)),
    weight: weights[category.key],
    contribution: round((clamp(category.score) * weights[category.key]) / 100),
  }));
  const total = round(
    categories.reduce((sum, category) => sum + category.contribution, 0),
  );
  return { total, grade: gradeFor(total), categories, financials: f };
}
