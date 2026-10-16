"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BedDouble,
  Check,
  ChevronDown,
  Info,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import {
  computeScore,
  DEFAULT_ASSUMPTIONS,
  properties,
  type Assumptions,
  type ProjectionYear,
} from "@/lib/domain";
import { useApp } from "./app-context";
import { GradeBadge, RiskFlags, money, percent } from "./ui";

type NumericKey = {
  [K in keyof Assumptions]: Assumptions[K] extends number ? K : never;
}[keyof Assumptions];

function ScenarioField({
  label,
  field,
  value,
  min,
  max,
  step = 1,
  unit = "%",
  hint,
  onChange,
}: {
  label: string;
  field: NumericKey;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (field: NumericKey, value: number) => void;
}) {
  const id = `scenario-${field}`;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const commitDraft = () => {
    const next = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(next)) {
      setDraft(String(value));
      return;
    }
    const bounded = Math.max(min, Math.min(max, next));
    setDraft(String(bounded));
    onChange(field, bounded);
  };
  const updateSlider = (raw: string) => {
    const next = Math.max(min, Math.min(max, Number(raw)));
    setDraft(String(next));
    onChange(field, next);
  };
  return (
    <div className="assumption-field">
      <div className="field-heading">
        <label htmlFor={id}>{label}</label>
        <div className="number-unit">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            aria-describedby={hint ? `${id}-hint` : undefined}
          />
          <span>{unit}</span>
        </div>
      </div>
      <input
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => updateSlider(e.target.value)}
      />
      <div className="range-labels">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      {hint && (
        <p className="micro" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Projection({ rows }: { rows: ProjectionYear[] }) {
  const [year, setYear] = useState(10);
  const current =
    rows.find((row) => row.year === year) ?? rows[rows.length - 1];
  const width = 680,
    height = 240,
    left = 60,
    right = 20,
    top = 22,
    bottom = 36;
  const values = rows.flatMap((row) => [row.equity, row.cumulativeCashFlow]);
  const low = Math.min(0, ...values),
    high = Math.max(1, ...values);
  const pad = (high - low) * 0.12;
  const min = low - pad,
    max = high + pad;
  const x = (y: number) => left + (y / 10) * (width - left - right);
  const plotY = (value: number) =>
    top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = (key: "equity" | "cumulativeCashFlow") =>
    rows.map((row) => `${x(row.year)},${plotY(row[key])}`).join(" ");
  const axisLabel = (n: number) =>
    `${n < 0 ? "−" : ""}£${Math.abs(n) >= 1000 ? `${Math.round(Math.abs(n) / 1000)}k` : Math.round(Math.abs(n))}`;

  return (
    <section
      className="section-card projection-card"
      aria-labelledby="projection-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOOK AHEAD</span>
          <h2 id="projection-title">What could 10 years look like?</h2>
        </div>
        <TrendingUp size={21} />
      </div>
      <p className="muted">
        Two separate outcomes: equity held in the property, and cash generated
        along the way.
      </p>
      <div className="chart-legend">
        <span>
          <i className="legend-equity" />
          Property equity
        </span>
        <span>
          <i className="legend-cashflow" />
          Cumulative cash flow
        </span>
      </div>
      <svg
        className="projection-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="projection-chart-title projection-chart-description"
      >
        <title id="projection-chart-title">
          Illustrative property equity and cumulative pre-tax cash flow over ten
          years
        </title>
        <desc id="projection-chart-description">
          At year {year}, property equity is {money(current.equity)} and
          cumulative cash flow is {money(current.cumulativeCashFlow)}. Use the
          year control below to inspect every year.
        </desc>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = min + fraction * (max - min);
          return (
            <g key={fraction}>
              <line
                x1={left}
                y1={plotY(value)}
                x2={width - right}
                y2={plotY(value)}
                stroke="currentColor"
                opacity=".1"
              />
              <text
                x={left - 10}
                y={plotY(value) + 4}
                textAnchor="end"
                fill="currentColor"
                opacity=".6"
                fontSize="11"
              >
                {axisLabel(value)}
              </text>
            </g>
          );
        })}
        {[0, 2, 4, 6, 8, 10].map((value) => (
          <text
            key={value}
            x={x(value)}
            y={height - 10}
            textAnchor="middle"
            fill="currentColor"
            opacity=".6"
            fontSize="11"
          >
            {value === 0 ? "Today" : `Year ${value}`}
          </text>
        ))}
        <line
          x1={left}
          y1={plotY(0)}
          x2={width - right}
          y2={plotY(0)}
          stroke="currentColor"
          opacity=".25"
          strokeDasharray="3 4"
        />
        <polyline
          className="equity-line"
          points={points("equity")}
          fill="none"
          stroke="var(--green, #1d5544)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          className="cashflow-line"
          points={points("cumulativeCashFlow")}
          fill="none"
          stroke="var(--gold, #b37d35)"
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={x(year)}
          y1={top}
          x2={x(year)}
          y2={height - bottom}
          stroke="currentColor"
          opacity=".25"
          strokeDasharray="3 4"
        />
        <circle
          cx={x(year)}
          cy={plotY(current.equity)}
          r="5"
          fill="var(--green, #1d5544)"
          stroke="white"
          strokeWidth="2"
        />
        <circle
          cx={x(year)}
          cy={plotY(current.cumulativeCashFlow)}
          r="5"
          fill="var(--gold, #b37d35)"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <div className="projection-year">
        <label htmlFor="projection-year">
          Inspect year <strong>{year}</strong>
        </label>
        <input
          id="projection-year"
          type="range"
          min="0"
          max="10"
          step="1"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>
      <div className="projection-grid">
        <div>
          <span>Property value</span>
          <strong>{money(current.propertyValue)}</strong>
        </div>
        <div>
          <span>Mortgage balance</span>
          <strong>{money(current.mortgageBalance)}</strong>
        </div>
        <div>
          <span>Property equity</span>
          <strong>{money(current.equity)}</strong>
        </div>
        <div>
          <span>Cumulative cash flow</span>
          <strong>{money(current.cumulativeCashFlow)}</strong>
        </div>
      </div>
      <p className="micro">
        Illustrative projection. Property values and rents can fall as well as
        rise. Fixed mortgage rate and fixed insurance, service charges and
        council tax; rent-linked costs grow with rent. Excludes tax, sale costs
        and unplanned works. Equity includes your initial deposit.
      </p>
    </section>
  );
}

export function Analysis({ id }: { id: string }) {
  const {
    assumptions,
    setAssumptions,
    emphasis,
    selected,
    toggleSelect,
    recordView,
    ready,
    showMethod,
    notify,
  } = useApp();
  const property = properties.find((p) => p.id === id);
  useEffect(() => {
    if (ready && property) recordView(property.id);
  }, [ready, property, recordView]);

  if (!property)
    return (
      <div className="empty-state analysis-page">
        <h1>We couldn't find that demo property.</h1>
        <p className="muted">
          Choose one of the sample homes in Manchester to continue.
        </p>
        <Link className="button primary" href="/discover">
          Back to Discover <ArrowUpRight size={16} />
        </Link>
      </div>
    );

  const score = computeScore(property, assumptions, emphasis);
  const f = score.financials;
  const isSelected = selected.includes(property.id);
  const strongest = [...score.categories].sort((a, b) => b.score - a.score)[0];
  const weakest = [...score.categories].sort((a, b) => a.score - b.score)[0];
  const update = (field: NumericKey, value: number) =>
    setAssumptions({ ...assumptions, [field]: value });
  const costRows = [
    {
      label:
        assumptions.mortgageType === "interest-only"
          ? "Mortgage interest"
          : "Mortgage repayment",
      value: f.monthlyMortgage,
      note: `${percent(assumptions.mortgageRate)} · ${assumptions.depositPct}% deposit`,
    },
    {
      label: "Letting & management",
      value: f.monthlyLettingFee,
      note: `${assumptions.lettingFeePct}% of gross rent`,
    },
    {
      label: "Maintenance reserve",
      value: f.monthlyMaintenance,
      note: `${assumptions.maintenancePct}% of gross rent`,
    },
    {
      label: "Void allowance",
      value: f.monthlyVacancy,
      note: `${property.area.vacancyRate}% of gross rent · demo assumption`,
    },
    {
      label: "Insurance",
      value: f.monthlyInsurance,
      note: `${money(assumptions.annualInsurance)} per year`,
    },
    {
      label: "Service charge",
      value: f.monthlyServiceCharge,
      note:
        property.tenure === "leasehold"
          ? `${money(property.annualServiceCharge)} per year · demo assumption`
          : "Freehold example",
    },
    {
      label: "Council tax",
      value: f.monthlyCouncilTax,
      note: assumptions.landlordPaysCouncilTax
        ? `Landlord pays · band ${property.councilTaxBand} demo amount`
        : "Tenant-paid assumed; no void council tax allowance",
    },
  ];
  const diligence = [
    `Validate the ${money(property.monthlyRent)} monthly rent with recent comparable lets and a local agent.`,
    property.tenure === "leasehold"
      ? `Obtain the lease, remaining term and service-charge accounts; check planned major works against the ${money(property.annualServiceCharge)} demo allowance.`
      : "Check title, structural condition and a surveyor’s repair budget; the model has no inspection evidence.",
    ["F", "G"].includes(property.epcRating)
      ? `EPC ${property.epcRating}: verify current letting eligibility and any valid exemption before considering the deal.`
      : !["A", "B", "C"].includes(property.epcRating)
        ? `EPC ${property.epcRating}: obtain the certificate, recommended works and an upgrade quote.`
        : `Verify the actual EPC certificate and expiry date; the EPC ${property.epcRating} shown here is simulated.`,
    property.floodRisk !== "low"
      ? "Check the official flood map and insurance quotes; this example includes a simulated flood-risk flag."
      : "Check licensing, local rental demand and flood history independently; an unflagged example is not a clean bill of health.",
    "Confirm finance, purchase taxes, legal costs and any initial works. This analysis is before tax and uses an editable buying-cost allowance.",
  ];

  return (
    <div className="analysis-page">
      <Link className="back-link" href="/discover">
        <ArrowLeft size={15} /> Back to Manchester
      </Link>
      <a className="mobile-scenario-link button secondary" href="#assumptions">
        Adjust your assumptions <SlidersHorizontal size={14} />
      </a>
      <div className="property-heading">
        <div className="property-title">
          <div className="eyebrow">
            PROPERTY ANALYSIS <span>· FICTIONAL EXAMPLE</span>
          </div>
          <h1>{property.address}</h1>
          <p>
            <MapPin size={15} />
            {property.neighbourhood}, {property.postcode}
          </p>
          <div className="property-tags">
            <span>
              <BedDouble size={14} />
              {property.bedrooms} bedrooms
            </span>
            <span>{property.propertyType}</span>
            <span>
              {property.tenure === "leasehold" ? "Leasehold" : "Freehold"}
            </span>
            <span>EPC {property.epcRating}</span>
          </div>
        </div>
        <button
          className={`button ${isSelected ? "secondary selected" : "primary"}`}
          onClick={() => toggleSelect(property.id)}
        >
          {isSelected ? <Check size={16} /> : <ArrowLeftRight size={16} />}
          {isSelected ? "Added to comparison" : "Add to comparison"}
        </button>
      </div>

      <div className="analysis-layout">
        <div className="analysis-main">
          <section
            className="score-summary"
            aria-label="Illustrative investment summary"
          >
            <div className="summary-grade">
              <GradeBadge grade={score.grade} large />
              <span>{score.total.toFixed(2)} / 100</span>
            </div>
            <div className="summary-copy">
              <span className="eyebrow">ILLUSTRATIVE SCREENING SCORE</span>
              <h2>
                {f.monthlyCashFlow >= 300
                  ? "Room in the monthly numbers."
                  : f.monthlyCashFlow >= 0
                    ? "Positive cash flow. A tighter margin."
                    : "The rent does not cover this scenario."}
              </h2>
              <p>
                {strongest.label} is the strongest modelled factor;{" "}
                {weakest.label.toLowerCase()} deserves a closer look.{" "}
                <button onClick={showMethod}>How is this scored?</button>
              </p>
              <span className="summary-emphasis">
                {emphasis} weighting · your shared assumptions
              </span>
            </div>
            <div className="summary-cashflow">
              <span>Monthly cash flow</span>
              <strong>
                {money(f.monthlyCashFlow)}
                <small>/mo</small>
              </strong>
              <span>Before tax · after modelled costs</span>
            </div>
          </section>

          <div className="metric-grid">
            <div className="metric-card">
              <span>Purchase assumption</span>
              <strong>{money(property.price)}</strong>
              <small>Synthetic demo price</small>
            </div>
            <div className="metric-card">
              <span>Gross yield</span>
              <strong>{percent(f.grossYield)}</strong>
              <small>Rent ÷ purchase price</small>
            </div>
            <div className="metric-card">
              <span>Net operating yield</span>
              <strong>{percent(f.netYield)}</strong>
              <small>Before financing & tax</small>
            </div>
            <div className="metric-card">
              <span>Cash-on-cash</span>
              <strong>{percent(f.cashOnCash)}</strong>
              <small>On {money(f.initialCash)} initial cash</small>
            </div>
          </div>

          <section className="section-card" aria-labelledby="cashflow-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FOLLOW THE MONEY</span>
                <h2 id="cashflow-title">The monthly picture</h2>
              </div>
              <span className="micro">Your scenario · £ / month</span>
            </div>
            <div className="cashflow-list">
              <div className="cashflow-row rent-row">
                <div>
                  <strong>Rental income</strong>
                  <small>Synthetic rent assumption</small>
                </div>
                <strong>{money(f.monthlyRent)}</strong>
              </div>
              {costRows.map((row) => (
                <div className="cashflow-row" key={row.label}>
                  <div>
                    <span>{row.label}</span>
                    <small>{row.note}</small>
                  </div>
                  <span>
                    {row.value > 0 ? "−" : ""}
                    {money(row.value)}
                  </span>
                </div>
              ))}
              <div className="cashflow-total">
                <div>
                  <strong>Monthly cash flow</strong>
                  <small>Before personal or company tax</small>
                </div>
                <strong>{money(f.monthlyCashFlow)}</strong>
              </div>
            </div>
            <p className="micro">
              Net yield = (annual rent − operating costs) ÷ purchase price.
              Cash-on-cash = annual pre-tax cash flow ÷ (deposit + buying
              costs). Ground rent, initial works and unexpected repairs are not
              separately modelled.
            </p>
          </section>

          <section className="section-card" aria-labelledby="score-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">OPEN THE BLACK BOX</span>
                <h2 id="score-title">What is behind the grade?</h2>
              </div>
              <button className="text-button" onClick={showMethod}>
                Methodology <Info size={15} />
              </button>
            </div>
            <p className="muted">
              Five illustrative factors, weighted for{" "}
              <strong>{emphasis.toLowerCase()}</strong>. Expand any row to
              inspect the calculation.
            </p>
            <div className="score-list">
              {score.categories.map((category) => (
                <details className="score-category" key={category.key}>
                  <summary>
                    <div className="category-heading">
                      <span>{category.label}</span>
                      <span>
                        <strong>{Math.round(category.score)}</strong>
                        <small>/100</small>
                        <ChevronDown size={15} />
                      </span>
                    </div>
                    <div className="category-bar">
                      <span style={{ width: `${category.score}%` }} />
                    </div>
                    <div className="category-meta">
                      <span>{category.weight}% weight</span>
                      <span>
                        {category.contribution.toFixed(1)} points of the total
                      </span>
                    </div>
                  </summary>
                  <p>{category.explanation}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="section-card" aria-labelledby="diligence-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">BEFORE YOU GO FURTHER</span>
                <h2 id="diligence-title">What to verify next</h2>
              </div>
            </div>
            <RiskFlags property={property} />
            <div className="risk-notes">
              {!["A", "B", "C"].includes(property.epcRating) && (
                <p>
                  Government plans a higher rental energy standard from October
                  2030. New metrics and exemptions apply. Check current
                  requirements separately.
                </p>
              )}
              <p>
                Flags describe this fictional example. They are prompts for
                diligence, not verified findings.
              </p>
            </div>
            <ol className="diligence-list">
              {diligence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <div className="source-links">
              <span className="micro">
                Official research starting points · not evidence for this
                property
              </span>
              <a
                href="https://www.gov.uk/find-energy-certificate"
                target="_blank"
                rel="noreferrer"
              >
                Check an EPC <ArrowUpRight size={14} />
              </a>
              <a
                href="https://www.gov.uk/check-long-term-flood-risk"
                target="_blank"
                rel="noreferrer"
              >
                Check flood risk <ArrowUpRight size={14} />
              </a>
              <a
                href="https://www.gov.uk/search-property-information-land-registry"
                target="_blank"
                rel="noreferrer"
              >
                Research title & tenure <ArrowUpRight size={14} />
              </a>
            </div>
          </section>

          <Projection rows={f.projection} />
        </div>

        <aside id="assumptions" className="analysis-sidebar">
          <section
            className="section-card assumptions-card"
            aria-labelledby="assumptions-title"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">MAKE IT YOURS</span>
                <h2 id="assumptions-title">Your assumptions</h2>
              </div>
              <SlidersHorizontal size={20} />
            </div>
            <p className="muted">
              This scenario applies to every property and your comparison. Use a
              slider for instant updates; typed values apply on Enter or when
              you leave the field.
            </p>
            <ScenarioField
              label="Deposit"
              field="depositPct"
              value={assumptions.depositPct}
              min={5}
              max={100}
              hint={`${money(f.deposit)} deposit · ${money(f.loan)} loan`}
              onChange={update}
            />
            <ScenarioField
              label="Mortgage rate"
              field="mortgageRate"
              value={assumptions.mortgageRate}
              min={0}
              max={15}
              step={0.1}
              hint="Illustrative rate, fixed for the projection. Not a lending offer."
              onChange={update}
            />
            <div className="assumption-field">
              <span className="field-label" id="mortgage-type-label">
                Mortgage type
              </span>
              <div
                className="segmented-control"
                role="group"
                aria-labelledby="mortgage-type-label"
              >
                <button
                  className={
                    assumptions.mortgageType === "interest-only" ? "active" : ""
                  }
                  aria-pressed={assumptions.mortgageType === "interest-only"}
                  onClick={() =>
                    setAssumptions({
                      ...assumptions,
                      mortgageType: "interest-only",
                    })
                  }
                >
                  Interest-only
                </button>
                <button
                  className={
                    assumptions.mortgageType === "repayment" ? "active" : ""
                  }
                  aria-pressed={assumptions.mortgageType === "repayment"}
                  onClick={() =>
                    setAssumptions({
                      ...assumptions,
                      mortgageType: "repayment",
                    })
                  }
                >
                  Repayment
                </button>
              </div>
              <p className="micro">
                {assumptions.mortgageType === "interest-only"
                  ? "Loan principal remains due at the end of the term."
                  : "Monthly payments include interest and loan principal."}
              </p>
            </div>
            <ScenarioField
              label="Mortgage term"
              field="mortgageTermYears"
              value={assumptions.mortgageTermYears}
              min={10}
              max={40}
              unit="yrs"
              hint="If the loan matures within the projection, the model includes the final repayment."
              onChange={update}
            />
            <ScenarioField
              label="Annual rent growth"
              field="rentGrowth"
              value={assumptions.rentGrowth}
              min={-5}
              max={15}
              step={0.5}
              hint="A future scenario, not a rent forecast."
              onChange={update}
            />
            <ScenarioField
              label="Annual value growth"
              field="valueGrowth"
              value={assumptions.valueGrowth}
              min={-5}
              max={15}
              step={0.5}
              hint="Changes projected property value, not today's cash flow."
              onChange={update}
            />
            <details className="advanced-costs">
              <summary>
                Operating & buying costs <ChevronDown size={16} />
              </summary>
              <ScenarioField
                label="Maintenance reserve"
                field="maintenancePct"
                value={assumptions.maintenancePct}
                min={0}
                max={25}
                unit="%"
                hint="Percentage of gross rent."
                onChange={update}
              />
              <ScenarioField
                label="Letting fee"
                field="lettingFeePct"
                value={assumptions.lettingFeePct}
                min={0}
                max={25}
                unit="%"
                hint="Total assumed management cost, including applicable VAT."
                onChange={update}
              />
              <ScenarioField
                label="Annual insurance"
                field="annualInsurance"
                value={assumptions.annualInsurance}
                min={0}
                max={3000}
                step={60}
                unit="£"
                onChange={update}
              />
              <ScenarioField
                label="Buying costs"
                field="buyingCosts"
                value={assumptions.buyingCosts}
                min={0}
                max={100000}
                step={500}
                unit="£"
                hint="Your allowance for purchase taxes, legal fees and other acquisition costs. No statutory tax calculation."
                onChange={update}
              />
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={assumptions.landlordPaysCouncilTax}
                  onChange={(e) =>
                    setAssumptions({
                      ...assumptions,
                      landlordPaysCouncilTax: e.target.checked,
                    })
                  }
                />
                <span>
                  Landlord pays council tax
                  <small>
                    Include {money(property.annualCouncilTax)} / year for this
                    example. Confirm liability for the actual tenancy.
                  </small>
                </span>
              </label>
            </details>
            <div className="assumption-cash">
              <span>Initial cash required</span>
              <strong>{money(f.initialCash)}</strong>
              <small>
                Deposit + {money(assumptions.buyingCosts)} buying costs
              </small>
            </div>
            <button
              className="text-button full"
              onClick={() => {
                setAssumptions({ ...DEFAULT_ASSUMPTIONS });
                notify("Assumptions reset across all properties.");
              }}
            >
              <RotateCcw size={14} /> Reset assumptions
            </button>
            <div className="notice">
              <Info size={15} />
              <span>
                All property inputs are synthetic. This is a tool for exploring
                the model, not an investment recommendation.
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
