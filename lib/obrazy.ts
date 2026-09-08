import { SUPABASE_URL } from "./supabase/config";

/**
 * Skalowanie zdjęć - przez Supabase, nie przez optymalizator Vercela.
 *
 * ------------------------------------------------------------------ dlaczego
 *
 * Optymalizator obrazów na Vercelu przestał działać i to nie jest awaria: przekroczony
 * został limit przekształceń w planie. Każde nowe żądanie wraca z odpowiedzią
 * `402 Payment Required` i nagłówkiem `x-vercel-error:
 * OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`. Zdjęcia raz przetworzone dalej się wyświetlają
 * (leżą w pamięci brzegowej), więc objaw wygląda niewinnie: „dwa zdjęcia w wizytówce się
 * nie ładują". W rzeczywistości nie ładuje się KAŻDE zdjęcie w rozmiarze, o który nikt
 * wcześniej nie poprosił - a to znaczy każde nowo dodane boisko i każdy nowy kadr.
 *
 * Supabase, na którym i tak leżą pliki, potrafi to samo pod adresem
 * `/storage/v1/render/image/...` - sprawdzone na tym projekcie: 320 px z pliku 494 kB
 * waży 60 kB. Zamiana adresu przenosi więc całą pracę tam, gdzie stoją dane, i zdejmuje
 * z serwisu limit, który go zatrzymał.
 *
 * ------------------------------------------------------------------ zapas
 *
 * Gdyby przekształcenia w Supabase też kiedyś zniknęły (wyłączone w projekcie, inny plan),
 * `zapasowyAdres` oddaje surowy plik. Jest cięższy, ale WIDOCZNY - a puste kadry są
 * gorsze od ciężkich. Komponenty używają go w `onError`.
 */

const PREFIKS_OBIEKTU = "/storage/v1/object/public/";
const PREFIKS_RENDERA = "/storage/v1/render/image/public/";

/** Czy to publiczny adres pliku w naszym Supabase - tylko takie umiemy przeskalować. */
function naszePlikiSupabase(adres: string) {
  return Boolean(SUPABASE_URL) && adres.startsWith(`${SUPABASE_URL}${PREFIKS_OBIEKTU}`);
}

/**
 * Adres przeskalowanego zdjęcia.
 *
 * ------------------------------------------------------------------ dlaczego `contain`
 *
 * Sprawdzone na plikach tego serwisu, plik źródłowy 1440 x 1920:
 *
 *   width=320                    -> 320 x 1920,  59 kB   <- SPŁASZCZONE
 *   width=320&resize=cover       -> 320 x 1920,  59 kB   <- SPŁASZCZONE
 *   width=320&resize=fill        ->  75 x 1920,  19 kB   <- SPŁASZCZONE
 *   width=320&resize=contain     -> 320 x  427,  19 kB   <- proporcje zachowane
 *
 * Bez `resize=contain` Supabase zwęża obrazek do podanej szerokości, ale ZOSTAWIA
 * pierwotną wysokość - zdjęcie wychodzi rozciągnięte w pionie i na dodatek trzy razy
 * cięższe, niż powinno. `contain` z samą szerokością dolicza wysokość z proporcji pliku.
 *
 * Kadrowanie zostaje tam, gdzie było od początku: w CSS (`object-cover`). Kafle mają
 * różne proporcje i zmieniają je przy każdej szerokości okna, więc adres obrazka nie
 * jest miejscem, w którym da się o kadrze zdecydować.
 */
export function adresMiniatury(adres: string, szerokosc: number, jakosc = 60) {
  if (!adres) return "";
  if (adres.startsWith("data:") || !naszePlikiSupabase(adres)) return adres;

  const sciezka = adres.slice(`${SUPABASE_URL}${PREFIKS_OBIEKTU}`.length);
  return `${SUPABASE_URL}${PREFIKS_RENDERA}${sciezka}?width=${Math.round(
    szerokosc
  )}&quality=${jakosc}&resize=contain`;
}

/**
 * Zestaw szerokości do `srcSet` - dla zdjęć wstawianych zwykłym `<img>`, poza `next/image`.
 *
 * Przeglądarka bierze z listy wariant pasujący do miejsca, jakie zdjęcie zajmuje na
 * ekranie, i do gęstości ekranu. Bez tego telefon ściąga plik przygotowany pod duży
 * monitor - plakat wydarzenia ważył tak 883 kB, w każdym układzie i na każdym urządzeniu.
 */
export function zestawMiniatur(adres: string, szerokosci: number[], jakosc = 60) {
  if (!adres || adres.startsWith("data:")) return undefined;
  return szerokosci.map((w) => `${adresMiniatury(adres, w, jakosc)} ${w}w`).join(", ");
}

/** Surowy plik - zapas, gdy przeskalowany adres odmówi. */
export function zapasowyAdres(adres: string) {
  if (!adres || adres.startsWith("data:")) return adres;
  if (adres.includes(PREFIKS_RENDERA)) {
    return adres.replace(PREFIKS_RENDERA, PREFIKS_OBIEKTU).split("?")[0];
  }
  return adres;
}
