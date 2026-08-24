import { ACCESS_LABEL, Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { PROFILE_SPOLECZNOSCIOWE, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absolute, slugifyPlace } from "@/lib/site";

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

/**
 * Opis serwisu na stronie głównej: kto to jest i pod jaką nazwą.
 *
 * To jest miejsce, w którym mówimy wyszukiwarce wprost, że „PodKosz" to nazwa własna
 * tego serwisu, a nie przypadkowe słowo w tekście. Bez tego Google musi się tego domyślać
 * z treści, a przy nowej domenie nie ma z czego. `alternateName` łapie pisownię, której
 * ludzie faktycznie używają w wyszukiwarce, a `sameAs` wiąże stronę z profilami w innych
 * serwisach - to one są zwykle pierwszym dowodem, że marka istnieje poza własną domeną.
 *
 * `Organization` i `WebSite` idą jako dwa powiązane obiekty (`publisher` wskazuje na
 * organizację), bo tak opisuje to schema.org i tak czyta to Google.
 */
export function SiteStructuredData({ courts }: { courts: number }) {
  const organizacja = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organizacja`,
    name: SITE_NAME,
    alternateName: ["PodKosz.pl", "Pod Kosz", "podkosz"],
    url: SITE_URL,
    logo: `${SITE_URL}/mail/logo.png`,
    description: SITE_DESCRIPTION,
    ...(PROFILE_SPOLECZNOSCIOWE.length ? { sameAs: PROFILE_SPOLECZNOSCIOWE } : {}),
  };

  const dane = {
    "@context": "https://schema.org",
    "@graph": [
      organizacja,
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#serwis`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: "PodKosz.pl",
        inLanguage: "pl-PL",
        description: `Mapa i baza ${courts} boisk do koszykówki w Polsce.`,
        publisher: { "@id": `${SITE_URL}/#organizacja` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
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
