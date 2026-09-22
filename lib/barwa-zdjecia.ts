/**
 * Barwa wizytówki dobrana ze zdjęcia boiska.
 *
 * ------------------------------------------------------------------ po co
 *
 * Wizytówka nad pinezką jest ze szkła i ma w sobie chłodny refleks od dołu. Refleks był
 * wpisany na sztywno na błękitno - i przy boisku o szarej płycie i niebieskiej linii
 * wyglądał świetnie, bo zgadzał się ze zdjęciem. Przy czerwonym tartanie albo o zachodzie
 * słońca wyglądał jak cudza naklejka. Teraz refleks bierze barwę z tego, co na zdjęciu
 * jest najczęstsze, więc karta zawsze pasuje do kadru, nad którym stoi.
 *
 * ------------------------------------------------------------------ czemu w przeglądarce, a nie w bazie
 *
 * Bo nie trzeba nigdzie indziej. Miniatura i tak jest już wczytana w karcie - liczymy
 * barwę z TEGO obrazka, który leży w drzewie. Zero dodatkowych żądań, zero kolumny w
 * bazie, zero przeliczania starych zdjęć przy wdrożeniu.
 *
 * ------------------------------------------------------------------ zatrute płótno
 *
 * Warunkiem jest, żeby obrazek dało się wczytać na płótno, a to wolno tylko dla obrazków
 * Z TEJ SAMEJ DOMENY albo takich, które przysyłają nagłówek CORS. Zdjęcia boisk leżą na
 * `zdjecia.podkosz.pl` i NIE przysyłają go wcale (sprawdzone `curl`-em: w odpowiedzi nie
 * ma ani jednego `access-control-*`), więc `crossOrigin="anonymous"` nie jest wyjściem -
 * przy takim żądaniu obrazek w ogóle by się nie wczytał i zamiast barwy byłaby dziura.
 *
 * Kiedy adres idzie przez `<nasza domena>/cdn-cgi/image/...`, płótno jest czyste i odczyt
 * się udaje. Kiedy nie - a zależy to od ustawienia `NEXT_PUBLIC_CDN_OBRAZKI`, czyli od
 * zmiennej środowiskowej, której kod nie kontroluje - odczyt rzuca `SecurityError`.
 *
 * Dlatego jest DRUGIE PODEJŚCIE: ten sam plik pobrany jeszcze raz przez adres WZGLĘDNY
 * `/cdn-cgi/image/...`. Względny znaczy „z tej samej domeny co strona" z definicji, więc
 * nie ma tu już czego konfigurować ani o czym zapomnieć. Gdy i to nie wyjdzie (lokalnie,
 * gdzie Cloudflare nie stoi przed serwerem, adres oddaje 404), zostaje `null`, a wywołujący
 * zostaje przy swojej barwie domyślnej. To pełnoprawna odpowiedź, nie awaria - dlatego nie
 * ma tu ani jednego `console.error`.
 *
 * ------------------------------------------------------------------ czemu stała jasność i nasycenie
 *
 * Bierzemy ze zdjęcia wyłącznie ODCIEŃ, a nasycenie i jasność wpisujemy swoje. Gdyby
 * przepisywać barwę wprost z pikseli, karta nad ciemnym zdjęciem dostawałaby ciemny,
 * niewidoczny refleks, a nad prześwietlonym - białą plamę. Stały jasny odcień sprawia,
 * że wszystkie wizytówki są równie czytelne i wyglądają jak jedna rodzina w różnych
 * barwach, a nie jak przypadkowy zbiór.
 */

import { zapasowyAdres } from "./obrazy";

/** Ile boisk pamiętamy. Barwa jest tania, ale liczymy ją raz na boisko na sesję. */
const pamiec = new Map<string, string | null>();

export function zapamietanaBarwa(idBoiska: string) {
  return pamiec.get(idBoiska) ?? null;
}

/*
  Progi odsiewania. Dobrane tak, żeby przepuścić czerwony tartan i zielone drzewa, a
  odrzucić asfalt, beton, niebo bez barwy i białe linie boiska.
*/
/** Poniżej tego nasycenia piksel uznajemy za szary i nie liczy się do niczego. */
const MIN_NASYCENIE = 0.1;
/** Za ciemne i za jasne piksele odpadają - w cieniu i w prześwietleniu odcień kłamie. */
const MIN_JASNOSC = 0.12;
const MAX_JASNOSC = 0.9;
/** Ile barwnych pikseli musi w ogóle być, żeby było o czym mówić (z 32 x 32 = 1024). */
const MIN_BARWNYCH = 60;
/** Jaki udział musi mieć zwycięski odcień, żeby uznać go za „ten z kadru". */
const MIN_UDZIAL = 0.16;

/** Ile kubełków odcienia. 24 to co 15 stopni - dość, by odróżnić pomarańcz od czerwieni. */
const KUBELKI = 24;
const KROK = 360 / KUBELKI;

/** Nasycenie i jasność refleksu - stałe, patrz nota na górze pliku. */
const NASYCENIE_REFLEKSU = 0.72;
const JASNOSC_REFLEKSU = 0.66;

/**
 * Najczęstszy odcień obrazka jako trójka `"r g b"` gotowa do `rgb(... / alfa)`.
 * `null` znaczy „nie da się" albo „zdjęcie nie ma dominującej barwy" - w obu wypadkach
 * wywołujący ma zostać przy wartości domyślnej.
 */
export function barwaZObrazka(img: HTMLImageElement, idBoiska?: string): string | null {
  const gotowa = idBoiska ? pamiec.get(idBoiska) : undefined;
  if (gotowa !== undefined) return gotowa;

  const wynik = policz(img);
  if (wynik === ZATRUTE) return null;
  if (idBoiska) pamiec.set(idBoiska, wynik);
  return wynik;
}

/** Szerokość kopii pobieranej na drugie podejście - do policzenia barwy więcej nie trzeba. */
const SZEROKOSC_KOPII = 96;

/**
 * Barwa zdjęcia, z drugim podejściem przez adres z własnej domeny.
 *
 * Zwraca `null`, gdy nie da się jej ustalić - wywołujący zostaje przy swojej domyślnej.
 * Wynik (także pusty) zapamiętujemy, więc na jedno boisko przypada najwyżej jedna próba
 * na sesję, choćby kafelek pojawił się na pięciu stronach.
 */
export async function ustalBarwe(
  img: HTMLImageElement,
  adresOryginalu: string,
  idBoiska: string
): Promise<string | null> {
  const gotowa = pamiec.get(idBoiska);
  if (gotowa !== undefined) return gotowa;

  const wprost = policz(img);
  if (wprost !== ZATRUTE) {
    pamiec.set(idBoiska, wprost);
    return wprost;
  }

  /*
    Adres WZGLĘDNY, celowo bez domeny: dzięki temu jest z tej samej domeny co strona
    niezależnie od tego, czy i na co ustawiono `NEXT_PUBLIC_CDN_OBRAZKI`.
  */
  /*
    Rozwijamy adres do surowego pliku, zanim go opakujemy. Wołający podaje to, co ma pod
    ręką, a to bywa już przepuszczone przez Cloudflare - opakowanie takiego adresu drugi
    raz dałoby `/cdn-cgi/image/.../cdn-cgi/image/...`, czyli 404.
  */
  const kopia = new Image();
  kopia.decoding = "async";
  kopia.src = `/cdn-cgi/image/width=${SZEROKOSC_KOPII},quality=60,format=auto,fit=scale-down/${zapasowyAdres(adresOryginalu)}`;

  const wynik = await new Promise<string | null>((oddaj) => {
    kopia.onload = () => {
      const b = policz(kopia);
      oddaj(b === ZATRUTE ? null : b);
    };
    kopia.onerror = () => oddaj(null);
  });

  pamiec.set(idBoiska, wynik);
  return wynik;
}

/** Odróżnia „nie wolno czytać pikseli" od „przeczytane, ale bez dominującej barwy". */
const ZATRUTE = Symbol("zatrute-plotno");

function policz(img: HTMLImageElement): string | null | typeof ZATRUTE {
  /*
    32 x 32 wystarczy z zapasem: szukamy najczęstszej barwy, a nie szczegółu. Przy tym
    rozmiarze przeglądarka dodatkowo uśrednia sąsiednie piksele przy zmniejszaniu, co
    samo z siebie wycina pojedyncze, krzykliwe punkty.
  */
  const BOK = 32;

  let dane: Uint8ClampedArray;
  try {
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const plotno = document.createElement("canvas");
    plotno.width = BOK;
    plotno.height = BOK;
    const ctx = plotno.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, BOK, BOK);
    dane = ctx.getImageData(0, 0, BOK, BOK).data;
  } catch {
    /*
      Zatrute płótno (obrazek z obcej domeny bez CORS). Oddajemy ZNACZNIK, a nie `null`:
      to jedyny przypadek, w którym warto spróbować jeszcze raz innym adresem. „Zdjęcie
      bez dominującej barwy" wygląda z zewnątrz tak samo, a ponawiać go nie ma po co.
    */
    return ZATRUTE;
  }

  const wagi = new Array<number>(KUBELKI).fill(0);
  /* sumy do średniej ważonej wewnątrz zwycięskiego kubełka - liczone od razu, w jednym przebiegu */
  const sumaSin = new Array<number>(KUBELKI).fill(0);
  const sumaCos = new Array<number>(KUBELKI).fill(0);
  let barwnych = 0;

  for (let i = 0; i < dane.length; i += 4) {
    const r = dane[i] / 255;
    const g = dane[i + 1] / 255;
    const b = dane[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const jasnosc = (max + min) / 2;
    const rozpietosc = max - min;

    if (rozpietosc < MIN_NASYCENIE) continue;
    if (jasnosc < MIN_JASNOSC || jasnosc > MAX_JASNOSC) continue;

    const nasycenie = rozpietosc / (1 - Math.abs(2 * jasnosc - 1));

    let odcien: number;
    if (max === r) odcien = ((g - b) / rozpietosc) % 6;
    else if (max === g) odcien = (b - r) / rozpietosc + 2;
    else odcien = (r - g) / rozpietosc + 4;
    odcien = (odcien * 60 + 360) % 360;

    /*
      Waga to nasycenie, nie sztuka. Dzięki temu jeden mocno czerwony tartan waży więcej
      niż tyle samo pikseli ledwie różowawego betonu - a to ten pierwszy jest tym, co
      widać na zdjęciu.
    */
    const k = Math.min(KUBELKI - 1, Math.floor(odcien / KROK));
    wagi[k] += nasycenie;
    const rad = (odcien * Math.PI) / 180;
    sumaSin[k] += Math.sin(rad) * nasycenie;
    sumaCos[k] += Math.cos(rad) * nasycenie;
    barwnych += 1;
  }

  if (barwnych < MIN_BARWNYCH) return null;

  const razem = wagi.reduce((a, b) => a + b, 0);
  if (razem <= 0) return null;

  let najlepszy = 0;
  for (let k = 1; k < KUBELKI; k += 1) if (wagi[k] > wagi[najlepszy]) najlepszy = k;
  if (wagi[najlepszy] / razem < MIN_UDZIAL) return null;

  /*
    Średnia po kącie, a nie po liczbie: odcień jest okręgiem, więc czerwień leży i przy
    0, i przy 360 stopniach. Zwykła średnia arytmetyczna z takiej pary dawałaby zieleń.
  */
  const odcien =
    (Math.atan2(sumaSin[najlepszy], sumaCos[najlepszy]) * 180) / Math.PI;

  return hslNaTrojke((odcien + 360) % 360, NASYCENIE_REFLEKSU, JASNOSC_REFLEKSU);
}

/** HSL na `"r g b"` - w takiej postaci arkusz składa z tego kolor z własną przezroczystością. */
function hslNaTrojke(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const b255 = (v: number) => Math.round((v + m) * 255);
  return `${b255(r)} ${b255(g)} ${b255(b)}`;
}
