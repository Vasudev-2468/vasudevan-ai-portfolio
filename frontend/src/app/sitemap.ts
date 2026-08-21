import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vasudevan.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/explore"];
  const anchors = [
    "#about",
    "#background",
    "#experience",
    "#research",
    "#projects",
    "#skills",
    "#news",
    "#avatar",
    "#assistant",
    "#contact",
  ];
  return [
    ...routes.map((r) => ({
      url: `${SITE_URL}${r}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: r === "" ? 1.0 : 0.6,
    })),
    ...anchors.map((a) => ({
      url: `${SITE_URL}/${a}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
