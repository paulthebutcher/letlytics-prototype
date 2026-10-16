"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { liveFinancials } from "@/lib/live-financials";
import { useLive } from "./live-context";
import {
  LiveIllustration,
  ShortlistButton,
  liveMoney,
  livePercent,
} from "./live-ui";
const LiveMap = dynamic(() => import("./live-map"), {
  ssr: false,
  loading: () => <div className="live-map-loading">Loading map…</div>,
});

export function LiveDiscover() {
  const { feed, assumptions, overrides, filters, setFilters } = useLive();
  const [focused, setFocused] = useState<string | null>(null);
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
    [feed, assumptions, overrides, filters],
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
      <section className="live-intro">
        <div>
          <div className="live-eyebrow">PROPERTY EXPLORER</div>
          <h1>
            Real properties.
            <br />
            <span>Clearer next moves.</span>
          </h1>
          <p>Find a candidate, test your numbers, then check the evidence.</p>
        </div>
        <div className="live-market-card">
          <div>
            <MapPin size={15} />
            <strong>{feed?.market ?? "Manchester"}</strong>
            <span>Selected opportunities</span>
          </div>
          <div className="live-market-stats">
            <span>
              <strong>{feed?.properties.length ?? "—"}</strong>asking-price
              listings
            </span>
            <span>
              <strong>{withRent}</strong>
              with rental evidence
            </span>
          </div>
        </div>
      </section>
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
        <div className="live-workspace-note">
          <span>
            <Check size={14} />
            Start with a real asking price. Adjust the offer and rent to suit
            your strategy.
          </span>
        </div>
        <div className={`live-discovery-grid ${!filters.map ? "no-map" : ""}`}>
          <section className="live-results">
            <div className="live-results-heading">
              <strong>
                {entries.length}{" "}
                {entries.length === 1 ? "property" : "properties"}
              </strong>
              <label>
                Sort by
                <select
                  aria-label="Sort properties"
                  value={filters.sort}
                  onChange={(event) => setFilters({ sort: event.target.value })}
                >
                  <option value="price">Lowest asking price</option>
                  <option value="cashflow">
                    Cash flow before unknown costs
                  </option>
                  <option value="yield">Gross yield</option>
                </select>
              </label>
            </div>
            <div className="live-results-list">
              {entries.map(({ property: p, calculation: c }) => (
                <article
                  className={`live-property-card ${focused === p.id ? "focused" : ""}`}
                  key={p.id}
                >
                  <Link href={`/live/${p.id}`} className="live-property-main">
                    <LiveIllustration flat={p.propertyType === "Flat"} />
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
                        {c.financials && (
                          <span>
                            <strong>
                              {livePercent(c.financials.grossYield)}
                            </strong>
                            gross yield
                          </span>
                        )}
                      </div>
                      {c.purchasePrice !== p.price && (
                        <p className="live-small">
                          Scenario uses your {liveMoney(c.purchasePrice)} offer.
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="live-property-bottom">
                    <span
                      className={`live-readiness ${c.missingCosts.length ? "caution" : ""}`}
                    >
                      {c.financials
                        ? `${liveMoney(c.financials.monthlyCashFlow)}/mo ${c.missingCosts.length ? "before unknown costs" : "pre-tax cash flow"}`
                        : "Add rent to test cash flow"}
                    </span>
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
                    onClick={() =>
                      setFilters({ query: "", type: "all", budget: "all" })
                    }
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
          {filters.map && (
            <section className="live-map-panel" aria-label="Map of properties">
              <LiveMap
                properties={mapProperties}
                focused={focused}
                onFocus={setFocused}
              />
              <div className="live-map-label">
                <MapPin size={13} />
                Asking prices · approximate locations
              </div>
              {focusProperty && (
                <div className="live-map-preview">
                  <button
                    className="live-map-close"
                    aria-label="Close map preview"
                    onClick={() => setFocused(null)}
                  >
                    <X size={16} />
                  </button>
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
