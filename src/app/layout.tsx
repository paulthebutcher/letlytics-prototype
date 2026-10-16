import type { Metadata } from "next";
import { pageMetadata, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { AppProvider } from "@/components/app-context";
import "./globals.css";
export const metadata: Metadata = {
  ...pageMetadata(
    "Manchester Buy-to-Let Property Analysis",
    SITE_DESCRIPTION,
    "/live",
  ),
  metadataBase: SITE_URL,
  applicationName: "Letlytics",
  category: "real estate",
  formatDetection: { telephone: false },
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
