"use client";
import type { LiveProperty } from "@/lib/live-types";
import { leaseYearsRemaining } from "@/lib/official-types";
import { verifiedFact } from "@/lib/listing-evidence";
import { liveDate, liveMoney } from "./live-ui";

export function OfficialEvidencePanel({
  property: p,
}: {
  property: LiveProperty;
}) {
  const e = p.official;
  const certificate =
    e?.epc?.verification === "official-certificate" ? e.epc : null;
  const advertEpc = verifiedFact<string>(p, "epc");
  const epcConflict =
    certificate?.rating && advertEpc && certificate.rating !== advertEpc;
  const lease = e?.leases.length === 1 ? e.leases[0] : null;
  const years =
    lease && e?.retrievedAt
      ? leaseYearsRemaining(lease.endDate, e.retrievedAt)
      : null;
  const portalYears = p.enrichment?.facts.find(
    (f) => f.key === "leaseYearsRemaining",
  )?.value;
  const leaseConflict =
    years !== null &&
    typeof portalYears === "number" &&
    Math.abs(years - portalYears) > 1;
  const expired =
    certificate?.validUntil &&
    certificate.validUntil < certificate.retrievedAt.slice(0, 10);
  return (
    <section className="live-section live-official" id="official-evidence">
      <div className="live-section-title">
        <h2>Property records</h2>
        <span className="live-evidence-tag">
          {e?.status === "matched"
            ? "Exact flat resolved"
            : "Exact address to confirm"}
        </span>
      </div>
      {!e?.match ? (
        <p className="live-small">
          {e?.message ??
            "Official EPC and lease checks need an exact property match. Ask the agent for the flat number and EPC certificate."}
        </p>
      ) : (
        <>
          <p className="live-small">{e.match.address}</p>
          <div className="live-official-summary">
            <div>
              <span>Official EPC</span>
              <strong>
                {certificate?.rating ?? "To confirm"}
                {expired ? " · expired" : ""}
              </strong>
            </div>
            <div>
              <span>Certificate floor area</span>
              <strong>
                {certificate?.areaSqM
                  ? `${certificate.areaSqM} m²`
                  : "To confirm"}
              </strong>
            </div>
            <div>
              <span>Registered lease</span>
              <strong>
                {years !== null ? `${years} years left` : "To confirm"}
              </strong>
            </div>
          </div>
          {(epcConflict || leaseConflict || expired) && (
            <p className="live-warning">
              {epcConflict
                ? `The certificate says EPC ${certificate?.rating}; the advert says ${advertEpc}. `
                : ""}
              {leaseConflict
                ? `The registered term gives ${years} years remaining at retrieval; the portal says ${portalYears}. `
                : ""}
              {expired
                ? "This certificate has expired. Ask for the current certificate. "
                : ""}
              Confirm the discrepancy with the agent.
            </p>
          )}
          <details className="live-evidence-details">
            <summary>Inspect certificate, lease and this flat’s sales</summary>
            <p className="live-small">
              Matched to UPRN {e.match.uprn} by PropertyData’s listing resolver
              on {liveDate(e.match.retrievedAt)}. {e.message}
            </p>
            {e.epc ? (
              <article className="live-official-record">
                <strong>
                  EPC {e.epc.rating ?? "rating unknown"} ·{" "}
                  {certificate
                    ? "Government certificate checked"
                    : "Supplier reference only"}
                </strong>
                <p>{e.epc.excerpt}</p>
                {certificate && (
                  <p>
                    Assessed{" "}
                    {certificate.assessedAt
                      ? liveDate(certificate.assessedAt)
                      : "date unknown"}{" "}
                    · Valid until{" "}
                    {certificate.validUntil
                      ? liveDate(certificate.validUntil)
                      : "date unknown"}
                    . Certificate area may differ from the advert’s measured
                    area.
                  </p>
                )}
                <a href={e.epc.sourceUrl} target="_blank" rel="noreferrer">
                  Open government certificate ↗
                </a>
                <small>Retrieved {liveDate(e.epc.retrievedAt)}</small>
              </article>
            ) : (
              <p>No EPC certificate was returned for this exact property.</p>
            )}
            {e.leases.map((l, i) => (
              <article className="live-official-record" key={i}>
                <strong>HM Land Registry lease · via PropertyData</strong>
                <p>{l.propertyDescription}</p>
                <p>
                  {l.term}
                  {l.endDate ? ` · ends ${liveDate(l.endDate)}` : ""}
                </p>
                <p className="live-small">
                  A registered term, not proof of current service charges,
                  ground rent or the terms of this sale. Multiple titles can
                  apply to one building.
                </p>
                <a href={l.sourceUrl} target="_blank" rel="noreferrer">
                  About the registered leases dataset ↗
                </a>
                <small>Retrieved {liveDate(l.retrievedAt)}</small>
              </article>
            ))}
            {!e.leases.length && (
              <p>
                No registered lease could be matched to this exact flat. Ask for
                the lease or title register.
              </p>
            )}
            {!!e.sales.length && (
              <article className="live-official-record">
                <strong>This property’s recorded sales</strong>
                <p className="live-small">
                  HM Land Registry transactions linked by PropertyData.
                  Historical price may reflect a share or different lease terms;
                  it is not a current valuation.
                </p>
                {e.sales.map((s) => (
                  <p key={s.sourceUrl}>
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                      {liveMoney(s.price)} · {liveDate(s.date)} ↗
                    </a>
                  </p>
                ))}
                <small>
                  Retrieved{" "}
                  {e.retrievedAt ? liveDate(e.retrievedAt) : "unknown"}
                </small>
              </article>
            )}
            {e.warnings.map((w, i) => (
              <p className="live-small" key={i}>
                {w}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
