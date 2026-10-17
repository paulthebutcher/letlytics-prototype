"use client";
import type { LiveProperty } from "@/lib/live-types";
import type { FactKey, FactValue } from "@/lib/enrichment-types";
import { listingWarnings, verifiedFact } from "@/lib/listing-evidence";
import { liveDate, liveMoney } from "./live-ui";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  });
const labels: Record<FactKey, string> = {
  price: "Advertised price",
  priceQualifier: "Price basis",
  auction: "Auction",
  cashOnly: "Cash buyers only",
  studio: "Studio",
  bedrooms: "Portal bedrooms",
  tenure: "Tenure",
  annualServiceCharge: "Service charge / year",
  annualGroundRent: "Ground rent / year",
  groundRentTerms: "Ground rent terms",
  lease: "Original lease term",
  leaseYearsRemaining: "Portal lease years remaining",
  epc: "EPC rating",
  agentRent: "Agent rent estimate / month",
  advertisedRent: "Advertised rent / month",
  achievedRent: "Reported achieved rent / month",
  ownership: "Ownership terms",
  auctionFee: "Auction reservation fee",
  buyerPackFee: "Buyer information pack",
  buyerCheckFee: "AML check / buyer",
};
const moneyKeys = new Set<FactKey>([
  "price",
  "annualServiceCharge",
  "annualGroundRent",
  "agentRent",
  "advertisedRent",
  "achievedRent",
  "buyerPackFee",
  "buyerCheckFee",
]);
function format(key: FactKey, value: FactValue): string {
  if (typeof value === "object")
    return `${value.percent}% · minimum ${value.minimum === null ? "unknown" : liveMoney(value.minimum)} · ${value.includesVat ? "includes VAT" : "VAT unverified"}`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return moneyKeys.has(key) && typeof value === "number"
    ? liveMoney(value, 2)
    : String(value);
}
export function ListingWarnings({
  property,
  compact = false,
}: {
  property: LiveProperty;
  compact?: boolean;
}) {
  const warnings = listingWarnings(property);
  if (!warnings.length) return null;
  if (compact)
    return (
      <div className="live-listing-flags">
        {verifiedFact<boolean>(property, "auction") && (
          <span>Auction guide</span>
        )}
        {property.enrichment?.facts.some(
          (f) => f.key === "cashOnly" && f.value === true,
        ) && <span>Cash only</span>}
        {verifiedFact<string>(property, "priceQualifier") === "Offers over" && (
          <span>Offers over</span>
        )}
        {verifiedFact<string>(property, "ownership") && (
          <span>Ownership terms to check</span>
        )}
        {!!property.enrichment?.conflicts.length && (
          <span>Conflicting evidence</span>
        )}
        {!property.enrichment?.retrievedAt && <span>Advert not verified</span>}
      </div>
    );
  return (
    <section
      className="live-evidence-alert"
      aria-label="Listing restrictions and conflicts"
    >
      <strong>Check the basis of this deal</strong>
      <ul>
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <a href="#listing-evidence">Inspect sources and unresolved facts ↓</a>
    </section>
  );
}
export function ListingEvidence({ property: p }: { property: LiveProperty }) {
  const e = p.enrichment;
  return (
    <section className="live-section" id="listing-evidence">
      <div className="live-section-title">
        <h2>Original listing evidence</h2>
        <span className="live-evidence-tag">{e?.status ?? "Not checked"}</span>
      </div>
      <p className="live-small">
        “Verified” means found in the matched advert, not independently
        confirmed with a lease, EPC register or tenancy. Conflicting facts are
        withheld from defaults.
      </p>
      <p className="live-small">
        Provider listing retrieved {dateTime(p.fetchedAt)}. Original advert
        retrieved {e?.retrievedAt ? dateTime(e.retrievedAt) : "not yet"}.
        Enrichment completed{" "}
        {e?.enrichedAt ? dateTime(e.enrichedAt) : "not yet"}.
      </p>
      <details className="live-evidence-facts">
        <summary>
          Inspect {e?.facts.length ?? 0} source facts and provider values
        </summary>
        <p className="live-small">
          Provider retained: {liveMoney(p.price)} ·{" "}
          {p.bedrooms === null ? "bedrooms unknown" : `${p.bedrooms} bedrooms`}{" "}
          · {p.tenure ?? "tenure unknown"} · service charge{" "}
          {p.annualServiceCharge === null
            ? "unknown"
            : liveMoney(p.annualServiceCharge, 2)}
          .
        </p>
        {e?.facts.map((f, i) => (
          <article key={i} className="live-fact-row">
            <div>
              <strong>{labels[f.key]}</strong>
              <span>{format(f.key, f.value)}</span>
              <small>
                {f.status} · {f.sourceKind} · retrieved{" "}
                {dateTime(f.retrievedAt)}
              </small>
            </div>
            <blockquote>{f.excerpt}</blockquote>
            <a href={f.sourceUrl} target="_blank" rel="noreferrer">
              Source ↗
            </a>
          </article>
        ))}
        {!e?.facts.length && (
          <p>
            No verifiable facts extracted. Open the original listing or ask the
            agent.
          </p>
        )}
        {!!e?.attempts.length && (
          <details>
            <summary>Retrieval limitations and identity checks</summary>
            {e.attempts.map((a, i) => (
              <p className="live-small" key={i}>
                <a href={a.url} target="_blank" rel="noreferrer">
                  {new URL(a.url).hostname}
                </a>{" "}
                · {a.outcome} · {dateTime(a.attemptedAt)} — {a.detail}
              </p>
            ))}
          </details>
        )}
      </details>
    </section>
  );
}
