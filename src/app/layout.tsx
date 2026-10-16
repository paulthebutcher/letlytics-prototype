import type { Metadata } from "next";
import { AppProvider } from "@/components/app-context";
import "./globals.css";
export const metadata: Metadata = {
  title: "Letlytics — Find the potential. Understand the trade-offs.",
  description:
    "Explore Manchester listings, inspect asking-rent evidence, adjust cash flow and compare your buy-to-let shortlist.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
