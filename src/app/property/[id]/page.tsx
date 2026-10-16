import { pageMetadata } from "@/lib/seo";
import { Analysis } from "@/components/analysis";
export const metadata = pageMetadata(
  "Demo Property Analysis",
  "A synthetic buy-to-let property analysis for exploring the Letlytics demo.",
  "/discover",
  false,
);

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Analysis id={id} />;
}
