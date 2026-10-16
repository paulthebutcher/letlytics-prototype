import type { MetadataRoute } from "next";
import { getDailyFeed } from "@/lib/daily-data";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const feed = getDailyFeed();
  return [
    { url: new URL("/live", SITE_URL).href, lastModified: feed.fetchedAt },
    ...feed.properties.map((property) => ({
      url: new URL(`/live/${property.id}`, SITE_URL).href,
      lastModified: property.fetchedAt,
    })),
  ];
}
