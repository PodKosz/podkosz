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

/**
 * Adres strefy Cloudflare, która skaluje obrazki zamiast Supabase.
 *
 * ------------------------------------------------------------------ po co
 *
 * Supabase liczy skalowanie po „obrazach źródłowych": sto w cenie planu, potem 5 dolarów
 * za każdy tysiąc, CO MIESIĄC. Przy tysiącu boisk z dziewięcioma zdjęciami to dziewięć
 * tysięcy obrazów, czyli jakieś 44 dolary miesięcznie - i osobno transfer, z którego
 * w planie jest 250 GB.
 *
 * Cloudflare liczy to samo po „unikalnych przekształceniach": pięć tysięcy gratis, potem
 * 50 centów za tysiąc na miesiąc, a powtórzone żądanie tego samego rozmiaru w tym samym
 * miesiącu liczy się RAZ. Te same dziewięć tysięcy zdjęć w czterech rozmiarach to 36
 * tysięcy przekształceń, czyli około 15 dolarów - a transfer jest darmowy, bo pliki
 * lecą z brzegu Cloudflare, nie z Supabase.
 *
 * ------------------------------------------------------------------ skąd źródło
 *
 * Przy tej ścieżce NIE używamy skalowania Supabase w ogóle: Cloudflare dostaje adres
 * SUROWEGO pliku i sam go zmniejsza. Supabase wydaje wtedy oryginał raz na wariant,
 * a nie przy każdym żądaniu.
 *
 * ------------------------------------------------------------------ jak włączyć
 *
 * `NEXT_PUBLIC_CDN_OBRAZKI=https://podkosz.pl` (albo dowolna nazwa hosta w tej samej
 * strefie Cloudflare). Puste - i wszystko chodzi jak dotąd, przez Supabase. Dzięki temu
 * przełączenie jest jedną zmienną, a nie wydaniem nowej wersji kodu, i w każdej chwili
 * da się wrócić.
 */
const CDN = (process.env.NEXT_PUBLIC_CDN_OBRAZKI ?? "").trim().replace(/\/+$/, "");

const PREFIKS_OBIEKTU = "/storage/v1/object/public/";
const PREFIKS_RENDERA = "/storage/v1/render/image/public/";

/**
 * Jakość kompresji. Jedno miejsce, bo to jest pokrętło, które się kręci całe naraz.
 *
 * Wartości są wyższe niż wcześniej (55 i 60) i to jest świadoma zmiana kierunku: zdjęcie
 * boiska jest tu główną treścią, a nie ozdobą tekstu.
 *
 * PŁACIMY ZA TO WAGĄ. Zmierzone na prawdziwym kadrze z tego serwisu:
 *
 *     200 px   9,0 kB (q55)  ->  11,1 kB (q68)   +23%
 *     480 px    53 kB (q60)  ->    66 kB (q72)   +25%
 *    1440 px   462 kB (q60)  ->   652 kB (q72)   +41%
 *
 * Nie udaję, że to się samo odrobi. Krąży przekonanie, że AVIF „zawsze waży mniej" - przy
 * tym konkretnym zdjęciu sprawdziłem lokalnie i przy tej samej jakości wyszło TYLE SAMO
 * albo więcej niż JPEG. Ile naprawdę odda koder Cloudflare, będzie wiadomo dopiero po
 * włączeniu strefy; do tego czasu traktujemy te plus dwadzieścia kilka procent jako
 * prawdziwy koszt.
 *
 * Co czyni ten koszt do przyjęcia, to nie format, tylko to, KTO PŁACI ZA TRANSFER: przez
 * Cloudflare pliki lecą z brzegu i nie liczą się do puli Supabase. Cięższy plik wysłany
 * raz i serwowany z pamięci brzegowej jest tańszy od lżejszego wysyłanego za każdym razem.
 */
export const JAKOSC_MINIATURY = 68;
export const JAKOSC_ZDJECIA = 72;
export const JAKOSC_PLAKATU = 76;

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
export function adresMiniatury(adres: string, szerokosc: number, jakosc = JAKOSC_ZDJECIA) {
  if (!adres) return "";
  if (adres.startsWith("data:") || !naszePlikiSupabase(adres)) return adres;

  const w = Math.round(szerokosc);

  /*
    Droga przez Cloudflare, gdy jest skonfigurowana. Oryginalny adres doklejamy na końcu
    BEZ kodowania - tego wymaga format `/cdn-cgi/image/`; zakodowany nie zostałby
    rozpoznany jako źródło.

    `fit=scale-down` zamiast `contain`: zachowuje proporcje tak samo, ale NIGDY nie
    powiększa. Supabase przy samej szerokości potrafi rozciągnąć mniejszy plik w górę,
    czyli wyprodukować większy obrazek bez ani jednego nowego piksela szczegółu.

    `format=auto` oddaje AVIF albo WebP zależnie od przeglądarki - stąd można było podnieść
    jakość i mimo to zejść z wagi poniżej dzisiejszego JPEG-a.
  */
  if (CDN) {
    return `${CDN}/cdn-cgi/image/width=${w},quality=${jakosc},format=auto,fit=scale-down/${adres}`;
  }

  const sciezka = adres.slice(`${SUPABASE_URL}${PREFIKS_OBIEKTU}`.length);
  return `${SUPABASE_URL}${PREFIKS_RENDERA}${sciezka}?width=${w}&quality=${jakosc}&resize=contain`;
}

/**
 * Zestaw szerokości do `srcSet` - dla zdjęć wstawianych zwykłym `<img>`, poza `next/image`.
 *
 * Przeglądarka bierze z listy wariant pasujący do miejsca, jakie zdjęcie zajmuje na
 * ekranie, i do gęstości ekranu. Bez tego telefon ściąga plik przygotowany pod duży
 * monitor - plakat wydarzenia ważył tak 883 kB, w każdym układzie i na każdym urządzeniu.
 */
export function zestawMiniatur(adres: string, szerokosci: number[], jakosc = JAKOSC_ZDJECIA) {
  if (!adres || adres.startsWith("data:")) return undefined;
  return szerokosci.map((w) => `${adresMiniatury(adres, w, jakosc)} ${w}w`).join(", ");
}

/** Surowy plik - zapas, gdy przeskalowany adres odmówi. */
export function zapasowyAdres(adres: string) {
  if (!adres || adres.startsWith("data:")) return adres;

  /*
    Adres przez Cloudflare ma oryginał doklejony na końcu, więc zapas to po prostu wszystko
    od miejsca, w którym zaczyna się nasz Supabase. Warunek `> 0`, a nie `>= 0`: pod zerem
    stoi adres, który JUŻ jest surowym plikiem, i nie ma z czego go obcinać.
  */
  const odCdn = adres.indexOf(`${SUPABASE_URL}${PREFIKS_OBIEKTU}`);
  if (odCdn > 0) return adres.slice(odCdn);

  if (adres.includes(PREFIKS_RENDERA)) {
    return adres.replace(PREFIKS_RENDERA, PREFIKS_OBIEKTU).split("?")[0];
  }
  return adres;
}
