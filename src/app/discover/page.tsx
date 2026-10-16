import { pageMetadata } from "@/lib/seo";
import { Discover } from "@/components/discover";
export const metadata = pageMetadata(
  "Explore the Property Demo",
  "Explore synthetic property examples in the Letlytics demonstration workspace.",
  "/discover",
  false,
);

export default function Page() {
  return <Discover />;
}
