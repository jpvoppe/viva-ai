import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Páginas públicas podem ser indexadas; a área logada e as rotas de dados, não. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/auth", "/redefinir-senha", "/configuracao-pendente"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
