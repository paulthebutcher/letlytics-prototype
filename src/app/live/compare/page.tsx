import { pageMetadata } from "@/lib/seo";
import { LiveCompare } from "@/components/live-compare";
export const metadata = pageMetadata(
  "Compare Your Buy-to-Let Shortlist",
  "Compare asking prices, offers, rental assumptions and cash flow across your shortlisted Manchester properties.",
  "/live/compare",
  false,
);

export default function Page() {
  return <LiveCompare />;
}
