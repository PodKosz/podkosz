import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";

/**
 * Przed premierą serwis ma nie pojawiać się w wynikach wyszukiwania. Robimy to przez `noindex`
 * (nagłówek `X-Robots-Tag` i meta na każdej stronie), a nie przez zakaz w robots.txt: adres
 * zablokowany w robots.txt robot pobiera, więc nigdy nie zobaczy `noindex` i potrafi trzymać
 * go w indeksie latami. Dlatego tu pozwalamy wchodzić - i nie podajemy sitemapy.
 */
export default function robots(): MetadataRoute.Robots {
  if (ZASLONA) {
    return { rules: [{ userAgent: "*", allow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/ulubione", "/losowe", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
