import { pageMetadata } from "@/lib/seo";
import { LiveDiscover } from "@/components/live-discover";
export const metadata = pageMetadata(
  "Manchester Buy-to-Let Properties",
  "Screen Manchester property listings, adjust your financing assumptions, and shortlist buy-to-let opportunities with rental evidence.",
  "/live",
  true,
);

export default function Page() {
  return <LiveDiscover />;
}
