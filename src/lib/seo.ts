import type { Metadata } from "next";

export const SITE_URL = new URL("https://levlytics-prototype.vercel.app");
export const SITE_DESCRIPTION =
  "Screen Manchester property listings, test rental cash flow with your own assumptions, and compare buy-to-let opportunities with rental and sold-price evidence.";
export const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Letlytics — Find potential. Test the numbers.",
};

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  index = true,
): Metadata {
  const fullTitle = `${title} | Letlytics`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: "Letlytics",
      url: path,
      title: fullTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
