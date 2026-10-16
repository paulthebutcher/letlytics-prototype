"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Check,
  Info,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { properties, computeScore } from "@/lib/domain";
import { useApp } from "./app-context";
import { GradeBadge, PropertyArt, money, percent, RiskFlags } from "./ui";

export function Compare() {
  const { selected, toggleSelect, assumptions, emphasis, ready } = useApp();
  const entries = selected.flatMap((id) => {
    const property = properties.find((item) => item.id === id);
    if (!property) return [];
    return [{ property, score: computeScore(property, assumptions, emphasis) }];
  });
  const count = entries.length;
  const first = entries[0];

  const propertyHeading = (entry: (typeof entries)[number]) => (
    <div className="comparison-property">
      <div className="comparison-property-top">
        <div className="comparison-art">
          <PropertyArt property={entry.property} />
        </div>
        <button
          className="icon-button comparison-remove"
          onClick={() => toggleSelect(entry.property.id)}
          aria-label={`Remove ${entry.property.address} from comparison`}
          title="Remove from comparison"
        >
          <X size={16} />
        </button>
      </div>
      <p className="comparison-location">
        {entry.property.neighbourhood} · {entry.property.postcode}
      </p>
      <h2>
        <Link href={`/property/${entry.property.id}`}>
          {entry.property.address}
        </Link>
      </h2>
      <p className="micro">
        {entry.property.bedrooms} bed · {entry.property.propertyType}
      </p>
      <Link
        className="comparison-property-link"
        href={`/property/${entry.property.id}`}
      >
        View scorecard <ArrowRight size={14} />
      </Link>
    </div>
  );

  const section = (title: string, note?: string) => (
    <tr className="comparison-section">
      <th colSpan={count + 1} scope="colgroup">
        {title}
        {note && <span>{note}</span>}
      </th>
    </tr>
  );

  const row = (
    label: string,
    values: ReactNode[],
    options: { note?: string; highlights?: boolean[]; strong?: boolean } = {},
  ) => (
    <tr>
      <th scope="row">
        {label}
        {options.note && <span className="micro">{options.note}</span>}
      </th>
      {values.map((value, index) => (
        <td
          key={entries[index].property.id}
          className={`${options.highlights?.[index] ? "comparison-highlight" : ""} ${options.strong ? "comparison-metric" : ""}`}
        >
          {value}
          {options.highlights?.[index] && (
            <span className="comparison-best">
              <Check size={12} /> Highest in shortlist
            </span>
          )}
        </td>
      ))}
    </tr>
  );

  type FinancialKey =
    "monthlyCashFlow" | "grossYield" | "netYield" | "cashOnCash";
  const financialRow = (
    label: string,
    key: FinancialKey,
    formatter: (value: number) => string,
    note: string,
  ) => {
    const values = entries.map((entry) => entry.score.financials[key]);
    const highest = Math.max(...values);
    // A highlight describes this scenario only; equal figures do not imply a preferred property.
    const varied = new Set(values).size > 1;
    return row(
      label,
      values.map((value) => formatter(value)),
      {
        note,
        strong: key === "monthlyCashFlow",
        highlights: values.map(
          (value) => varied && value > 0 && value === highest,
        ),
      },
    );
  };

  return (
    <div className="compare-page page-shell">
      <Link className="back-link" href="/discover">
        <ArrowLeft size={15} /> Back to Discover
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SHORTLIST</span>
          <h1>A clearer choice, side by side.</h1>
          <p className="muted">
            The same assumptions. The important differences.
          </p>
        </div>
        {count >= 2 && (
          <Link className="button secondary" href="/discover">
            <Plus size={16} />{" "}
            {count < 4 ? "Add a property" : "Explore properties"}
          </Link>
        )}
      </div>

      {!ready ? (
        <div className="comparison-empty" role="status">
          <p>Loading your shortlist…</p>
        </div>
      ) : count < 2 ? (
        <section
          className="comparison-empty"
          aria-labelledby="comparison-empty-title"
        >
          <span className="comparison-empty-icon">
            <ArrowLeftRight size={28} />
          </span>
          <span className="eyebrow">
            {count === 1 ? "ONE MORE TO COMPARE" : "START WITH TWO HOMES"}
          </span>
          <h2 id="comparison-empty-title">
            {count === 1
              ? "Your first property is ready."
              : "Give your shortlist some perspective."}
          </h2>
          <p className="muted">
            {count === 1
              ? "Add one more home to see the cash flow, returns and risks together."
              : "Choose two to four homes in Discover. Compare their numbers with one shared scenario."}
          </p>
          {first && (
            <div className="comparison-preview">
              {propertyHeading(first)}
              <div className="comparison-preview-metrics">
                <GradeBadge grade={first.score.grade} />
                <span>
                  <strong>
                    {money(first.score.financials.monthlyCashFlow)}
                  </strong>
                  <small> / month before tax</small>
                </span>
              </div>
            </div>
          )}
          <div className="comparison-actions">
            <Link className="button primary" href="/discover">
              {count === 1 ? "Find another property" : "Explore Manchester"}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="comparison-scenario">
            <SlidersHorizontal size={19} />
            <div>
              <strong>One scenario across all {count} properties</strong>
              <p>
                {assumptions.depositPct}% deposit · {assumptions.mortgageRate}%
                mortgage ·{" "}
                {assumptions.mortgageType === "interest-only"
                  ? "Interest-only"
                  : `${assumptions.mortgageTermYears}-year repayment`}{" "}
                · {emphasis}
              </p>
            </div>
            <Link href={`/property/${first.property.id}#assumptions`}>
              Edit assumptions <ArrowRight size={14} />
            </Link>
          </div>
          <p className="comparison-legend">
            <span className="comparison-legend-dot" /> Highlighted figures are
            the highest positive values in this shortlist, under your current
            assumptions. They are not recommendations.
          </p>
          <div
            className="comparison-scroll"
            role="region"
            aria-label="Property comparison table, scroll horizontally to see all properties"
            tabIndex={0}
          >
            <table className="comparison-table">
              <caption className="sr-only">
                Comparison of {count} synthetic Manchester properties using a
                shared financing and cost scenario.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="comparison-corner">
                    <span className="eyebrow">{count} OF 4 PROPERTIES</span>
                    <p>
                      The detail behind
                      <br />
                      your decision.
                    </p>
                    <span className="micro">All figures are illustrative.</span>
                  </th>
                  {entries.map((entry) => (
                    <th scope="col" key={entry.property.id}>
                      {propertyHeading(entry)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section("At a glance")}
                {row(
                  "Investment grade",
                  entries.map((entry) => (
                    <div className="comparison-grade">
                      <GradeBadge grade={entry.score.grade} />
                      <span>
                        {entry.score.total.toFixed(2)}
                        <small> / 100</small>
                      </span>
                    </div>
                  )),
                  { note: `${emphasis} weighting` },
                )}
                {row(
                  "Asking price",
                  entries.map((entry) => money(entry.property.price)),
                )}
                {row(
                  "Estimated monthly rent",
                  entries.map((entry) => money(entry.property.monthlyRent)),
                  { note: "Synthetic estimate" },
                )}
                {section("The economics", "Before tax")}
                {financialRow(
                  "Monthly cash flow",
                  "monthlyCashFlow",
                  money,
                  "After operating costs and mortgage",
                )}
                {financialRow(
                  "Gross rental yield",
                  "grossYield",
                  percent,
                  "Annual rent ÷ purchase price",
                )}
                {financialRow(
                  "Net operating yield",
                  "netYield",
                  percent,
                  "Before financing and tax",
                )}
                {financialRow(
                  "Cash-on-cash return",
                  "cashOnCash",
                  percent,
                  "Annual cash flow ÷ initial cash",
                )}
                {row(
                  "Initial cash required",
                  entries.map((entry) =>
                    money(entry.score.financials.initialCash),
                  ),
                  {
                    note: `Deposit + ${money(assumptions.buyingCosts)} buying-cost allowance`,
                  },
                )}
                {row(
                  "Monthly mortgage",
                  entries.map((entry) =>
                    money(entry.score.financials.monthlyMortgage),
                  ),
                )}
                {row(
                  "Monthly operating costs",
                  entries.map((entry) =>
                    money(
                      entry.score.financials.monthlyCosts -
                        entry.score.financials.monthlyMortgage,
                    ),
                  ),
                  { note: "Includes reserves and service charges" },
                )}
                {section(
                  "Why the grades differ",
                  "Each category is scored out of 100",
                )}
                {first.score.categories.map((category) => (
                  <tr key={category.key}>
                    <th scope="row">
                      {category.label}
                      <span className="micro">
                        {category.weight}% of the overall grade
                      </span>
                    </th>
                    {entries.map((entry) => {
                      const item = entry.score.categories.find(
                        (value) => value.key === category.key,
                      )!;
                      return (
                        <td key={entry.property.id}>
                          <div className="comparison-score">
                            <span>
                              {Math.round(item.score)}
                              <small> / 100</small>
                            </span>
                            <div className="comparison-bar" aria-hidden="true">
                              <span style={{ width: `${item.score}%` }} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {section(
                  "Risks & ownership",
                  "A high grade does not remove a risk",
                )}
                {row(
                  "Energy performance",
                  entries.map((entry) => `EPC ${entry.property.epcRating}`),
                )}
                {row(
                  "Tenure",
                  entries.map((entry) =>
                    entry.property.tenure === "freehold"
                      ? "Freehold"
                      : "Leasehold",
                  ),
                )}
                {row(
                  "Annual service charge",
                  entries.map((entry) =>
                    money(entry.property.annualServiceCharge),
                  ),
                )}
                {row(
                  "Flood scenario",
                  entries.map(
                    (entry) =>
                      entry.property.floodRisk.charAt(0).toUpperCase() +
                      entry.property.floodRisk.slice(1),
                  ),
                  { note: "Synthetic, not a property assessment" },
                )}
                {row(
                  "Points to check",
                  entries.map((entry) => (
                    <RiskFlags property={entry.property} compact />
                  )),
                )}
              </tbody>
            </table>
          </div>
          <div className="comparison-notes">
            <div className="comparison-note">
              <Info size={19} />
              <div>
                <h2>What to verify next</h2>
                <p>
                  Confirm achievable rent with local comparables, the property's
                  condition, EPC improvement costs and any leasehold charges.
                  Check financing, title and licensing before making a decision.
                </p>
              </div>
            </div>
            <p className="micro">
              All properties and inputs are synthetic. Buying costs are an
              editable allowance, not a tax calculation. Figures exclude
              personal or company taxes and are not forecasts.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
