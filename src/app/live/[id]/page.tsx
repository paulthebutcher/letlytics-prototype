import { LiveAnalysis } from "@/components/live-analysis";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveAnalysis id={id} />;
}
