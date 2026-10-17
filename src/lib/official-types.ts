export interface OfficialEvidence {
  listingId: string;
  attemptedAt: string;
  retrievedAt: string | null;
  status: "matched" | "unresolved" | "unavailable";
  message: string;
  match: null | {
    uprn: string;
    address: string;
    postcode: string;
    sourceUrl: string;
    retrievedAt: string;
    method: "listing-address";
  };
  epc: null | {
    certificateId: string;
    rating: string | null;
    score: number | null;
    areaSqM: number | null;
    assessedAt: string | null;
    validUntil: string | null;
    sourceUrl: string;
    retrievedAt: string;
    verification: "official-certificate" | "provider-reference";
    excerpt: string;
  };
  leases: {
    term: string;
    startDate: string | null;
    endDate: string | null;
    propertyDescription: string;
    sourceUrl: string;
    retrievedAt: string;
  }[];
  sales: { price: number; date: string; sourceUrl: string }[];
  warnings: string[];
}
export interface OfficialStore {
  records: Record<string, OfficialEvidence>;
}

export function leaseYearsRemaining(
  end: string | null,
  at: string,
): number | null {
  if (
    !end ||
    !Number.isFinite(Date.parse(end)) ||
    !Number.isFinite(Date.parse(at))
  )
    return null;
  return Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(at)) / (365.2425 * 86400000)),
  );
}
