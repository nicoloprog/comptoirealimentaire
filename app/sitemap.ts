import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/politique-confidentialite`,
      lastModified: new Date("2026-09-16"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
