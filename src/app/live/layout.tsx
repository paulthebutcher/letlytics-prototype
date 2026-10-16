import { LiveProvider } from "@/components/live-context";
import { getDailyFeed } from "@/lib/daily-data";
import "./live.css";

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LiveProvider initialFeed={getDailyFeed()}>{children}</LiveProvider>;
}
