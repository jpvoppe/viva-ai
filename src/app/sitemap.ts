import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/planos`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/criar-conta`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site.url}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/termos`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
