"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  SlidersHorizontal,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { liveFinancials } from "@/lib/live-financials";
import { useLive } from "./live-context";
import {
  PropertyPhoto,
  NumericField,
  ShortlistButton,
  liveMoney,
  livePercent,
} from "./live-ui";
const LiveMap = dynamic(() => import("./live-map"), {
  ssr: false,
  loading: () => <div className="live-map-loading">Loading map…</div>,
});

export function LiveDiscover() {
  const {
    feed,
    assumptions,
    setAssumptions,
    overrides,
    filters,
    setFilters,
    selected,
  } = useLive();
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const mapPanel = useRef<HTMLElement>(null);
  const locateProperty = (id: string) => {
    setFilters({ map: true });
    setFocused(id);
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        mapPanel.current?.scrollIntoView({ block: "center", behavior: "auto" });
      }
    });
  };
  useEffect(() => {
    if (!focused || !filters.map || !resultList.current) return;
    const list = resultList.current;
    const card = list.querySelector<HTMLElement>(
      `[data-property-id="${focused}"]`,
    );
    if (!card) return;
    const bounds = list.getBoundingClientRect();
    const item = card.getBoundingClientRect();
    if (item.top < bounds.top || item.bottom > bounds.bottom) {
      list.scrollBy({ top: item.top - bounds.top - 10, behavior: "auto" });
    }
  }, [focused, filters.map]);
  const entries = useMemo(
    () =>
      (feed?.properties ?? [])
        .map((property) => ({
          property,
          calculation: liveFinancials(
            property,
            assumptions,
            overrides[property.id],
          ),
        }))
        .filter(({ property: p }) => {
          const query = filters.query.toLowerCase().trim();
          return (
            (!shortlistOnly || selected.includes(p.id)) &&
            (!query ||
              `${p.address} ${p.postcode}`.toLowerCase().includes(query)) &&
            (filters.type === "all" || p.propertyType === filters.type) &&
            (filters.budget === "all" || p.price <= Number(filters.budget))
          );
        })
        .sort((a, b) =>
          filters.sort === "cashflow"
            ? (b.calculation.financials?.monthlyCashFlow ?? -Infinity) -
              (a.calculation.financials?.monthlyCashFlow ?? -Infinity)
            : filters.sort === "yield"
              ? (b.calculation.financials?.grossYield ?? -Infinity) -
                (a.calculation.financials?.grossYield ?? -Infinity)
              : a.property.price - b.property.price,
        ),
    [feed, assumptions, overrides, filters, shortlistOnly, selected],
  );
  const mapProperties = useMemo(
    () => entries.map((e) => e.property),
    [entries],
  );
  const focusProperty = entries.find(
    (e) => e.property.id === focused,
  )?.property;
  const withRent = feed?.properties.filter((p) => p.rent).length ?? 0;
  return (
    <main className="live-page">
      <section className="live-discover-heading">
        <div>
          <div className="live-eyebrow">BUY-TO-LET WORKSPACE</div>
          <h1>{feed.market} investment properties</h1>
          <p>Screen the opportunity. Test your offer. Check the evidence.</p>
        </div>
        <div className="live-coverage">
          <strong>{feed.properties.length}</strong> listings <span>·</span>{" "}
          <strong>{withRent}</strong> with rent evidence
        </div>
      </section>
      <details className="live-finance-strip">
        <summary>
          <span>
            <SlidersHorizontal size={16} /> Screening scenario
          </span>
          <strong>
            {assumptions.depositPct}% deposit · {assumptions.mortgageRate}%{" "}
            {assumptions.mortgageType}
            {assumptions.mortgageType === "repayment"
              ? ` · ${assumptions.mortgageTermYears} years`
              : ""}
          </strong>
          <span className="live-finance-edit">Edit financing</span>
        </summary>
        <div className="live-finance-fields">
          <NumericField
            label="Deposit"
            value={assumptions.depositPct}
            suffix="%"
            max={100}
            onChange={(v) =>
              setAssumptions({ depositPct: v ?? assumptions.depositPct })
            }
          />
          <NumericField
            label="Mortgage rate"
            value={assumptions.mortgageRate}
            suffix="%"
            max={25}
            step={0.1}
            onChange={(v) =>
              setAssumptions({ mortgageRate: v ?? assumptions.mortgageRate })
            }
          />
          <label className="live-finance-type">
            Mortgage type
            <select
              value={assumptions.mortgageType}
              onChange={(e) =>
                setAssumptions({
                  mortgageType: e.target
                    .value as typeof assumptions.mortgageType,
                })
              }
            >
              <option value="interest-only">Interest only</option>
              <option value="repayment">Repayment</option>
            </select>
          </label>
          {assumptions.mortgageType === "repayment" && (
            <NumericField
              label="Mortgage term"
              value={assumptions.mortgageTermYears}
              suffix="years"
              min={1}
              max={40}
              onChange={(v) =>
                setAssumptions({
                  mortgageTermYears: v ?? assumptions.mortgageTermYears,
                })
              }
            />
          )}
          <p>
            Applies across your shortlist. Set property-specific offers, rent
            and charges in the analysis.
          </p>
        </div>
      </details>
      <div className="live-workspace">
        <div className="live-toolbar">
          <label className="live-search">
            <Search size={17} />
            <input
              aria-label="Search properties"
              placeholder="Search street or postcode"
              value={filters.query}
              onChange={(event) => setFilters({ query: event.target.value })}
            />
            {filters.query && (
              <button
                aria-label="Clear search"
                onClick={() => setFilters({ query: "" })}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <label className="live-filter">
            Type
            <select
              aria-label="Property type"
              value={filters.type}
              onChange={(event) => setFilters({ type: event.target.value })}
            >
              <option value="all">All properties</option>
              {["Flat", "Terraced", "Semi-detached", "Detached"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="live-filter">
            Budget
            <select
              aria-label="Maximum asking price"
              value={filters.budget}
              onChange={(event) => setFilters({ budget: event.target.value })}
            >
              <option value="all">Any price</option>
              {[150000, 200000, 250000, 350000, 500000].map((amount) => (
                <option key={amount} value={amount}>
                  Up to {liveMoney(amount)}
                </option>
              ))}
            </select>
          </label>
          <div className="live-view-switch">
            <button
              className={filters.map ? "active" : ""}
              aria-pressed={filters.map}
              onClick={() => setFilters({ map: true })}
            >
              <MapIcon size={15} />
              Map
            </button>
            <button
              className={!filters.map ? "active" : ""}
              aria-pressed={!filters.map}
              onClick={() => setFilters({ map: false })}
            >
              <List size={15} />
              List
            </button>
          </div>
        </div>
        <div className={`live-discovery-grid ${!filters.map ? "no-map" : ""}`}>
          <section className="live-results">
            <div className="live-results-heading">
              <div className="live-result-tabs">
                <button
                  className={!shortlistOnly ? "active" : ""}
                  aria-pressed={!shortlistOnly}
                  onClick={() => setShortlistOnly(false)}
                >
                  All properties
                </button>
                <button
                  className={shortlistOnly ? "active" : ""}
                  aria-pressed={shortlistOnly}
                  onClick={() => setShortlistOnly(true)}
                >
                  Shortlist <span>{selected.length}</span>
                </button>
                <span className="live-result-count">
                  {entries.length} results
                </span>
              </div>
              <label>
                Sort by
                <select
                  aria-label="Sort properties"
                  value={filters.sort}
                  onChange={(event) => setFilters({ sort: event.target.value })}
                >
                  <option value="price">Lowest asking price</option>
                  <option value="cashflow">
                    Cash flow (excludes missing costs)
                  </option>
                  <option value="yield">Gross yield</option>
                </select>
              </label>
            </div>
            <div className="live-results-list" ref={resultList}>
              {entries.map(({ property: p, calculation: c }) => (
                <article
                  className={`live-property-card ${focused === p.id ? "focused" : ""}`}
                  key={p.id}
                  data-property-id={p.id}
                >
                  <Link href={`/live/${p.id}`} className="live-property-main">
                    <PropertyPhoto property={p} />
                    <div>
                      <span className="live-property-location">
                        {p.postcode} · {p.propertyType}
                        {p.bedrooms !== null ? ` · ${p.bedrooms} bed` : ""}
                      </span>
                      <h2>{p.address}</h2>
                      <div className="live-card-metrics">
                        <span>
                          <strong>{liveMoney(p.price)}</strong>asking price
                        </span>
                        <span>
                          <strong>
                            {c.monthlyRent !== null
                              ? `${liveMoney(c.monthlyRent)}/mo`
                              : "—"}
                          </strong>
                          {c.hasUserRent
                            ? "your rent"
                            : p.rent
                              ? "asking-rent estimate"
                              : "rent to verify"}
                        </span>
                        <span>
                          <strong>
                            {c.financials
                              ? livePercent(c.financials.grossYield)
                              : "—"}
                          </strong>
                          gross yield
                        </span>
                        <span className="live-card-cashflow">
                          <strong
                            className={
                              c.financials && c.financials.monthlyCashFlow < 0
                                ? "negative"
                                : ""
                            }
                          >
                            {c.financials
                              ? `${liveMoney(c.financials.monthlyCashFlow)}`
                              : "—"}
                          </strong>
                          {c.missingCosts.length
                            ? "/mo before missing costs"
                            : "/mo pre-tax cash flow"}
                        </span>
                      </div>
                      {c.purchasePrice !== p.price && (
                        <p className="live-small">
                          Scenario uses your {liveMoney(c.purchasePrice)} offer.
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="live-property-bottom">
                    <div className="live-card-checks">
                      {!c.financials && (
                        <Link href={`/live/${p.id}#scenario-rent`}>
                          Add rent <ArrowRight size={12} />
                        </Link>
                      )}
                      {c.missingCosts.length > 0 && (
                        <Link
                          href={`/live/${p.id}#${(overrides[p.id]?.annualServiceCharge ?? p.annualServiceCharge) === null ? "scenario-charge" : "scenario-council-tax"}`}
                        >
                          Confirm charges <ArrowRight size={12} />
                        </Link>
                      )}
                      {c.financials && c.financials.grossYield >= 12 && (
                        <Link href={`/live/${p.id}#price-check`}>
                          Check price &amp; rent <ArrowRight size={12} />
                        </Link>
                      )}
                      {c.financials && !c.missingCosts.length && (
                        <span>
                          <Check size={13} /> Costs supplied
                        </span>
                      )}
                    </div>
                    <button
                      className="live-locate"
                      aria-label={`Locate ${p.address} on map`}
                      onClick={() => locateProperty(p.id)}
                    >
                      <MapPin size={14} />
                    </button>
                    <ShortlistButton property={p} compact />
                  </div>
                </article>
              ))}
              {entries.length === 0 && (
                <div className="live-empty">
                  <Search size={26} />
                  <h3>No properties match.</h3>
                  <p>Broaden your search or budget.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setFilters({ query: "", type: "all", budget: "all" });
                      setShortlistOnly(false);
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
          {filters.map && (
            <section
              ref={mapPanel}
              className="live-map-panel"
              aria-label="Map of properties"
            >
              <LiveMap
                properties={mapProperties}
                focused={focused}
                onFocus={setFocused}
              />
              {focusProperty && (
                <div className="live-map-preview">
                  <button
                    className="live-map-close"
                    aria-label="Close map preview"
                    onClick={() => setFocused(null)}
                  >
                    <X size={16} />
                  </button>
                  <PropertyPhoto
                    key={focusProperty.id}
                    property={focusProperty}
                  />
                  <div className="live-map-preview-copy">
                    <span>
                      {focusProperty.postcode} · {focusProperty.propertyType}
                    </span>
                    <strong>{focusProperty.address}</strong>
                    <div>
                      <b>{liveMoney(focusProperty.price)}</b>
                      <Link href={`/live/${focusProperty.id}`}>
                        Test the numbers <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      <div className="live-discovery-footnote">
        <p>
          {feed?.scope ??
            "Selected investment listings, not complete market coverage."}{" "}
          Screening figures use {assumptions.depositPct}% deposit and{" "}
          {assumptions.mortgageRate}% {assumptions.mortgageType} finance.
          Unknown service / estate charges are excluded until supplied.
        </p>
        <a href="https://propertydata.co.uk" target="_blank" rel="noreferrer">
          PropertyData <ArrowUpRight size={13} />
        </a>
      </div>
      {!!feed.warnings.length && (
        <details className="live-feed-warnings">
          <summary>Data availability notes</summary>
          {feed?.warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </details>
      )}
    </main>
  );
}
