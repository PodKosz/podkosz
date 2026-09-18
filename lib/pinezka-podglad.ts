/**
 * PODGLĄD PROPOZYCJI PINEZEK - RUSZTOWANIE DO WYRZUCENIA
 *
 * ------------------------------------------------------------------ po co to jest
 *
 * Galeria propozycji pokazuje pinezki na czarnym tle, obok siebie, w powiększeniu.
 * To dobre do porównywania kształtów i beznadziejne do jedynej decyzji, która się
 * naprawdę liczy: czy TA pinezka działa na mapie, w swoim prawdziwym rozmiarze,
 * w tłumie innych pinezek, nad kafelkiem z ulicami. Ten plik pozwala obejrzeć
 * dowolny wariant wprost na mapie, bez przebudowywania serwisu pod każdy z osobna.
 *
 * Włącza się wyłącznie parametrem w adresie: `/?pinezka=17`. Bez parametru nie robi
 * NIC - `markerHtml` idzie swoją dotychczasową drogą, znak po znaku. To celowe:
 * dopóki nie ma wyboru, produkcja nie może się o to rusztowanie potknąć.
 *
 * ------------------------------------------------------------------ co zostaje z mapy, a co z galerii
 *
 * Z galerii bierzemy TYLKO kształt. Wszystko, co żyje na mapie, zostaje mapy:
 *
 *   - poświata i jej pulsowanie (`pulse-glow`),
 *   - ogień zapisów (`pinezka-ogien`) - animowany, sterowany atrybutem `data-osoby`,
 *   - powiększenie przy najechaniu i przy dotknięciu (`marker-core`),
 *   - skalowanie od liczby zapisanych, od rozmiaru ekranu i od przybliżenia.
 *
 * Dlatego w wariantach nie ma ani `luna`, ani `plomien`, ani gwiazdki wyróżnienia -
 * galeria dorysowywała je sobie sama, bo nie miała mapy pod spodem. Tutaj byłyby
 * drugim kompletem tego samego.
 *
 * ------------------------------------------------------------------ dlaczego każdy wariant podaje swoją „głowę”
 *
 * Kształty mają różne proporcje: kula siedzi pośrodku kadru, łezka jest wyższa,
 * słupek ma kulę wysoko i długi maszt. Gdyby rysować je wszystkie w jednej skali,
 * jedne byłyby wielkie, a inne malutkie - i porównanie kłamałoby.
 *
 * Każdy wariant deklaruje więc, gdzie ma środek i jaki promień ma jego główna forma.
 * Z tego liczymy skalę tak, żeby KAŻDY wariant miał głowę dokładnie tej średnicy,
 * co dzisiejsza pinezka (38 px, 46 px dla popularnych, 67 px dla wydarzenia).
 * Z tego samego wyliczenia bierze się położenie ognia: arkusz zakłada, że spód kuli
 * jest 13 px nad zaczepieniem (nóżka 10 + kropka 3), a tutaj ta odległość zależy od
 * wariantu, więc podajemy ją stylem wprost na elemencie.
 */

import { szwyPilki } from "./pilka";

/** Stan pinezki - te same trzy, które mapa rozróżnia barwą. Ogień dokłada arkusz. */
export type StanPinezki = "zwykla" | "approved" | "wydarzenie";

type Barwy = { jasny: string; sredni: string; ciemny: string; szew: string };

/*
  Barwy podajemy zmiennymi serwisu tam, gdzie serwis je ma - dzięki temu podgląd
  reaguje na jasny i ciemny motyw tak samo jak prawdziwa pinezka. Wyróżnienie i
  wydarzenie mają w `markerHtml` wpisane wartości na sztywno, więc tu też.
*/
const BARWY: Record<StanPinezki, Barwy> = {
  zwykla: {
    jasny: "var(--color-glow-soft,#ffc47d)",
    sredni: "var(--color-flame,#ff7a18)",
    ciemny: "var(--color-ember,#ff4d0a)",
    szew: "rgba(40,10,0,.72)",
  },
  approved: {
    jasny: "#e9d5ff",
    sredni: "#a855f7",
    ciemny: "#6d28d9",
    szew: "rgba(35,5,60,.7)",
  },
  wydarzenie: {
    jasny: "#ffffff",
    sredni: "#ff4d60",
    ciemny: "#c20d24",
    szew: "rgba(120,6,18,.65)",
  },
};

/*
  Szwy bierzemy z `lib/pilka.ts`, tego samego miejsca co cały serwis. Podgląd, który
  rysowałby piłkę po swojemu, po pierwszej zmianie układu zacząłby kłamać - pokazywałby
  kształt, którego na mapie nie ma.
*/
function szwy(farba: string, cx: number, cy: number, r: number, grubosc = 1.05) {
  return `<g stroke="${farba}" stroke-width="${grubosc}" fill="none" stroke-linecap="round">
    <path d="${szwyPilki(cx, cy, r)}"/></g>`;
}

/** Nóżka i kropka oparcia - wspólne dla wariantów „na nóżce”. */
function nozka(b: Barwy, cx: number, gora: number, dl: number) {
  return `<rect x="${cx - 1.05}" y="${gora}" width="2.1" height="${dl}" rx="1.05" fill="${b.sredni}" opacity=".95"/>
    <ellipse cx="${cx}" cy="${gora + dl + 1.4}" rx="3.4" ry="1.5" fill="${b.sredni}" opacity=".55"/>`;
}

type Wariant = {
  nr: number;
  nazwa: string;
  /** Środek i promień głównej formy - z tego liczy się skala i zaczepienie ognia. */
  glowa: { cy: number; r: number };
  /** `g` to identyfikator gradientu korpusu, już zdefiniowany w `<defs>`. */
  rysuj: (b: Barwy, g: string) => string;
};

/*
  Piętnaście wariantów wybranych z galerii. Numery są te z galerii i celowo NIE są
  ciągłe - gdyby je tu przenumerować, rozmowa o „siedemnastce” przestałaby się kleić.
*/
const WARIANTY: Wariant[] = [
  {
    nr: 1,
    nazwa: "Kula na nóżce",
    glowa: { cy: 24, r: 13 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="13" fill="url(#${g})"/>${szwy(b.szew, 24, 24, 13)}${nozka(b, 24, 37, 9)}`,
  },
  {
    nr: 2,
    nazwa: "Łezka",
    glowa: { cy: 22, r: 14 },
    rysuj: (b, g) =>
      `<path d="M24 47 C24 47 38 33 38 22 A14 14 0 1 0 10 22 C10 33 24 47 24 47 Z" fill="url(#${g})"/>
       <circle cx="24" cy="21" r="8.4" fill="rgba(0,0,0,.16)"/>${szwy(b.szew, 24, 21, 8.4, 0.95)}`,
  },
  {
    nr: 7,
    nazwa: "Obręcz",
    glowa: { cy: 24, r: 15.2 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="13.5" fill="none" stroke="url(#${g})" stroke-width="3.4"/>
       <circle cx="24" cy="24" r="8.6" fill="url(#${g})"/>${szwy(b.szew, 24, 24, 8.6, 0.95)}${nozka(b, 24, 38, 8)}`,
  },
  {
    nr: 8,
    nazwa: "Tablica",
    glowa: { cy: 22, r: 15 },
    rysuj: (b, g) =>
      `<rect x="9" y="9" width="30" height="22" rx="3" fill="url(#${g})" opacity=".55"/>
       <rect x="17.5" y="17" width="13" height="9" rx="1.4" fill="none" stroke="${b.szew}" stroke-width="1.2"/>
       <circle cx="24" cy="27" r="8.4" fill="url(#${g})"/>${szwy(b.szew, 24, 27, 8.4, 0.95)}${nozka(b, 24, 36, 9)}`,
  },
  {
    nr: 11,
    nazwa: "Pierścień światła",
    glowa: { cy: 24, r: 14 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="17" fill="none" stroke="${b.sredni}" stroke-width="1.1" opacity=".45"/>
       <circle cx="24" cy="24" r="12" fill="url(#${g})"/>${szwy(b.szew, 24, 24, 12)}${nozka(b, 24, 36, 9)}`,
  },
  {
    nr: 13,
    nazwa: "Szpilka",
    glowa: { cy: 20, r: 11.5 },
    rysuj: (b, g) =>
      `<path d="M23 30 L25 30 L24.6 48 H23.4 Z" fill="${b.ciemny}"/>
       <ellipse cx="24" cy="30" rx="11" ry="3.6" fill="${b.ciemny}" opacity=".55"/>
       <circle cx="24" cy="20" r="11.5" fill="url(#${g})"/>${szwy(b.szew, 24, 20, 11.5)}`,
  },
  {
    nr: 16,
    nazwa: "Negatyw",
    glowa: { cy: 24, r: 13 },
    /*
      Jedyny wariant z maską: piłka jest DZIURĄ w pełnej kuli, a nie rysunkiem na niej.
      Maska musi mieć własny, niepowtarzalny identyfikator - stąd doklejenie go do
      identyfikatora gradientu, który i tak jest unikalny w obrębie strony.
    */
    rysuj: (b, g) =>
      `<mask id="m${g}">
         <rect x="0" y="0" width="48" height="50" fill="#000"/>
         <circle cx="24" cy="24" r="13" fill="#fff"/>
         ${szwy("#000", 24, 24, 13, 2.2)}
       </mask>
       <rect x="0" y="0" width="48" height="50" fill="url(#${g})" mask="url(#m${g})"/>${nozka(b, 24, 37, 9)}`,
  },
  {
    nr: 17,
    nazwa: "Sam szew",
    glowa: { cy: 24, r: 13.8 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="12.5" fill="none" stroke="url(#${g})" stroke-width="2.6"/>
       ${szwy(`url(#${g})`, 24, 24, 12.5, 1.8)}${nozka(b, 24, 36.5, 9)}`,
  },
  {
    nr: 18,
    nazwa: "Siatka",
    glowa: { cy: 21, r: 11.5 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="21" r="11.5" fill="url(#${g})"/>${szwy(b.szew, 24, 21, 11.5)}
       <g stroke="${b.sredni}" stroke-width="1.1" fill="none" opacity=".8">
         <path d="M15 33 L18 45 M24 33 V46 M33 33 L30 45"/>
         <path d="M15.6 37 H32.4 M17.4 41.5 H30.6"/></g>`,
  },
  {
    nr: 24,
    nazwa: "Płytka",
    glowa: { cy: 23, r: 12 },
    rysuj: (b, g) =>
      `<ellipse cx="24" cy="40" rx="15" ry="5" fill="${b.ciemny}" opacity=".35"/>
       <circle cx="24" cy="23" r="12" fill="url(#${g})"/>${szwy(b.szew, 24, 23, 12)}`,
  },
  {
    nr: 26,
    nazwa: "Aureola",
    glowa: { cy: 24, r: 14 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="15.5" fill="${b.sredni}" opacity=".14"/>
       <circle cx="24" cy="24" r="12" fill="url(#${g})"/>${szwy(b.szew, 24, 24, 12)}${nozka(b, 24, 36, 9)}`,
  },
  {
    nr: 27,
    nazwa: "Słupek",
    glowa: { cy: 18, r: 10.5 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="18" r="10.5" fill="url(#${g})"/>${szwy(b.szew, 24, 18, 10.5)}
       <rect x="23.2" y="28" width="1.6" height="16" fill="${b.sredni}" opacity=".9"/>
       <ellipse cx="24" cy="45" rx="4.4" ry="1.8" fill="${b.sredni}" opacity=".5"/>`,
  },
  {
    nr: 31,
    nazwa: "Sam szew gruby",
    glowa: { cy: 24, r: 14.9 },
    rysuj: (b, g) =>
      `<circle cx="24" cy="24" r="13.4" fill="none" stroke="url(#${g})" stroke-width="3"/>
       ${szwy(`url(#${g})`, 24, 24, 13.4, 2.4)}${nozka(b, 24, 37.5, 8)}`,
  },
  {
    nr: 33,
    nazwa: "Szew w łezce",
    glowa: { cy: 22, r: 14 },
    rysuj: (b, g) =>
      `<path d="M24 47 C24 47 38 33 38 22 A14 14 0 1 0 10 22 C10 33 24 47 24 47 Z"
         fill="none" stroke="url(#${g})" stroke-width="2.6" stroke-linejoin="round"/>
       <circle cx="24" cy="21" r="8" fill="none" stroke="url(#${g})" stroke-width="1.7"/>
       ${szwy(`url(#${g})`, 24, 21, 8, 1.4)}`,
  },
  {
    nr: 35,
    nazwa: "Szew na szpilce",
    glowa: { cy: 20, r: 11.4 },
    rysuj: (b, g) =>
      `<path d="M24 31.4 V47" fill="none" stroke="${b.sredni}" stroke-width="1.5" stroke-linecap="round"/>
       <circle cx="24" cy="20" r="11.4" fill="none" stroke="url(#${g})" stroke-width="2.6"/>
       ${szwy(`url(#${g})`, 24, 20, 11.4, 1.8)}`,
  },
];

export const NUMERY_WARIANTOW = WARIANTY.map((w) => w.nr);

/**
 * Który wariant wybrano w adresie. `null` znaczy „żaden” i wtedy mapa rysuje po swojemu.
 *
 * Czytamy raz i zapamiętujemy: `markerHtml` wywołuje się dla każdej pinezki z osobna,
 * a adres w trakcie życia strony się nie zmienia.
 */
let wybrany: number | null | undefined;

export function wariantZAdresu(): number | null {
  if (wybrany !== undefined) return wybrany;
  if (typeof window === "undefined") return null;

  const surowy = new URLSearchParams(window.location.search).get("pinezka");
  const nr = Number(surowy);
  wybrany = surowy && NUMERY_WARIANTOW.includes(nr) ? nr : null;
  return wybrany;
}

export function nazwaWariantu(nr: number) {
  return WARIANTY.find((w) => w.nr === nr)?.nazwa ?? null;
}

/*
  Identyfikatory gradientów muszą być niepowtarzalne w obrębie CAŁEGO dokumentu, a nie
  pojedynczej pinezki - inaczej wszystkie pinezki wzięłyby wypełnienie z pierwszej.
*/
let licznik = 0;

/**
 * Treść pinezki w wybranym wariancie. Zwraca `null`, gdy numeru nie ma na liście -
 * wywołujący ma wtedy narysować pinezkę po staremu.
 */
export function pinezkaPodgladHtml(
  nr: number,
  stan: StanPinezki,
  size: number,
  dodatki: { glow: string; cien: string; ogien: Record<string, string> }
): string | null {
  const w = WARIANTY.find((x) => x.nr === nr);
  if (!w) return null;

  const b = BARWY[stan];
  const g = `pp${(licznik += 1)}`;

  /*
    Kadr przycięty do 50 jednostek wysokości: w galerii było 64, ale dolne kilkanaście
    to puste miejsce pod pinezką. Na mapie ta pustka przesuwałaby całą pinezkę w górę
    względem punktu, który wskazuje.
  */
  const WYS = 50;
  const skala = size / (2 * w.glowa.r);
  const szer = 48 * skala;
  const wys = WYS * skala;

  /* spód głowy nad dolną krawędzią - tyle, ile arkusz zakłada dla nóżki i kropki */
  const dolOgnia = (WYS - w.glowa.cy - w.glowa.r) * skala;
  /* poświata wyśrodkowana na głowie, a nie na całym kadrze */
  const goraLuny = w.glowa.cy * skala - size * 0.9;

  const zmienne = Object.entries(dodatki.ogien)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");

  return `
  <div class="pinezka-korpus relative flex flex-col items-center transition-transform duration-200 ease-out"
       style="filter: drop-shadow(0 6px 14px rgb(0 0 0 / calc(.6 * var(--moc-cienia, 1))));--kula:${size}px;--cien:${dodatki.cien};${zmienne}">
    <span class="pulse-glow absolute left-1/2 -translate-x-1/2 rounded-full"
          style="top:${goraLuny.toFixed(1)}px;width:${(size * 1.8).toFixed(1)}px;height:${(size * 1.8).toFixed(1)}px;background:radial-gradient(circle, ${dodatki.glow})"></span>
    <span class="pinezka-ogien" style="bottom:${dolOgnia.toFixed(1)}px">
      <span class="ogien-aura"></span>
      <span class="ogien-jezyk"></span>
      <span class="ogien-jezyk ogien-jezyk-maly"></span>
    </span>
    <span class="marker-core relative grid place-items-center transition-all duration-200"
          style="width:${szer.toFixed(1)}px;height:${wys.toFixed(1)}px;border-radius:999px">
      <svg viewBox="0 0 48 ${WYS}" width="${szer.toFixed(1)}" height="${wys.toFixed(1)}" aria-hidden="true">
        <defs>
          <!--
            Gradient w układzie WSPÓŁRZĘDNYCH KADRU, nie obrysu elementu. Warianty
            rysowane samą kreską (17, 31, 33, 35) mają obrys zerowej szerokości przy
            prostej pionowej - przy zwykłym gradiencie przeglądarka nie ma czego
            wypełnić i po prostu nie rysuje takiej linii.
          -->
          <linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="10" y1="9" x2="38" y2="41">
            <stop offset="0" style="stop-color:${b.jasny}"/>
            <stop offset=".55" style="stop-color:${b.sredni}"/>
            <stop offset="1" style="stop-color:${b.ciemny}"/>
          </linearGradient>
        </defs>
        ${w.rysuj(b, g)}
      </svg>
    </span>
  </div>`;
}
