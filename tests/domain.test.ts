import assert from "node:assert/strict";
import test from "node:test";
import {
  computeScore,
  DEFAULT_ASSUMPTIONS,
  EMPHASIS_PRESETS,
  financials,
  gradeFor,
  properties,
} from "../src/lib/domain";
import type { Emphasis, Grade, Property } from "../src/lib/domain";

const fixture: Property = {
  ...properties[0],
  price: 200_000,
  monthlyRent: 1_200,
  annualServiceCharge: 1_200,
  annualCouncilTax: 1_800,
  area: { ...properties[0].area, vacancyRate: 5 },
};
const near = (actual: number, expected: number, tolerance = 0.011) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should be within ${tolerance} of ${expected}`,
  );
};

test("interest-only cash flow includes every operating cost and uses cash including buying costs", () => {
  const f = financials(fixture);
  near(f.loan, 150_000);
  near(f.monthlyMortgage, 562.5);
  near(f.monthlyInsurance, 30);
  near(f.monthlyMaintenance, 96);
  near(f.monthlyVacancy, 60);
  near(f.monthlyLettingFee, 120);
  near(f.monthlyServiceCharge, 100);
  near(f.monthlyCouncilTax, 0);
  near(f.monthlyCashFlow, 231.5);
  near(f.initialCash, 62_000);
  near(f.grossYield, 7.2);
  near(f.netYield, 4.764);
  near(f.cashOnCash, (2_778 / 62_000) * 100);
});

test("net yield excludes financing and buying costs", () => {
  const baseline = financials(fixture);
  const stressed = financials(fixture, {
    depositPct: 10,
    mortgageRate: 6.5,
    buyingCosts: 25_000,
    mortgageType: "repayment",
  });
  assert.equal(stressed.netYield, baseline.netYield);
  assert.equal(stressed.grossYield, baseline.grossYield);
  assert.notEqual(stressed.monthlyCashFlow, baseline.monthlyCashFlow);
  assert.notEqual(stressed.cashOnCash, baseline.cashOnCash);
});

test("service charges and optional landlord council tax reduce operating income", () => {
  const baseline = financials(fixture);
  const noServiceCharge = financials({ ...fixture, annualServiceCharge: 0 });
  const councilTax = financials(fixture, { landlordPaysCouncilTax: true });
  near(noServiceCharge.monthlyCashFlow - baseline.monthlyCashFlow, 100);
  near(noServiceCharge.netYield - baseline.netYield, 0.6);
  near(baseline.monthlyCashFlow - councilTax.monthlyCashFlow, 150);
  near(baseline.netYield - councilTax.netYield, 0.9);
});

test("zero-rate repayment is principal divided by term; interest-only charges no interest", () => {
  const repayment = financials(fixture, {
    mortgageType: "repayment",
    mortgageRate: 0,
  });
  const interestOnly = financials(fixture, {
    mortgageType: "interest-only",
    mortgageRate: 0,
  });
  near(repayment.monthlyMortgage, 500);
  near(repayment.projection[10].mortgageBalance, 90_000);
  near(interestOnly.monthlyMortgage, 0);
  near(interestOnly.projection[10].mortgageBalance, 150_000);
});

test("a cash purchase has no mortgage payment or outstanding principal", () => {
  for (const mortgageType of ["interest-only", "repayment"] as const) {
    const f = financials(fixture, { depositPct: 100, mortgageType });
    assert.equal(f.loan, 0);
    assert.equal(f.monthlyMortgage, 0);
    assert.ok(f.projection.every((year) => year.mortgageBalance === 0));
    near(f.monthlyCashFlow, 794);
    near(f.initialCash, 212_000);
  }
});

test("repayment projection tracks principal, equity, and cumulative cash flow separately", () => {
  const f = financials(fixture, { mortgageType: "repayment" });
  const rate = 0.045 / 12;
  const payment = (150_000 * rate) / (1 - (1 + rate) ** -300);
  const expectedBalance =
    150_000 * (1 + rate) ** 120 - (payment * ((1 + rate) ** 120 - 1)) / rate;
  const end = f.projection[10];
  near(end.mortgageBalance, expectedBalance);
  near(end.equity, end.propertyValue - end.mortgageBalance);
  near(
    end.cumulativeCashFlow,
    f.projection.reduce((sum, year) => sum + year.annualCashFlow, 0),
    0.05,
  );
  near(
    end.totalGain,
    end.equity + end.cumulativeCashFlow - f.initialCash,
    0.02,
  );
  near(f.projection[1].annualCashFlow, f.annualCashFlow);
  assert.equal(f.projection[0].totalGain, -DEFAULT_ASSUMPTIONS.buyingCosts);
});

test("short mortgage terms stop repayment payments; interest-only maturity includes its balloon", () => {
  const repayment = financials(fixture, {
    mortgageType: "repayment",
    mortgageTermYears: 5,
  });
  assert.equal(repayment.projection[5].mortgageBalance, 0);
  assert.equal(repayment.projection[10].mortgageBalance, 0);
  const interestOnly = financials(fixture, {
    mortgageType: "interest-only",
    mortgageTermYears: 5,
    rentGrowth: 0,
    valueGrowth: 0,
  });
  assert.equal(interestOnly.projection[4].mortgageBalance, 150_000);
  assert.equal(interestOnly.projection[5].mortgageBalance, 0);
  near(
    interestOnly.projection[5].annualCashFlow,
    interestOnly.annualCashFlow - 150_000,
  );
  near(interestOnly.projection[6].annualCashFlow, 794 * 12);
});

test("rent and value growth independently update the projection", () => {
  const baseline = financials(fixture);
  const rentGrowth = financials(fixture, { rentGrowth: 5 });
  const valueGrowth = financials(fixture, { valueGrowth: -2 });
  assert.equal(rentGrowth.monthlyCashFlow, baseline.monthlyCashFlow);
  assert.ok(
    rentGrowth.projection[10].cumulativeCashFlow >
      baseline.projection[10].cumulativeCashFlow,
  );
  assert.equal(
    valueGrowth.projection[10].cumulativeCashFlow,
    baseline.projection[10].cumulativeCashFlow,
  );
  assert.ok(valueGrowth.projection[10].equity < baseline.projection[10].equity);
});

test("seed has 60 explicitly synthetic examples and a balanced demonstration grade spread", () => {
  assert.equal(properties.length, 60);
  assert.equal(
    new Set(properties.map((property) => property.id)).size,
    properties.length,
  );
  const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const property of properties) {
    assert.equal(property.sourceLabel, "Synthetic demo data");
    const score = computeScore(property);
    counts[score.grade]++;
    assert.ok(
      score.categories.every(
        (category) =>
          Number.isFinite(category.score) &&
          category.score >= 0 &&
          category.score <= 100,
      ),
    );
    assert.ok(
      score.categories.every((category) =>
        category.explanation.includes("fictional synthetic demo data"),
      ),
    );
    assert.ok(
      Object.values(score.financials)
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
  }
  assert.ok(
    Object.values(counts).every(
      (count) => count > 0 && count <= properties.length * 0.4,
    ),
  );
  assert.ok(counts.D + counts.F < properties.length / 2);
  assert.equal(
    properties.find((property) => property.id === "mcr-epcrisk-01")?.epcRating,
    "E",
  );
});

test("assumptions and emphasis change grades through the same pure scoring function", () => {
  const boundary = properties.find(
    (property) => property.id === "mcr-boundary-01",
  )!;
  assert.notEqual(
    computeScore(boundary).grade,
    computeScore(boundary, { depositPct: 10, mortgageRate: 6.5 }).grade,
  );
  for (const emphasis of Object.keys(EMPHASIS_PRESETS) as Emphasis[]) {
    assert.equal(
      Object.values(EMPHASIS_PRESETS[emphasis]).reduce(
        (sum, weight) => sum + weight,
        0,
      ),
      100,
    );
  }
  assert.ok(
    properties.some(
      (property) =>
        computeScore(property).grade !==
        computeScore(property, {}, "Lowest risk").grade,
    ),
  );
  assert.ok(
    properties.some(
      (property) =>
        computeScore(property).grade !==
        computeScore(property, {}, "Cash flow first").grade,
    ),
  );
  assert.deepEqual([0, 39.99, 40, 55, 70, 85, 100].map(gradeFor), [
    "F",
    "F",
    "D",
    "C",
    "B",
    "A",
    "A",
  ]);
});
