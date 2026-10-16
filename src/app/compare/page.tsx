import { pageMetadata } from "@/lib/seo";
import { Compare } from "@/components/compare";
export const metadata = pageMetadata(
  "Compare Demo Properties",
  "Compare synthetic buy-to-let examples in the Letlytics demonstration workspace.",
  "/compare",
  false,
);

export default function Page() {
  return <Compare />;
}
