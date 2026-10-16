import { getDailyFeed } from "@/lib/daily-data";
import { pageMetadata } from "@/lib/seo";
import { LiveAnalysis } from "@/components/live-analysis";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = getDailyFeed().properties.find((item) => item.id === id);
  if (!property)
    return pageMetadata(
      "Property unavailable",
      "Explore the current Manchester property selection on Letlytics.",
      "/live",
      false,
    );
  return pageMetadata(
    `${property.address} — Buy-to-Let Analysis`,
    `Review this ${property.propertyType.toLowerCase()} in ${property.postcode}. Test your offer, monthly rent and ownership costs, then inspect rental evidence and recorded sales.`,
    `/live/${property.id}`,
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveAnalysis id={id} />;
}
