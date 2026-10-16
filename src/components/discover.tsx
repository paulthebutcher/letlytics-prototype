"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  MapPin,
  List,
  Map as MapIcon,
  X,
  CircleHelp,
} from "lucide-react";
import {
  properties,
  computeScore,
  EMPHASIS_PRESETS,
  type Emphasis,
  type Property,
} from "@/lib/domain";
import { useApp } from "./app-context";
import { GradeBadge, PropertyArt, RiskFlags, money, percent } from "./ui";
const MarketMap = dynamic(() => import("./market-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <MapPin />
      <span>Opening Manchester map…</span>
    </div>
  ),
});
export function Discover() {
  const {
    assumptions,
    emphasis,
    setEmphasis,
    selected,
    toggleSelect,
    showMethod,
    discovery,
    setDiscovery,
  } = useApp();
  const { query, grade, budget, sort, view } = discovery;
  const setQuery = (query: string) => setDiscovery({ ...discovery, query });
  const setGrade = (grade: string) => setDiscovery({ ...discovery, grade });
  const setBudget = (budget: string) => setDiscovery({ ...discovery, budget });
  const setSort = (sort: string) => setDiscovery({ ...discovery, sort });
  const setView = (view: string) => setDiscovery({ ...discovery, view });
  const [focused, setFocused] = useState<string | null>(null);
  const scored = useMemo(
    () =>
      properties.map((p) => ({
        property: p,
        score: computeScore(p, assumptions, emphasis),
      })),
    [assumptions, emphasis],
  );
  const filtered = useMemo(
    () =>
      scored
        .filter(
          ({ property: p, score: s }) =>
            (!query ||
              `${p.neighbourhood} ${p.postcode} ${p.address}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (grade === "all" ||
              (grade === "AB"
                ? ["A", "B"].includes(s.grade)
                : s.grade === grade)) &&
            (budget === "all" || p.price <= Number(budget)),
        )
        .sort((a, b) =>
          sort === "yield"
            ? b.score.financials.grossYield - a.score.financials.grossYield
            : sort === "cashflow"
              ? b.score.financials.monthlyCashFlow -
                a.score.financials.monthlyCashFlow
              : sort === "price"
                ? a.property.price - b.property.price
                : b.score.total - a.score.total,
        ),
    [scored, query, grade, budget, sort],
  );
  const median = [...scored].sort(
    (a, b) => a.score.financials.grossYield - b.score.financials.grossYield,
  )[Math.floor(scored.length / 2)].score.financials.grossYield;
  const selectedProperty = filtered.find((v) => v.property.id === focused);
  return (
    <div className="page discover-page">
      <section className="discover-intro">
        <div>
          <div className="eyebrow">
            <span className="tiny-rule" /> THE MANCHESTER EDIT
          </div>
          <h1>
            Find the potential.
            <br />
            <span>Understand the trade-offs.</span>
          </h1>
          <p>
            A clearer first look at your next buy-to-let.
            <br className="desktop-only" /> Explore the numbers. Make the
            assumptions yours.
          </p>
        </div>
        <div className="market-summary">
          <div className="market-summary-heading">
            <MapPin size={15} /> Greater Manchester <span>DEMO MARKET</span>
          </div>
          <div className="summary-numbers">
            <div>
              <strong>{properties.length}</strong>
              <span>example properties</span>
            </div>
            <div>
              <strong>
                {
                  scored.filter((v) => ["A", "B"].includes(v.score.grade))
                    .length
                }
                <small>/{properties.length}</small>
              </strong>
              <span>graded A or B</span>
            </div>
            <div>
              <strong>{percent(median)}</strong>
              <span>median gross yield</span>
            </div>
          </div>
          <p>Illustrative scenarios, not a snapshot of today’s market.</p>
        </div>
      </section>
      <section className="workspace" aria-label="Property discovery">
        <div className="workspace-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search Manchester areas"
              placeholder="Search area or postcode"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </label>
          <div className="filter-control">
            <label htmlFor="grade-filter">Grade</label>
            <select
              id="grade-filter"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="all">All grades</option>
              <option value="AB">A & B only</option>
              {["A", "B", "C", "D", "F"].map((g) => (
                <option key={g} value={g}>
                  {g} only
                </option>
              ))}
            </select>
          </div>
          <div className="filter-control">
            <label htmlFor="budget-filter">Budget</label>
            <select
              id="budget-filter"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              <option value="all">Any price</option>
              <option value="175000">Up to £175k</option>
              <option value="225000">Up to £225k</option>
              <option value="300000">Up to £300k</option>
              <option value="400000">Up to £400k</option>
            </select>
          </div>
          <div className="view-switch" aria-label="View layout">
            <button
              className={view === "split" ? "active" : ""}
              aria-label="Show map and list"
              aria-pressed={view === "split"}
              onClick={() => setView("split")}
            >
              <MapIcon size={17} />
              <span>Map</span>
            </button>
            <button
              className={view === "list" ? "active" : ""}
              aria-label="Show list only"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={17} />
              <span>List</span>
            </button>
          </div>
        </div>
        <div className="emphasis-bar">
          <div className="emphasis-label">
            <SlidersHorizontal size={15} />
            <strong>What matters to you?</strong>
          </div>
          <div className="emphasis-options">
            {(Object.keys(EMPHASIS_PRESETS) as Emphasis[]).map((v) => (
              <button
                key={v}
                onClick={() => setEmphasis(v)}
                className={emphasis === v ? "active" : ""}
                aria-pressed={emphasis === v}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            className="help-link"
            onClick={showMethod}
            aria-label="How emphasis changes scoring"
          >
            <CircleHelp size={17} />
          </button>
        </div>
        <div className={`discovery-grid ${view === "list" ? "list-only" : ""}`}>
          <div className="results">
            <div className="results-heading">
              <span>
                <strong>{filtered.length}</strong> properties{" "}
                <span className="muted">to explore</span>
              </span>
              <label>
                Sort by{" "}
                <select
                  aria-label="Sort properties"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="score">Best score</option>
                  <option value="cashflow">Cash flow</option>
                  <option value="yield">Gross yield</option>
                  <option value="price">Lowest price</option>
                </select>
              </label>
            </div>
            <div className="results-list">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <Search size={30} />
                  <h2>No properties match just yet.</h2>
                  <p>Try another Manchester area or widen your filters.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setDiscovery({
                        ...discovery,
                        query: "",
                        budget: "all",
                        grade: "all",
                      });
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                filtered.map(({ property: p, score: s }, index) => (
                  <article
                    key={p.id}
                    className={`property-card ${focused === p.id ? "focused" : ""}`}
                    onMouseEnter={() => setFocused(p.id)}
                  >
                    <Link className="property-main" href={`/property/${p.id}`}>
                      <PropertyArt property={p} />
                      <div className="property-content">
                        <div className="property-topline">
                          <span className="micro">
                            {p.neighbourhood}{" "}
                            <span className="dot-separator">·</span>{" "}
                            {p.postcode.split(" ")[0]}
                          </span>
                          <GradeBadge grade={s.grade} />
                        </div>
                        <h2>
                          {p.bedrooms}-bed {p.propertyType.toLowerCase()}
                        </h2>
                        <p className="property-address">{p.address}</p>
                        <div className="property-metrics">
                          <div>
                            <strong>{money(p.price)}</strong>
                            <span>asking price</span>
                          </div>
                          <div>
                            <strong>{percent(s.financials.grossYield)}</strong>
                            <span>gross yield</span>
                          </div>
                          <div>
                            <strong
                              className={
                                s.financials.monthlyCashFlow >= 0
                                  ? "positive-text"
                                  : "negative-text"
                              }
                            >
                              {money(s.financials.monthlyCashFlow)}
                              <small>/mo</small>
                            </strong>
                            <span>pre-tax cash flow</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="property-bottom">
                      <RiskFlags property={p} compact />
                      <button
                        className={`save-button ${selected.includes(p.id) ? "selected" : ""}`}
                        aria-label={`${selected.includes(p.id) ? "Remove" : "Shortlist"} ${p.address}`}
                        aria-pressed={selected.includes(p.id)}
                        onClick={() => toggleSelect(p.id)}
                      >
                        {selected.includes(p.id) ? (
                          <Check size={15} />
                        ) : (
                          <Bookmark size={15} />
                        )}
                        <span>
                          {selected.includes(p.id)
                            ? "Shortlisted"
                            : "Shortlist"}
                        </span>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="result-note">
              All figures use your scenario: {assumptions.depositPct}% deposit ·{" "}
              {assumptions.mortgageRate}% rate · {assumptions.mortgageType}.
            </div>
          </div>
          {view === "split" && (
            <div className="map-panel">
              <MarketMap
                entries={filtered}
                focused={focused}
                onFocus={setFocused}
              />
              <div className="map-top-label">
                <span className="status-dot" /> {emphasis} scoring{" "}
                <span>·</span> {filtered.length} homes
              </div>
              <div className="map-legend">
                <span>Illustrative grade</span>
                {["A", "B", "C", "D", "F"].map((g) => (
                  <span key={g} className={`legend-item grade-${g}`}>
                    {g}
                  </span>
                ))}
              </div>
              {selectedProperty && (
                <div className="map-preview">
                  <button
                    className="map-preview-close"
                    aria-label="Close selected property"
                    onClick={() => setFocused(null)}
                  >
                    <X size={16} />
                  </button>
                  <GradeBadge grade={selectedProperty.score.grade} />
                  <div>
                    <strong>
                      {selectedProperty.property.bedrooms}-bed{" "}
                      {selectedProperty.property.propertyType.toLowerCase()} ·{" "}
                      {selectedProperty.property.neighbourhood}
                    </strong>
                    <span>
                      {money(selectedProperty.property.price)} ·{" "}
                      {percent(selectedProperty.score.financials.grossYield)}{" "}
                      gross yield
                    </span>
                    <Link href={`/property/${selectedProperty.property.id}`}>
                      Explore this property <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <div className="under-workspace">
        <span>
          <span className="small-ring" /> A grade starts a conversation. It
          doesn’t replace due diligence.
        </span>
        <button onClick={showMethod}>
          See what’s behind the scores <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
