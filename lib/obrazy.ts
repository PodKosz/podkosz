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
 * `resize=cover` dobrane pod kafle o stałych proporcjach - obcina, ale nigdy nie zostawia
 * pustych pasów. Wysokości nie podajemy: szerokość wystarcza, a przy podanych obu
 * wymiarach trzeba by znać proporcje każdego pliku.
 */
export function adresMiniatury(adres: string, szerokosc: number, jakosc = 60) {
  if (!adres) return "";
  if (adres.startsWith("data:") || !naszePlikiSupabase(adres)) return adres;

  const sciezka = adres.slice(`${SUPABASE_URL}${PREFIKS_OBIEKTU}`.length);
  return `${SUPABASE_URL}${PREFIKS_RENDERA}${sciezka}?width=${Math.round(
    szerokosc
  )}&quality=${jakosc}&resize=cover`;
}

/** Surowy plik - zapas, gdy przeskalowany adres odmówi. */
export function zapasowyAdres(adres: string) {
  if (!adres || adres.startsWith("data:")) return adres;
  if (adres.includes(PREFIKS_RENDERA)) {
    return adres.replace(PREFIKS_RENDERA, PREFIKS_OBIEKTU).split("?")[0];
  }
  return adres;
}
