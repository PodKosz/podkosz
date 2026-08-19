import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Panel administratora i ulubione są prywatne (mają też `robots: noindex` w metadanych),
 * `/losowe` to przekierowanie, więc też nie ma po co go indeksować.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/ulubione", "/losowe", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
