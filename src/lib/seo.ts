import type { Metadata } from "next";

// Vercel supplies the production domain, including after a project/domain rename.
export const SITE_URL = new URL(
  `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "letlytics-dev.vercel.app"}`,
);
export const SITE_DESCRIPTION =
  "Screen Manchester property listings, test rental cash flow with your own assumptions, and compare buy-to-let opportunities with rental and sold-price evidence.";
export const SOCIAL_IMAGE = {
  url: new URL("/og/letlytics-v2.png", SITE_URL).href,
  secureUrl: new URL("/og/letlytics-v2.png", SITE_URL).href,
  type: "image/png",
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
