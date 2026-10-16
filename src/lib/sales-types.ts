export const SALES_PROPERTY_TYPES = [
  "Flat",
  "Terraced",
  "Semi-detached",
  "Detached",
] as const;

export type SalesPropertyType = (typeof SALES_PROPERTY_TYPES)[number];

export type SalesQuery = {
  postcode: string;
  propertyType: SalesPropertyType;
};

export type RecordedSale = {
  id: string;
  price: number;
  date: string;
  address: string;
  postcode: string;
  propertyType: SalesPropertyType;
  tenure: "Freehold" | "Leasehold" | null;
  newBuild: boolean | null;
  category: "A" | "B" | null;
  sourceUrl: string;
};

export type SalesEvidence = {
  status: "ready" | "empty" | "unavailable" | "invalid";
  postcode: string;
  propertyType: SalesPropertyType | null;
  fetchedAt: string | null;
  periodStart: string;
  sales: RecordedSale[];
  count: number;
  medianPrice: number | null;
  truncated: boolean;
  scope: string;
  caveat: string;
  attribution: string;
  sourceUrl: string;
  message?: string;
};

const COMMON = "http://landregistry.data.gov.uk/def/common/";
const PPI = "http://landregistry.data.gov.uk/def/ppi/";
export const SALES_TYPE_RESOURCE: Record<SalesPropertyType, string> = {
  Flat: "flat-maisonette",
  Terraced: "terraced",
  "Semi-detached": "semi-detached",
  Detached: "detached",
};

export const SALES_SOURCE_URL = "https://landregistry.data.gov.uk/app/ppd/";
export const SALES_ATTRIBUTION =
  "Contains HM Land Registry data © Crown copyright and database right 2021. This data is licensed under the Open Government Licence v3.0.";
export const SALES_CAVEAT =
  "Recorded sales in the same postcode and property type are context, not a valuation or an exact property match. Bedrooms, floor area and condition are unknown. This small, selected cohort may not be representative; recent registrations can be missing.";

export function normalizeSalesPostcode(value: string | null): string | null {
  if (!value || value.length > 12) return null;
  const compact = value.toUpperCase().replace(/\s/g, "");
  if (
    !/^(GIR0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-HJKPSTUW\d]?\d[ABD-HJLNP-UW-Z]{2})$/.test(
      compact,
    )
  ) {
    return null;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function parseSalesQuery(
  postcode: string | null,
  propertyType: string | null,
): SalesQuery | null {
  const normalized = normalizeSalesPostcode(postcode);
  if (
    !normalized ||
    !SALES_PROPERTY_TYPES.includes(propertyType as SalesPropertyType)
  ) {
    return null;
  }
  return { postcode: normalized, propertyType: propertyType as SalesPropertyType };
}

export function salesPeriodStart(now: Date): string {
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 3);
  return start.toISOString().slice(0, 10);
}

export function emptySalesEvidence(
  query: SalesQuery | null,
  status: "empty" | "unavailable" | "invalid",
  message: string,
  now = new Date(),
): SalesEvidence {
  return {
    status,
    postcode: query?.postcode ?? "",
    propertyType: query?.propertyType ?? null,
    fetchedAt: null,
    periodStart: salesPeriodStart(now),
    sales: [],
    count: 0,
    medianPrice: null,
    truncated: false,
    scope: query
      ? `Up to 12 ${query.propertyType.toLowerCase()} sales in ${query.postcode}, past 36 months. Standard category A, existing buildings only; mixed tenures.`
      : "England and Wales recorded residential sales only.",
    caveat: SALES_CAVEAT,
    attribution: SALES_ATTRIBUTION,
    sourceUrl: SALES_SOURCE_URL,
    message,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function binding(row: Record<string, unknown>, key: string): string | null {
  const value = object(row[key])?.value;
  return typeof value === "string" ? value.trim() : null;
}

/** Pure decoder also used by tests; never interprets missing fields as evidence. */
export function normalizeSalesResponse(
  payload: unknown,
  query: SalesQuery,
  now = new Date(),
): SalesEvidence {
  const rows = object(object(payload)?.results)?.bindings;
  if (!Array.isArray(rows)) throw new Error("Invalid Land Registry response");

  const periodStart = salesPeriodStart(now);
  const today = now.toISOString().slice(0, 10);
  const unique = new Map<string, RecordedSale>();
  for (const value of rows) {
    const row = object(value);
    if (!row) continue;
    const transaction = binding(row, "transaction");
    const id = transaction?.match(
      /^https?:\/\/landregistry\.data\.gov\.uk\/data\/ppi\/transaction\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/current$/i,
    )?.[1];
    const date = binding(row, "date");
    const price = Number(binding(row, "price"));
    const postcode = normalizeSalesPostcode(binding(row, "postcode"));
    const paon = binding(row, "paon");
    const street = binding(row, "street");
    const type = binding(row, "propertyType");
    const newBuild = binding(row, "newBuild");
    const category = binding(row, "category");
    if (
      !id ||
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date < periodStart ||
      date > today ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      postcode !== query.postcode ||
      type !== `${COMMON}${SALES_TYPE_RESOURCE[query.propertyType]}` ||
      category !== `${PPI}standardPricePaidTransaction` ||
      (newBuild !== "false" && newBuild !== "0") ||
      !paon ||
      !street
    ) {
      continue;
    }
    const tenure = binding(row, "tenure");
    const normalizedId = id.toUpperCase();
    unique.set(normalizedId, {
      id: normalizedId,
      price,
      date,
      address: [binding(row, "saon"), paon, street].filter(Boolean).join(", "),
      postcode,
      propertyType: query.propertyType,
      tenure:
        tenure === `${COMMON}freehold`
          ? "Freehold"
          : tenure === `${COMMON}leasehold`
            ? "Leasehold"
            : null,
      newBuild: false,
      category: "A",
      sourceUrl: `https://landregistry.data.gov.uk/data/ppi/transaction/${normalizedId}/current`,
    });
  }
  const normalized = [...unique.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const sales = normalized.slice(0, 12);
  const prices = sales.map((sale) => sale.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const medianPrice =
    prices.length < 3
      ? null
      : prices.length % 2
        ? prices[middle]
        : (prices[middle - 1] + prices[middle]) / 2;
  const base = emptySalesEvidence(
    query,
    "empty",
    "No qualifying recorded sales found. This does not mean no properties have sold; recent registrations and excluded transaction types may be absent.",
    now,
  );
  return {
    ...base,
    status: sales.length ? "ready" : "empty",
    fetchedAt: now.toISOString(),
    sales,
    count: sales.length,
    medianPrice,
    truncated: normalized.length > 12,
    message: sales.length ? undefined : base.message,
  };
}
