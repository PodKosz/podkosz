import { adresKlienta } from "@/lib/adres-ip";
import { przepustka, zaDuzo } from "@/lib/limity";
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

/**
 * Ile najwyżej wolno czekać w kolejce.
 *
 * TU BYŁA NAJTAŃSZA DZIURA W CAŁYM SERWISIE. Kolejka nie miała końca: każde żądanie
 * przesuwało `ostatnie` o 1,1 s w przyszłość i czekało, aż przyjdzie jego pora. Setne
 * żądanie czekało sto dziesięć sekund - a przez ten czas zajmowało instancję funkcji.
 * Kilkaset żądań w pętli (jedna linijka w bashu) zajmowało wszystkie instancje na
 * kilka minut i wyszukiwarka adresów przestawała działać dla wszystkich naraz.
 *
 * Teraz kolejka ma sufit: kto trafi na zatłoczoną, dostaje 429 i wie, kiedy wrócić.
 * Odmowa w ćwierć sekundy jest zawsze lepsza niż odpowiedź po dwóch minutach.
 */
const MAKS_KOLEJKA_MS = 2_500;

async function poczekaj() {
  const teraz = Date.now();
  const dlug = ostatnie + ODSTEP_MS - teraz;
  ostatnie = Math.max(teraz, ostatnie + ODSTEP_MS);
  if (dlug > 0) await new Promise((r) => setTimeout(r, dlug));
}

/** Tylko te ścieżki Nominatim, których naprawdę używamy - reszta to otwarty pośrednik. */
const DOZWOLONE = new Set(["search", "reverse"]);

/**
 * Parametry, które wolno podać dalej.
 *
 * Wcześniej przepisywaliśmy WSZYSTKIE parametry zapytania. To znaczy, że przez nasz serwer
 * dało się wołać Nominatim z dowolnymi parametrami - z naszym adresem IP i naszą
 * identyfikacją w nagłówku. Cudzy ruch, nasza kara. Lista poniżej to dokładnie to, czego
 * używa `lib/geo.ts`.
 */
const PARAMETRY: Record<string, number> = {
  q: 160,
  city: 120,
  lat: 24,
  lon: 24,
  limit: 2,
  addressdetails: 1,
  countrycodes: 32,
  featureType: 16,
  zoom: 2,
};

export async function GET(request: Request) {
  const wejscie = new URL(request.url);
  const tryb = wejscie.searchParams.get("tryb") ?? "";
  if (!DOZWOLONE.has(tryb)) {
    return Response.json({ blad: "nieznany tryb" }, { status: 400 });
  }

  /*
    Trzydzieści zapytań na minutę z jednego adresu. Pole wyszukiwania pyta z opóźnieniem
    po każdej pauzie w pisaniu, więc człowiek szukający adresu zmieści się w tym z zapasem;
    pętla w bashu nie zmieści się nigdy.
  */
  const ip = adresKlienta(request.headers);
  const przepust = przepustka("geo", ip, 30, 60);
  if (!przepust.ok) return zaDuzo(przepust.poczekaj, "Za dużo zapytań o adresy.");

  const cel = new URL(`https://nominatim.openstreetmap.org/${tryb}`);
  cel.searchParams.set("format", "jsonv2");
  for (const [klucz, wartosc] of wejscie.searchParams) {
    const maks = PARAMETRY[klucz];
    if (!maks || wartosc.length > maks) continue;
    cel.searchParams.set(klucz, wartosc);
  }

  /* kolejka zatłoczona - odmawiamy od razu, zamiast trzymać instancję funkcji */
  if (ostatnie - Date.now() > MAKS_KOLEJKA_MS) {
    return zaDuzo(2, "Wyszukiwarka adresów jest chwilowo zajęta.");
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
