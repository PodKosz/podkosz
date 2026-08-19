import { ACCESS_LABEL, Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { SITE_NAME, SITE_URL, absolute, slugifyPlace } from "@/lib/site";

/**
 * Dane strukturalne (JSON-LD) - ten sam opis boiska, ale w formacie, który wyszukiwarki
 * rozumieją bez zgadywania: rodzaj obiektu, adres, współrzędne, godziny, wyposażenie.
 * Dzięki temu karta boiska może trafić do wyników lokalnych, a nie tylko jako zwykły link.
 */
export function CourtStructuredData({ court }: { court: Court }) {
  const url = absolute(`/boisko/${court.slug}`);
  const zdjecia = court.photos.filter((p) => p.url).map((p) => p.url as string);

  const dane = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": url,
    url,
    name: court.name,
    description: court.description,
    image: zdjecia.length ? zdjecia : undefined,
    sport: "Basketball",
    // wszystkie boiska w bazie są bezpłatne; „ograniczony" znaczy zamykany teren, a nie płatny
    isAccessibleForFree: true,
    publicAccess: court.access !== "ograniczony",
    address: {
      "@type": "PostalAddress",
      addressLocality: court.city,
      addressRegion: court.voivodeship,
      addressCountry: "PL",
    },
    geo: { "@type": "GeoCoordinates", latitude: court.lat, longitude: court.lng },
    // godziny w formacie schema.org tylko dla boisk otwartych całą dobę; opisowe
    // wartości („08:00 - 21:00", „do zmroku") zostawiamy w polu tekstowym
    openingHours: court.hours === "24h" ? "Mo-Su 00:00-24:00" : undefined,
    amenityFeature: [
      feature("Liczba koszy", court.hoops),
      feature("Nawierzchnia", surfaceLabel(court.surface)),
      feature("Oświetlenie", court.lit),
      feature("Ogrodzenie", court.fenced),
      feature("Rodzaj", TYPE_LABEL[court.type]),
      feature("Dostęp", ACCESS_LABEL[court.access]),
    ],
    // Płonące piłki to polubienia, a nie oceny w skali - dlatego interactionStatistic,
    // nie aggregateRating. Podawanie lajków jako ocen łamie wytyczne Google dla danych
    // strukturalnych i grozi karą za wprowadzanie w błąd.
    interactionStatistic: court.likes
      ? {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: court.likes,
        }
      : undefined,
  };

  const okruszki = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: court.voivodeship,
        item: absolute(`/wojewodztwo/${slugifyPlace(court.voivodeship)}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: court.city,
        item: absolute(`/miasto/${slugifyPlace(court.city)}`),
      },
      { "@type": "ListItem", position: 4, name: court.name, item: url },
    ],
  };

  return (
    <>
      <Json data={dane} />
      <Json data={okruszki} />
    </>
  );
}

/** Opis serwisu na stronie głównej - nazwa, wyszukiwarka, wydawca. */
export function SiteStructuredData({ courts }: { courts: number }) {
  const dane = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_URL,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "pl-PL",
    description: `Mapa i baza ${courts} boisk do koszykówki w Polsce.`,
  };
  return <Json data={dane} />;
}

function feature(name: string, value: string | number | boolean) {
  return { "@type": "LocationFeatureSpecification", name, value };
}

function Json({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify pomija pola undefined, więc w wyniku nie ma pustych kluczy
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
