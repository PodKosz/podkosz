import type { MetadataRoute } from "next";
import { listCourts } from "@/lib/repo";
import { SITE_URL, slugifyPlace } from "@/lib/site";

/**
 * Spis adresów dla wyszukiwarek. Przy serwisie opartym na mapie w JavaScripcie sitemapa
 * jest jedynym pewnym sposobem, żeby Google dowiedział się o kartach boisk, o podstronach
 * miast i województw.
 *
 * Sitemapa odświeża się razem ze stroną (revalidate), a nie przy każdym uderzeniu robota.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courts = await listCourts();

  const statyczne: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/ranking`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/o-nas`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/dodaj`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/prywatnosc`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/regulamin`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const karty: MetadataRoute.Sitemap = courts.map((court) => ({
    url: `${SITE_URL}/boisko/${court.slug}`,
    lastModified: court.addedAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  // podstrony miejscowości, województw i odkrywców powstają z danych, więc listę
  // składamy z samych boisk
  const miasta = [...new Set(courts.map((c) => slugifyPlace(c.city)))];
  const wojewodztwa = [...new Set(courts.map((c) => slugifyPlace(c.voivodeship)))];
  const gracze = [...new Set(courts.map((c) => slugifyPlace(c.addedBy)).filter(Boolean))];

  return [
    ...statyczne,
    ...wojewodztwa.map((slug) => ({
      url: `${SITE_URL}/wojewodztwo/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...miasta.map((slug) => ({
      url: `${SITE_URL}/miasto/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...gracze.map((slug) => ({
      url: `${SITE_URL}/gracz/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...karty,
  ];
}
