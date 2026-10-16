"use client";
import { useEffect } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  FileSearch,
  MapPin,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { liveFinancials } from "@/lib/live-financials";
import { useLive } from "./live-context";
import {
  PropertyPhoto,
  focusScenarioField,
  LiveAssumptions,
  LiveBack,
  LiveState,
  ShortlistButton,
  liveDate,
  liveMoney,
  livePercent,
} from "./live-ui";
import { LiveSales } from "./live-sales";

export function LiveAnalysis({ id }: { id: string }) {
  const { feed, assumptions, overrides } = useLive();
  const property = feed?.properties.find((p) => p.id === id);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("scenario-")) focusScenarioField(hash);
  }, [id]);
  if (!property)
    return (
      <main className="live-page">
        <LiveBack />
        <LiveState
          title="This property isn’t in the current selection."
          detail="The selection may have changed since it was saved. Choose another property from the explorer."
        />
      </main>
    );
  const p = property;
  const override = overrides[id] ?? {};
  const calculation = liveFinancials(p, assumptions, override);
  const f = calculation.financials;
  const hasMissing = calculation.missingCosts.length > 0;
  const missingCount =
    calculation.missingCosts.length +
    (calculation.monthlyRent === null ? 1 : 0);
  const serviceCharge = override.annualServiceCharge ?? p.annualServiceCharge;
  const deposit = (calculation.purchasePrice * assumptions.depositPct) / 100;
  const costs: { label: string; detail?: string; amount: number | null }[] = f
    ? [
        {
          label: "Mortgage",
          detail: `${assumptions.mortgageRate}% · ${assumptions.mortgageType}`,
          amount: f.monthlyMortgage,
        },
        {
          label: "Management",
          detail: `${assumptions.lettingFeePct}% of rent`,
          amount: f.monthlyLettingFee,
        },
        {
          label: "Maintenance allowance",
          detail: `${assumptions.maintenancePct}% of rent`,
          amount: f.monthlyMaintenance,
        },
        {
          label: "Vacancy allowance",
          detail: `${override.vacancyPct ?? 5}% of rent · assumption`,
          amount: f.monthlyVacancy,
        },
        { label: "Insurance", amount: f.monthlyInsurance },
        {
          label: "Service / estate charge",
          detail:
            serviceCharge === null
              ? "Excluded until supplied"
              : override.annualServiceCharge !== undefined
                ? "Your input"
                : "Listing data",
          amount: serviceCharge === null ? null : f.monthlyServiceCharge,
        },
        ...(assumptions.landlordPaysCouncilTax
          ? [
              {
                label: "Council tax",
                detail:
                  (override.annualCouncilTax ?? p.annualCouncilTax) === null
                    ? "Excluded until supplied"
                    : "Landlord pays",
                amount:
                  (override.annualCouncilTax ?? p.annualCouncilTax) === null
                    ? null
                    : f.monthlyCouncilTax,
              },
            ]
          : []),
      ]
    : [];
  return (
    <main className="live-page live-detail">
      <LiveBack />
      <div className="live-detail-heading">
        <div className="live-detail-identity">
          <PropertyPhoto key={p.id} property={p} hero />
          <div>
            <div className="live-eyebrow">
              <MapPin size={13} />
              {p.postcode}
            </div>
            <h1>{p.address}</h1>
            <p>
              {p.propertyType} ·{" "}
              {p.bedrooms === null
                ? "Bedrooms not supplied"
                : `${p.bedrooms} ${p.bedrooms === 1 ? "bedroom" : "bedrooms"}`}
              {p.floorAreaSqFt
                ? ` · ${p.floorAreaSqFt.toLocaleString("en-GB")} sq ft`
                : ""}
            </p>
            <div className="live-detail-facts">
              <span>
                EPC <b>{p.epcRating ?? "To confirm"}</b>
              </span>
              <span>
                Tenure <b>{p.tenure ?? "To confirm"}</b>
              </span>
              {p.daysOnMarket !== null && (
                <span>
                  <b>{p.daysOnMarket}</b> days listed
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="live-detail-actions">
          {p.listingUrl && (
            <a
              href={p.listingUrl}
              target="_blank"
              rel="noreferrer"
              className="button secondary"
            >
              View original listing <ArrowUpRight size={15} />
            </a>
          )}
          <ShortlistButton property={p} />
        </div>
      </div>
      <div className="live-detail-layout">
        <div className="live-detail-main">
          <section className="live-decision-card">
            <div>
              <span className="live-eyebrow">YOUR PURCHASE SCENARIO</span>
              <div className="live-price-pair">
                <span>
                  <small>Asking price</small>
                  <strong>{liveMoney(p.price)}</strong>
                </span>
                <ArrowDownRight size={24} />
                <span>
                  <small>Your offer / purchase price</small>
                  <strong>{liveMoney(calculation.purchasePrice)}</strong>
                </span>
              </div>
              <button
                onClick={() => focusScenarioField("scenario-offer")}
                className="live-scenario-jump"
              >
                Adjust offer &amp; financing <SlidersHorizontal size={13} />
              </button>
            </div>
            <div className="live-cashflow-hero">
              <span>
                {hasMissing
                  ? "Cash flow before unknown costs"
                  : "Estimated pre-tax cash flow"}
              </span>
              <strong className={f && f.monthlyCashFlow < 0 ? "negative" : ""}>
                {f ? liveMoney(f.monthlyCashFlow) : "—"}
                <small>/mo</small>
              </strong>
              <p>
                {f
                  ? `${assumptions.depositPct}% deposit · ${assumptions.mortgageRate}% ${assumptions.mortgageType}`
                  : "Enter an achievable rent to test cash flow."}
              </p>
            </div>
          </section>
          <div className="live-next-checks" aria-label="Next checks">
            <div className="live-checks-heading">
              <CircleHelp size={16} />
              <strong>Before you take this further</strong>
              <span>
                {missingCount} missing {missingCount === 1 ? "input" : "inputs"}
              </span>
            </div>
            {serviceCharge === null && (
              <button onClick={() => focusScenarioField("scenario-charge")}>
                <span>
                  <strong>Confirm service / estate charges</strong>
                  <small>
                    Excluded from cash flow. Enter the annual charge, or a
                    confirmed £0.
                  </small>
                </span>
                <span>
                  Add charge <ArrowUpRight size={14} />
                </span>
              </button>
            )}
            {assumptions.landlordPaysCouncilTax &&
              (override.annualCouncilTax ?? p.annualCouncilTax) === null && (
                <button
                  onClick={() => focusScenarioField("scenario-council-tax")}
                >
                  <span>
                    <strong>Add landlord council tax</strong>
                    <small>
                      You pay council tax in this scenario; the bill is still
                      missing.
                    </small>
                  </span>
                  <span>
                    Add bill <ArrowUpRight size={14} />
                  </span>
                </button>
              )}
            {calculation.monthlyRent === null && (
              <button onClick={() => focusScenarioField("scenario-rent")}>
                <span>
                  <strong>Set an achievable monthly rent</strong>
                  <small>
                    No suitable advertised-rent sample is available for this
                    property.
                  </small>
                </span>
                <span>
                  Add rent <ArrowUpRight size={14} />
                </span>
              </button>
            )}
            {!hasMissing && calculation.monthlyRent !== null && (
              <p>
                <Check size={15} /> Rent and modelled operating costs supplied.
                Check condition and lease terms with the agent.
              </p>
            )}
          </div>
          {f && f.grossYield >= 12 && (
            <div className="live-price-check" id="price-check">
              <CircleHelp size={17} />
              <div>
                <strong>Check the price and rent pairing</strong>
                <p>
                  This scenario implies {livePercent(f.grossYield)} gross yield.
                  Confirm whether the price is an auction guide, a share, or
                  subject to restrictions, and whether the local rent sample
                  fits this home.
                </p>
                <button onClick={() => focusScenarioField("scenario-offer")}>
                  Review your offer
                </button>
                <a href="#rental-evidence">Inspect rent evidence</a>
                {p.listingUrl && (
                  <a href={p.listingUrl} target="_blank" rel="noreferrer">
                    Check original listing ↗
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="live-metric-grid">
            <div>
              <span>Gross yield</span>
              <strong>{f ? livePercent(f.grossYield) : "—"}</strong>
              <small>Annual rent ÷ your purchase price</small>
            </div>
            <div>
              <span>Initial cash needed</span>
              <strong>{liveMoney(deposit + assumptions.buyingCosts)}</strong>
              <small>{liveMoney(deposit)} deposit + buying costs</small>
            </div>
            <div>
              <span>Monthly rent assumption</span>
              <strong>
                {calculation.monthlyRent !== null
                  ? liveMoney(calculation.monthlyRent)
                  : "—"}
              </strong>
              <small>
                {calculation.hasUserRent
                  ? "Your input"
                  : p.rent
                    ? "Nearby asking-rent estimate"
                    : "Needs your input"}
              </small>
            </div>
          </div>
          <details className="live-section live-cashflow-breakdown" open>
            <summary className="live-section-title">
              <Wallet size={19} />
              <h2>Monthly cash flow</h2>
              <span className="live-evidence-tag">Monthly · pre-tax</span>
            </summary>
            {f ? (
              <>
                <div className="live-cost-row live-rent-row">
                  <span>
                    Rent assumption
                    <small>
                      {calculation.hasUserRent
                        ? "Your input"
                        : "Advertised rents, not achieved rents"}
                    </small>
                  </span>
                  <strong>{liveMoney(f.monthlyRent)}</strong>
                </div>
                {costs.map((cost) => (
                  <div
                    className={`live-cost-row ${cost.amount === null ? "unknown" : ""}`}
                    key={cost.label}
                  >
                    <span>
                      {cost.label}
                      {cost.detail && <small>{cost.detail}</small>}
                    </span>
                    {cost.amount === null ? (
                      <button
                        className="live-add-cost"
                        onClick={() =>
                          focusScenarioField(
                            cost.label === "Council tax"
                              ? "scenario-council-tax"
                              : "scenario-charge",
                          )
                        }
                      >
                        Add amount <ArrowUpRight size={13} />
                      </button>
                    ) : (
                      <strong>−{liveMoney(cost.amount)}</strong>
                    )}
                  </div>
                ))}
                <div className="live-cost-total">
                  <div>
                    <strong>
                      {hasMissing
                        ? "Before unknown costs"
                        : "Estimated cash flow"}
                    </strong>
                    <small>
                      Before income tax, one-off repairs and ground rent
                    </small>
                  </div>
                  <strong className={f.monthlyCashFlow < 0 ? "negative" : ""}>
                    {liveMoney(f.monthlyCashFlow)}
                    <small>/mo</small>
                  </strong>
                </div>
              </>
            ) : (
              <div className="live-empty-inline">
                <p>
                  No rental estimate is available for this property. Enter a
                  monthly rent assumption to see the breakdown.
                </p>
                <a href="#scenario" className="live-inline-link">
                  Enter your rent <ArrowUpRight size={14} />
                </a>
              </div>
            )}
          </details>
          <section className="live-section" id="rental-evidence">
            <div className="live-section-title">
              <FileSearch size={19} />
              <h2>Rental evidence</h2>
            </div>
            {p.rent ? (
              <>
                <p className="live-section-copy">
                  A shared sample of advertised rents for listings in the same
                  postcode district, bedroom count and property type, anchored
                  at the search postcode below. It is local context, not a
                  property-specific rent valuation or confirmed tenancy
                  evidence.
                </p>
                <div className="live-rent-evidence">
                  <span>
                    <strong>{liveMoney(p.rent.monthlyEstimate)}</strong>
                    monthly estimate
                  </span>
                  <span>
                    <strong>
                      {p.rent.monthlyLow !== null && p.rent.monthlyHigh !== null
                        ? `${liveMoney(p.rent.monthlyLow)}–${liveMoney(p.rent.monthlyHigh)}`
                        : "Not supplied"}
                    </strong>
                    80% advertised-rent range / month
                  </span>
                  <span>
                    <strong>{p.rent.sampleSize}</strong>rental listings in
                    sample
                  </span>
                </div>
                <p className="live-small">
                  Sample anchor: {p.rent.searchPostcode}
                  {p.rent.radiusMiles !== null
                    ? ` · within ${p.rent.radiusMiles.toFixed(1)} miles`
                    : ""}{" "}
                  · retrieved {liveDate(p.rent.fetchedAt)}
                </p>
                {p.rent.comparables.length > 0 && (
                  <details className="live-comparables">
                    <summary>
                      Inspect {p.rent.comparables.length} rental examples
                    </summary>
                    <div className="live-table-scroll">
                      <table className="live-sales-table">
                        <thead>
                          <tr>
                            <th>Advertised property</th>
                            <th>Details</th>
                            <th>Asking rent / mo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.rent.comparables.map((comparable, index) => (
                            <tr key={index}>
                              <td>
                                {comparable.listingUrl ? (
                                  <a
                                    href={comparable.listingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {comparable.address}
                                    <ArrowUpRight size={12} />
                                  </a>
                                ) : (
                                  comparable.address
                                )}
                              </td>
                              <td>
                                {comparable.propertyType}
                                {comparable.bedrooms !== null
                                  ? ` · ${comparable.bedrooms} bed`
                                  : ""}
                              </td>
                              <td>
                                <strong>
                                  {liveMoney(comparable.monthlyRent)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
                <div className="live-note">
                  <CircleHelp size={14} />
                  <p>
                    Check furnishing, condition and tenancy type with a local
                    agent. Your input can replace this estimate at any time.
                  </p>
                </div>
              </>
            ) : (
              <div className="live-empty-inline">
                <p>
                  {p.rentError ||
                    "A reliable rental sample was not available for this listing."}
                </p>
                <p>
                  Enter your own rent assumption and confirm it with a local
                  letting agent.
                </p>
              </div>
            )}
          </section>
          <LiveSales key={p.id} property={p} />
          <section className="live-section">
            <div className="live-section-title">
              <Check size={19} />
              <h2>Agent checks</h2>
            </div>
            <div className="live-checklist">
              <div>
                <span>01</span>
                <p>
                  <strong>Verify the listing</strong>Confirm availability,
                  condition, tenure and whether the asking price is an auction
                  guide.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>Confirm the cost of ownership</strong>Get the
                  service-charge statement, ground rent, lease terms and likely
                  repair budget.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Check letting eligibility</strong>Confirm EPC, local
                  licensing and any restrictions before assuming the home can be
                  let.
                </p>
              </div>
            </div>
            <div className="live-known-facts">
              <span>
                EPC <b>{p.epcRating ?? "Not supplied"}</b>
              </span>
              <span>
                Tenure <b>{p.tenure ?? "Not supplied"}</b>
              </span>
              <span>
                Days on market <b>{p.daysOnMarket ?? "Not supplied"}</b>
              </span>
            </div>
            <p className="live-small">
              An overall grade is withheld until property condition, local
              demand and risk evidence are available.
            </p>
          </section>
          <p className="live-source-line">
            <Clock3 size={13} />
            Listing retrieved {liveDate(p.fetchedAt)} from PropertyData.
            Availability can change; confirm with the agent.
          </p>
        </div>
        <aside className="live-detail-sidebar">
          <LiveAssumptions property={p} />
        </aside>
      </div>
    </main>
  );
}
