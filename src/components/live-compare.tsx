"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Columns3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { liveFinancials } from "@/lib/live-financials";
import type { LiveCalculation, LiveProperty } from "@/lib/live-types";
import { ListingWarnings } from "./listing-evidence";
import {
  propertyLabel,
  verifiedFact,
  factSource,
  priceLabel,
} from "@/lib/listing-evidence";
import { useLive } from "./live-context";
import {
  LiveAssumptions,
  LiveBack,
  liveDate,
  liveMoney,
  livePercent,
} from "./live-ui";

export function LiveCompare() {
  const { feed, selected, toggle, assumptions, overrides } = useLive();
  const properties = selected
    .map((id) => feed?.properties.find((p) => p.id === id))
    .filter((p): p is LiveProperty => !!p);
  const entries = properties.map((p) => ({
    p,
    c: liveFinancials(p, assumptions, overrides[p.id]),
  }));
  type Entry = { p: LiveProperty; c: LiveCalculation };
  const rows: {
    label: string;
    hint?: string;
    value: (e: Entry) => React.ReactNode;
    strong?: boolean;
  }[] = [
    {
      label: "Listed price",
      value: ({ p }) => (
        <>
          {liveMoney(p.price)}
          <small>{priceLabel(p)}</small>
        </>
      ),
    },
    {
      label: "Your purchase price",
      value: ({ c }) => liveMoney(c.purchasePrice),
      strong: true,
    },
    {
      label: "Monthly rent",
      hint: "Selected estimate or your input",
      value: ({ c }) =>
        c.monthlyRent !== null ? liveMoney(c.monthlyRent) : "Enter rent",
    },
    {
      label: "Gross yield",
      hint: "Annual rent ÷ purchase price",
      value: ({ c }) =>
        c.financials ? livePercent(c.financials.grossYield) : "—",
    },
    {
      label: "Cash flow / month",
      hint: "Pre-tax; excludes unknown costs",
      value: ({ c }) => (
        <>
          <strong
            className={
              c.financials && c.financials.monthlyCashFlow < 0 ? "negative" : ""
            }
          >
            {c.financials ? liveMoney(c.financials.monthlyCashFlow) : "—"}
          </strong>
          <small>
            {c.missingCosts.length
              ? "Before unknown costs"
              : "All modeled costs entered"}
          </small>
        </>
      ),
      strong: true,
    },
    {
      label: "Initial cash",
      hint: "Cash funding + all-in buying costs",
      value: ({ c }) => liveMoney(c.initialCash),
    },
    {
      label: "Monthly mortgage",
      value: ({ c }) =>
        c.financials ? liveMoney(c.financials.monthlyMortgage) : "—",
    },
    {
      label: "Annual service / estate charge",
      value: ({ c }) => {
        const charge = c.annualServiceCharge;
        return charge === null ? (
          <span className="live-unknown">Unknown · excluded</span>
        ) : (
          liveMoney(charge)
        );
      },
    },
    {
      label: "Annual ground rent",
      value: ({ c }) =>
        c.annualGroundRent === null
          ? "Unknown · excluded"
          : liveMoney(c.annualGroundRent, 2),
    },
    {
      label: "Financing",
      value: ({ c }) =>
        c.cashOnly
          ? "Cash purchase only"
          : `${assumptions.depositPct}% deposit · ${assumptions.mortgageRate}% mortgage`,
    },
    {
      label: "Known acquisition fees",
      hint: "Included within all-in allowance",
      value: ({ c }) =>
        c.knownAcquisitionFees
          ? liveMoney(c.knownAcquisitionFees, 2)
          : "None verified · allowance only",
    },
    {
      label: "Rent evidence",
      value: ({ p, c }) => (
        <>
          {c.rentSource}
          {!c.hasUserRent &&
            overrides[p.id]?.rentSource === "agent" &&
            factSource(p, "agentRent") && (
              <small>
                <a
                  href={factSource(p, "agentRent")!.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Agent advert ↗
                </a>{" "}
                · {liveDate(factSource(p, "agentRent")!.retrievedAt)}
              </small>
            )}
          {p.rent &&
            !c.hasUserRent &&
            overrides[p.id]?.rentSource !== "agent" && (
              <small>
                {p.rent.radiusMiles === null
                  ? p.rent.searchPostcode
                  : `${p.rent.searchPostcode} · ${p.rent.radiusMiles.toFixed(1)} miles`}{" "}
                · {liveDate(p.rent.fetchedAt)}
              </small>
            )}
        </>
      ),
    },
    {
      label: "Costs still to confirm",
      value: ({ c }) =>
        c.missingCosts.length ? (
          <span className="live-unknown">{c.missingCosts.join(", ")}</span>
        ) : (
          "No missing modeled costs"
        ),
    },
    {
      label: "EPC / tenure",
      value: ({ p }) =>
        `${verifiedFact<string>(p, "epc") ?? p.epcRating ?? "EPC unknown"} · ${verifiedFact<string>(p, "tenure") ?? p.tenure ?? "tenure unknown"}`,
    },
  ];
  return (
    <main className="live-page live-compare">
      <LiveBack />
      <div className="live-detail-heading">
        <div>
          <div className="live-eyebrow">YOUR SHORTLIST</div>
          <h1>Compare the trade-offs.</h1>
          <p>
            One financing scenario. Each property’s own offer, rent and costs.
          </p>
        </div>
        <Link className="button secondary" href="/live">
          Find more properties <ArrowRight size={15} />
        </Link>
      </div>
      {entries.length < 2 ? (
        <section className="live-state">
          <Columns3 size={34} />
          <h2>
            {entries.length === 1
              ? "Add one more to compare."
              : "Start with a pair of possibilities."}
          </h2>
          <p>
            Shortlist two to four properties to compare their costs and cash
            flow side by side.
          </p>
          {entries[0] && (
            <p>
              <strong>{entries[0].p.address}</strong> is already shortlisted.
            </p>
          )}
          <Link href="/live" className="button primary">
            Explore properties <ArrowRight size={15} />
          </Link>
        </section>
      ) : (
        <>
          <details className="live-compare-assumptions">
            <summary>
              <SlidersHorizontal size={17} />
              <strong>Shared financing</strong>
              <span>
                {assumptions.depositPct}% deposit · {assumptions.mortgageRate}%
                · {assumptions.mortgageType}
              </span>
              <span className="live-edit-scenario">Edit scenario</span>
            </summary>
            <LiveAssumptions />
          </details>
          <div className="live-warning">
            <p>
              Compare cash flow only after confirming missing charges. These
              figures are pre-tax and exclude unknown charges, one-off repairs
              and sale costs. Individual offer, rent and cost inputs can be
              edited on each property.
            </p>
          </div>
          <div className="live-table-scroll live-comparison-wrap">
            <table className="live-comparison-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="live-eyebrow">
                      {entries.length} PROPERTIES
                    </span>
                    <h2>
                      The numbers,
                      <br />
                      side by side.
                    </h2>
                  </th>
                  {entries.map(({ p }) => (
                    <th key={p.id} scope="col">
                      <div className="live-comparison-property">
                        <button
                          aria-label={`Remove ${p.address} from comparison`}
                          className="live-remove"
                          onClick={() => toggle(p.id)}
                        >
                          <X size={17} />
                        </button>
                        <span>
                          {p.postcode} · {p.propertyType}
                        </span>
                        <Link href={`/live/${p.id}`}>
                          <h2>{p.address}</h2>
                        </Link>
                        <p>{propertyLabel(p)}</p>
                        <ListingWarnings property={p} compact />
                        <Link
                          className="live-inline-link"
                          href={`/live/${p.id}`}
                        >
                          Edit inputs &amp; inspect evidence{" "}
                          <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.label}
                    className={row.strong ? "live-comparison-highlight" : ""}
                  >
                    <th scope="row">
                      {row.label}
                      {row.hint && <small>{row.hint}</small>}
                    </th>
                    {entries.map((entry) => (
                      <td key={entry.p.id}>{row.value(entry)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="live-source-line">
            No overall grade is assigned while condition, demand and risk
            evidence is incomplete. Figures use the same calculation as each
            property’s detail page.
          </p>
        </>
      )}
    </main>
  );
}
