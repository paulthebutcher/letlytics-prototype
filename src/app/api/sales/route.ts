import { getDailySales } from "@/lib/daily-data";
import { emptySalesEvidence, parseSalesQuery } from "@/lib/sales-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const query = parseSalesQuery(
    parameters.get("postcode"),
    parameters.get("type"),
  );
  if (!query) {
    return Response.json(
      emptySalesEvidence(
        null,
        "invalid",
        "Choose a full UK postcode and a supported property type: Flat, Terraced, Semi-detached or Detached.",
      ),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(getDailySales(query), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
