import { SITE_URL } from "@/lib/site";

/**
 * Pośrednik do Nominatim (geokodowanie OpenStreetMap).
 *
 * Wcześniej przeglądarka pytała Nominatim wprost. To działało, ale łamało zasady OSM na
 * dwa sposoby naraz: żądanie nie niosło żadnej informacji, czyja to aplikacja, a przy
 * kilku osobach naraz nie dało się utrzymać limitu jednego zapytania na sekundę.
 * Nominatim za takie rzeczy blokuje po adresie IP - i to bez ostrzeżenia, po prostu
 * pewnego dnia wyszukiwarka adresów przestaje cokolwiek zwracać.
 *
 * Ruch idzie więc przez nasz serwer, gdzie da się zrobić trzy rzeczy niedostępne
 * w przeglądarce:
 *   - przedstawić się nagłówkiem `User-Agent` z adresem serwisu (tego wymaga regulamin),
 *   - trzymać jedno wspólne tempo dla wszystkich odwiedzających, a nie jedno na osobę,
 *   - zapamiętać odpowiedź, bo te same miasta pytane są w kółko.
 *
 * Odpowiedź podajemy dalej w surowej postaci - konwersję robi `lib/geo.ts`, żeby ta
 * trasa była cienka i nie musiała znać się na formacie danych.
 */

/** Regulamin OSM: najwyżej jedno zapytanie na sekundę z jednego źródła. */
const ODSTEP_MS = 1100;
/** Jak długo trzymamy odpowiedź. Adresy nie zmieniają się w ciągu doby. */
const CACHE_S = 86_400;

/*
  Pamięć ostatniego zapytania żyje w instancji funkcji. Vercel trzyma ich kilka naraz,
  więc to nie jest twarda gwarancja jednego zapytania na sekundę w skali całego świata -
  ale zbija najgorszy przypadek (jeden człowiek piszący w polu wyszukiwarki) z kilkunastu
  zapytań na sekundę do jednego. Resztę załatwia pamięć podręczna odpowiedzi.
*/
let ostatnie = 0;

async function poczekaj() {
  const teraz = Date.now();
  const dlug = ostatnie + ODSTEP_MS - teraz;
  ostatnie = Math.max(teraz, ostatnie + ODSTEP_MS);
  if (dlug > 0) await new Promise((r) => setTimeout(r, dlug));
}

/** Tylko te ścieżki Nominatim, których naprawdę używamy - reszta to otwarty pośrednik. */
const DOZWOLONE = new Set(["search", "reverse"]);

export async function GET(request: Request) {
  const wejscie = new URL(request.url);
  const tryb = wejscie.searchParams.get("tryb") ?? "";
  if (!DOZWOLONE.has(tryb)) {
    return Response.json({ blad: "nieznany tryb" }, { status: 400 });
  }

  const cel = new URL(`https://nominatim.openstreetmap.org/${tryb}`);
  cel.searchParams.set("format", "jsonv2");
  for (const [klucz, wartosc] of wejscie.searchParams) {
    if (klucz === "tryb" || klucz === "format") continue;
    cel.searchParams.set(klucz, wartosc);
  }

  await poczekaj();

  try {
    const res = await fetch(cel, {
      headers: {
        /* regulamin OSM wymaga identyfikacji aplikacji i kontaktu */
        "User-Agent": `PodKosz/1.0 (${SITE_URL})`,
        Referer: SITE_URL,
        "Accept-Language": "pl",
      },
      next: { revalidate: CACHE_S },
    });

    /*
      429 i 403 to odpowiedzi Nominatim na przekroczony limit. Podajemy je dalej z tym
      samym kodem, żeby w panelu było widać, że to nie nasza awaria, tylko wyczerpany
      limit - inaczej człowiek widzi „brak wyników" i szuka błędu u siebie.
    */
    if (res.status === 429 || res.status === 403) {
      return Response.json(
        { blad: "Nominatim chwilowo odmawia (limit zapytań). Spróbuj za chwilę." },
        { status: res.status }
      );
    }
    if (!res.ok) {
      return Response.json({ blad: `Nominatim: ${res.status}` }, { status: 502 });
    }

    const dane = await res.json();
    return Response.json(dane, {
      headers: { "Cache-Control": `public, max-age=${CACHE_S}, s-maxage=${CACHE_S}` },
    });
  } catch {
    return Response.json({ blad: "Nominatim nie odpowiada." }, { status: 502 });
  }
}
