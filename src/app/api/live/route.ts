import { getDailyFeed } from "@/lib/daily-data";

// Kept as a read-only snapshot endpoint. No upstream requests, keys or refreshes.
export const dynamic = "force-static";
export function GET() {
  return Response.json(getDailyFeed());
}
