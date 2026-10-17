import type { LiveProperty } from "./live-types";
import type { FactKey, FactValue, ListingFact } from "./enrichment-types";

/** Only a unique, source-verified value can become a default. A conflict is never silently resolved. */
export function verifiedFact<T extends FactValue>(
  p: LiveProperty,
  key: FactKey,
): T | null {
  const facts =
    p.enrichment?.facts.filter(
      (f) => f.key === key && f.status === "verified",
    ) ?? [];
  const values = [...new Set(facts.map((f) => JSON.stringify(f.value)))];
  return values.length === 1 ? (facts[0].value as T) : null;
}
export function factSource(
  p: LiveProperty,
  key: FactKey,
): ListingFact | undefined {
  return p.enrichment?.facts.find(
    (f) => f.key === key && f.status === "verified",
  );
}
export function propertyLabel(p: LiveProperty) {
  return verifiedFact<boolean>(p, "studio") === true || p.bedrooms === 0
    ? "Studio"
    : `${p.propertyType}${p.bedrooms === null ? "" : ` · ${p.bedrooms} bed`}`;
}
export function priceLabel(p: LiveProperty) {
  return (
    verifiedFact<string>(p, "priceQualifier") ||
    (verifiedFact<boolean>(p, "auction") ? "Auction price" : "Asking price")
  );
}
export function listingWarnings(p: LiveProperty): string[] {
  const e = p.enrichment;
  const warnings: string[] = [];
  if (p.sameAddressListingIds?.length)
    warnings.push(
      "The supplier assigns this flat address to another listing in the selection. Confirm the exact unit, price and bedroom count with the agent; these may be duplicate or mismatched adverts.",
    );
  if (verifiedFact<boolean>(p, "auction"))
    warnings.push(
      "Auction: guide price is not the final purchase price. Check fees and legal pack.",
    );
  if (p.enrichment?.facts.some((f) => f.key === "cashOnly" && f.value === true))
    warnings.push("Cash buyers only — cash purchase scenario applied.");
  if (verifiedFact<string>(p, "priceQualifier") === "Offers over")
    warnings.push("Offers over: the advertised amount is a starting point.");
  const ownership = verifiedFact<string>(p, "ownership");
  if (ownership)
    warnings.push(
      `${ownership} Confirm the interest being sold and price basis with the agent.`,
    );
  if (e?.conflicts.length) warnings.push(...e.conflicts);
  if (e?.attempts.some((a) => a.detail.includes("HTTP 410")))
    warnings.push(
      "The original advert is no longer available (HTTP 410). Confirm availability with the agent.",
    );
  if (!e || !e.retrievedAt)
    warnings.push(
      "Original advert not verified. Restrictions, tenure and charges may be missing.",
    );
  else if (e.status !== "ready")
    warnings.push(
      "Some source checks failed; retained evidence keeps its original retrieval date.",
    );
  return warnings;
}
