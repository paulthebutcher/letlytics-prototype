"use client";
import { useState } from "react";
import { ArrowUpRight, History, LoaderCircle } from "lucide-react";
import type { LiveProperty } from "@/lib/live-types";
import type { SalesEvidence } from "@/lib/sales-types";
import { liveDate, liveMoney } from "./live-ui";

export function LiveSales({ property }: { property: LiveProperty }) {
  const [evidence, setEvidence] = useState<SalesEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales?${new URLSearchParams({ postcode: property.postcode, type: property.propertyType })}`,
      );
      const data: SalesEvidence = await response.json();
      if (!data || !Array.isArray(data.sales))
        throw new Error("Recorded sales are not available in this update.");
      setEvidence(data);
      if (data.status === "unavailable" || data.status === "invalid")
        setError(
          data.message ?? "Recorded sales are not available in this update.",
        );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Recorded sales could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="live-section live-sales">
      <div className="live-section-title">
        <History size={19} />
        <h2>Recorded sales nearby</h2>
        <span className="live-evidence-tag">HM Land Registry</span>
      </div>
      <p className="live-section-copy">
        Check recorded sale prices before deciding which properties deserve a
        closer look. Same postcode and property type, with dates you can
        inspect.
      </p>
      {!evidence && !loading && !error && (
        <div className="live-sales-start">
          <div>
            <strong>
              {property.postcode} · {property.propertyType}
            </strong>
            <p>
              Recorded sales from the last 36 months, included with the daily
              data update. Historical transactions, not a valuation.
            </p>
          </div>
          <button className="button secondary" onClick={fetchSales}>
            <History size={16} />
            View recorded sales
          </button>
        </div>
      )}
      {loading && (
        <p className="live-inline-loading" role="status">
          <LoaderCircle className="live-spinner" size={17} />
          Loading recorded sales for {property.postcode}…
        </p>
      )}
      {error && !loading && (
        <div className="live-warning">
          <p>{error}</p>
          <button className="live-inline-link" onClick={fetchSales}>
            Try again
          </button>
        </div>
      )}
      {evidence && !error && !loading && (
        <>
          {evidence.sales.length > 0 ? (
            <>
              <div className="live-sales-summary">
                <span>
                  <strong>{evidence.count}</strong>
                  {evidence.truncated
                    ? "recent records shown"
                    : "matching recorded sales"}
                </span>
                {evidence.medianPrice !== null && (
                  <span>
                    <strong>{liveMoney(evidence.medianPrice)}</strong>median of
                    these records
                  </span>
                )}
                <p>
                  Compare date, tenure and address. Size, condition and lease
                  terms can differ substantially.
                </p>
              </div>
              <div className="live-table-scroll">
                <table className="live-sales-table">
                  <thead>
                    <tr>
                      <th scope="col">Recorded address</th>
                      <th scope="col">Sold</th>
                      <th scope="col">Price paid</th>
                      <th scope="col">Tenure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.sales.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <a
                            href={sale.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {sale.address}
                            <ArrowUpRight size={12} />
                          </a>
                          <small>{sale.postcode}</small>
                        </td>
                        <td>{liveDate(sale.date)}</td>
                        <td>
                          <strong>{liveMoney(sale.price)}</strong>
                        </td>
                        <td>{sale.tenure ?? "Not recorded"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="live-warning">
              <strong>No matching recorded sales found.</strong>
              <p>
                {evidence.message ??
                  "No matching records are available in this period. This does not mean no homes have sold; registration can lag and coverage has exclusions."}
              </p>
            </div>
          )}
          <a className="live-inline-link live-offer-jump" href="#scenario">
            Test your own offer <ArrowUpRight size={13} />
          </a>
          <div className="live-sales-caveat">
            <p>{evidence.scope}</p>
            <p>{evidence.caveat}</p>
            <p>{evidence.attribution}</p>
            <a
              className="live-inline-link"
              href={evidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              About Price Paid Data <ArrowUpRight size={12} />
            </a>
            {evidence.fetchedAt && (
              <span>Retrieved {liveDate(evidence.fetchedAt)}</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
