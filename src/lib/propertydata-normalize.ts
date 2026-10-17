import type { LiveProperty, RentalEvidence } from "./live-types";

type RecordValue = Record<string, unknown>;
export const asRecord = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
export function numeric(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const n =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(n) ? n : null;
}
export function listingLink(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" &&
      url.hostname === "propertydata.co.uk" &&
      url.pathname.startsWith("/outbound/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
/** Only retain public image URLs, never credentials or arbitrary provider envelopes. */
export function listingImage(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname) ||
      [...url.searchParams.keys()].some((key) =>
        /key|token|secret|signature|credential/i.test(key),
      )
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
export function normalizeListings(
  payload: unknown,
  fetchedAt: string,
): LiveProperty[] {
  const data = asRecord(payload);
  if (!Array.isArray(data.properties)) return [];
  const seen = new Set<string>();
  return data.properties.flatMap((value) => {
    const p = asRecord(value);
    const id = text(p.id),
      address = text(p.address),
      postcode = text(p.postcode).trim().toUpperCase();
    const price = numeric(p.price),
      lat = numeric(p.lat),
      lng = numeric(p.lng);
    const types: Record<string, LiveProperty["propertyType"]> = {
      Flat: "Flat",
      "Terraced house": "Terraced",
      "Semi-detached house": "Semi-detached",
      "Detached house": "Detached",
    };
    const propertyType = types[text(p.type_standardised)];
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      seen.has(id) ||
      !address ||
      !postcode ||
      price === null ||
      price <= 0 ||
      lat === null ||
      lat < 49 ||
      lat > 61 ||
      lng === null ||
      lng < -9 ||
      lng > 3 ||
      !propertyType ||
      numeric(p.sstc) === 1
    )
      return [];
    seen.add(id);
    const bedrooms = numeric(p.bedrooms),
      area = numeric(p.sqf),
      days = numeric(p.days_on_market);
    return [
      {
        id,
        address,
        postcode,
        price,
        lat,
        lng,
        propertyType,
        bedrooms:
          bedrooms !== null && Number.isInteger(bedrooms) && bedrooms >= 0
            ? bedrooms
            : null,
        floorAreaSqFt: area !== null && area > 0 ? area : null,
        daysOnMarket: days !== null && days >= 0 ? days : null,
        listingUrl: listingLink(p.url),
        imageUrl: listingImage(p.image_url),
        // Supplier summaries contain investment judgements; the UI uses facts and original-listing links instead.
        summary: "",
        providerDetails: {
          type: text(p.type),
          summary: text(p.summary).slice(0, 3000),
          ...(numeric(p.years_remaining) !== null
            ? { yearsRemaining: numeric(p.years_remaining)! }
            : {}),
        },
        strategies: Array.isArray(p.lists)
          ? p.lists.map((v) => text(asRecord(v).name)).filter(Boolean)
          : [],
        fetchedAt,
        rent: null,
        annualServiceCharge: null,
        annualCouncilTax: null,
        tenure: null,
        epcRating: null,
      } satisfies LiveProperty,
    ];
  });
}

export function normalizeRent(
  payload: unknown,
  searchPostcode: string,
  fetchedAt: string,
): RentalEvidence | null {
  const data = asRecord(asRecord(asRecord(payload).data).long_let);
  if (data.unit !== "gbp_per_week") return null;
  const average = numeric(data.average),
    sampleSize = numeric(data.points_analysed),
    radius = numeric(data.radius);
  // Wider or tiny samples are not silently used as rent forecasts for a particular home.
  if (
    average === null ||
    average <= 0 ||
    sampleSize === null ||
    sampleSize < 15 ||
    radius === null ||
    radius > 3
  )
    return null;
  const monthly = (weekly: number) => Math.round((weekly * 52) / 12);
  const range = Array.isArray(data["80pc_range"]) ? data["80pc_range"] : [];
  const low = numeric(range[0]),
    high = numeric(range[1]);
  return {
    monthlyEstimate: monthly(average),
    monthlyLow: low === null ? null : monthly(low),
    monthlyHigh: high === null ? null : monthly(high),
    sampleSize,
    radiusMiles: radius,
    searchPostcode,
    fetchedAt,
    comparables: (Array.isArray(data.raw_data) ? data.raw_data : [])
      .slice(0, 6)
      .flatMap((value) => {
        const p = asRecord(value),
          price = numeric(p.price),
          address = text(p.address);
        return price !== null && price > 0 && address
          ? [
              {
                address,
                monthlyRent: monthly(price),
                bedrooms: numeric(p.bedrooms),
                propertyType: text(p.type),
                listingUrl: listingLink(p.url),
              },
            ]
          : [];
      }),
  };
}

export function rentalGroup(property: LiveProperty): string {
  return `${property.postcode.split(" ")[0]}:${property.propertyType}:${property.bedrooms ?? "unknown"}`;
}
