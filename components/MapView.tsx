"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { LngLat, Map as MlMap, Marker, MercatorCoordinate, StyleSpecification, setWorkerUrl } from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapCourt } from "@/lib/types";
import { CITIES_GEOJSON } from "@/lib/cities";
import type { LeadPoint } from "@/lib/leads";
import { HoverCard } from "./HoverCard";
import { rozgrzejBoisko } from "@/lib/galeria";
import { kafelkiPodkladu, podkladMapy } from "@/lib/podklad";
import { ZarWojewodztwa, bboxWojewodztwa, stworzZarWojewodztwa } from "@/lib/zarWojewodztwa";
import { useMotyw } from "@/lib/motyw";
import { FiltrSzkla } from "./FiltrSzkla";
import { czytajWidok, ostatniKadr, zapamietajKadr, zapiszWidok, zapomnijKadr } from "@/lib/adres";
import { pobierzWydarzenia, type Wydarzenie } from "@/lib/wydarzenia";
import { punktyWKadrze, type PunktOsm } from "@/lib/punkty-osm";
import { MIEJSCA_GRY, NAZWY_GIER, type MiejsceGry, type RodzajGry } from "@/lib/minigra";
import { szwyPilki } from "@/lib/pilka";
import { plural } from "@/lib/site";
import { zbudujDrzewoGrup, type GrupaBoisk, type PoziomGrup } from "@/lib/grupy-boisk";
/* podgląd propozycji pinezek - rusztowanie do wyrzucenia, patrz `lib/pinezka-podglad.ts` */
import { pinezkaPodgladHtml, wariantZAdresu } from "@/lib/pinezka-podglad";

/**
 * Barwy dla warstw MapLibre - jedyne miejsce w serwisie, gdzie motyw NIE może iść przez
 * zmienne CSS.
 *
 * MapLibre nie czyta arkusza. Barwy z definicji stylu parsuje sam, własnym parserem, i
 * `var(--color-flame)` nie jest dla niego kolorem - jest błędem, po którym cały styl idzie
 * do kosza razem z mapą. Dlatego warstwy dostają gotowe wartości, a motyw dokłada je
 * później: efekt niżej odczytuje wyliczone zmienne z arkusza i przestawia je przez
 * `setPaintProperty`.
 *
 * Wartości poniżej to motyw ciemny i zarazem zabezpieczenie: gdyby odczyt zmiennych
 * zawiódł, mapa ma czym się pomalować.
 */
const BARWY_MAPY = {
  flame: "#ff7a18",
  glow: "#ffb25c",
  /* tło mapy, kropki miast i podpisy - w motywie jasnym wszystkie idą w drugą stronę */
  tlo: "#07070a",
  atrament: "#ffffff",
};

/** Warstwy mapy, które biorą barwę z motywu: identyfikator i malowana właściwość. */
const WARSTWY_MOTYWU: [
  string,
  "fill-color" | "line-color" | "circle-color" | "background-color" | "text-color" | "text-halo-color",
  keyof typeof BARWY_MAPY,
][] = [
  ["bg", "background-color", "tlo"],
  ["woj-fill", "fill-color", "flame"],
  ["woj-active", "fill-color", "flame"],
  ["woj-line", "line-color", "glow"],
  ["miasta-kropka", "circle-color", "atrament"],
  ["miasta-nazwa", "text-color", "atrament"],
  ["miasta-nazwa", "text-halo-color", "tlo"],
];

/** Wyliczona wartość zmiennej z arkusza; puste zwraca wartość zapasową. */
function zeStylu(nazwa: string, awaryjna: string) {
  if (typeof window === "undefined") return awaryjna;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nazwa).trim();
  return v || awaryjna;
}

const POLAND_BOUNDS: [number, number, number, number] = [13.9, 48.9, 24.3, 55.0];

/*
  Kraje dookoła Polski stopniowo gasną w tło mapy, a sama Polska zostaje w pełnym kolorze
  (wybrana opcja 50 z podglądu „Mapa na nowo", październik 2026).

  Ciemność składa się z trzech warstw, bo każda robi co innego:
    - `winieta-blisko`: stałe `a0` na całym świecie poza Polską (`polska-maska.geojson`,
      suma województw). Wektor, więc krawędź przy granicy jest ostra przy każdym przybliżeniu;
    - `winieta`: obrazek z gradientem dalej od granicy, z plamistym szumem, żeby front
      ciemności nie był równym pierścieniem. Przy granicy zaczyna się od zera, więc jego
      rzadka rozdzielczość (ok. 3 km na piksel) nie rozmywa konturu kraju;
    - `winieta-dal`: poza obszarem obrazka pełna ciemność, ta sama, którą obrazek kończy;
    - `winieta-usa`: wokół minigier w USA mapa zostaje jasna - drugi obrazek, który w swoim
      prostokącie zastępuje `winieta-dal` i gaśnie dopiero z odległością od pinezek.
  Razem dają 0,2 tuż za granicą i 0,82 ok. 300 km dalej (narastanie 1-(1-u)^1,7, front
  przesunięty szumem o ±90 km); wokół minigier jasno do 150 km, pełna ciemność ok. 700 km
  dalej. Obrazki są białe z kanałem alfa - barwę ciemności (tło motywu) nadaje im jasność
  rastra, patrz `pomalujWgMotywu`. Wygenerowane w podglądzie „Mapa na nowo" (funkcje
  `winieta` i `winietaPunkty`) - przy zmianie WINIETA_A0 trzeba je przeliczyć.
*/
const WINIETA_A0 = 0.2;
const WINIETA_DAL = 0.775;
type Rogi = [[number, number], [number, number], [number, number], [number, number]];
const WINIETA_ROGI: Rogi = [
  [7.5, 58.8],
  [30.505371, 58.8],
  [30.505371, 44.992658],
  [7.5, 44.992658],
];
/* prostokąt z minigrami w USA (Venice Beach, Las Vegas, Chicago, Manhattan) */
const WINIETA_USA_ROGI: Rogi = [
  [-128, 52],
  [-61.998764, 52],
  [-61.998764, 21.99384],
  [-128, 21.99384],
];
/* pierścień dziury w warstwie „dal" - kolejność odwrotna niż rogi obrazka */
const dziura = (r: Rogi) => [r[0], r[3], r[2], r[1], r[0]];
/* przy widoku całego świata (telefon oddala się do minigier w USA) ciemność słabnie */
const winietaWgPrzyblizenia = (moc: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  2.5,
  moc * 0.4,
  4,
  moc,
];

/*
  Kadr na Polskę ma zostawić miejsce na wizytówkę nad najwyżej położoną pinezką.

  Na komputerze wizytówka boiska wisi NAD pinezką: 58 px nad jej ostrym końcem, karta ma
  380 px wysokości. Kadr dociągnięty do samej góry stawiał pinezki z Trójmiasta tak wysoko,
  że na monitorze 4K uciekało górne 80 px karty. Polska jest więc na komputerze odrobinę
  mniejsza i dosunięta w dół - na ekranie 4K o ok. 10%. Na niższych ekranach karta jest za
  wysoka, żeby zmieścić ją przez samo oddalenie, więc kadr maleje najwyżej o
  `MAKS_ODDALENIE`, a resztę załatwia wizytówka, która przy górnej krawędzi pokazuje się
  pod pinezką.

  `PINEZKI_DO` to szerokość najdalej na północ wysuniętego boiska (Sopot, 54,45° w
  październiku 2026), wpisana na stałe, a nie liczona z listy: kadr startowy musi być
  zawsze ten sam, bo po nim `zapiszKadr` rozpoznaje „widok całej Polski".
*/
const MIEJSCE_NA_WIZYTOWKE = 58 + 380 + 14;
const PINEZKI_DO = 54.46;
const MAKS_ODDALENIE = 0.2;

function kadrPolski(map: MlMap): { center: LngLat; zoom: number } | null {
  const el = map.getContainer();
  const szer = el.clientWidth;
  const padding = fitPadding(szer);
  const zwykly = map.cameraForBounds(POLAND_BOUNDS, { padding });
  if (!zwykly?.center || zwykly.zoom === undefined) return null;
  const kadr = { center: LngLat.convert(zwykly.center), zoom: zwykly.zoom };

  /* telefon i tablet: wizytówka siedzi nad dolnym panelem, nie nad pinezką */
  if (szer < 1024 || window.matchMedia("(pointer: coarse)").matches) return kadr;

  const [w, s, e] = POLAND_BOUNDS;
  const zKarta = map.cameraForBounds([w, s, e, PINEZKI_DO], {
    padding: { ...padding, top: MIEJSCE_NA_WIZYTOWKE },
  });
  if (!zKarta?.center || zKarta.zoom === undefined || zKarta.zoom >= kadr.zoom) return kadr;
  if (kadr.zoom - zKarta.zoom <= MAKS_ODDALENIE) {
    return { center: LngLat.convert(zKarta.center), zoom: zKarta.zoom };
  }

  /* niski ekran: oddalamy tylko o MAKS_ODDALENIE, a Polskę dosuwamy do dolnego marginesu */
  const zoom = kadr.zoom - MAKS_ODDALENIE;
  const y =
    MercatorCoordinate.fromLngLat([kadr.center.lng, s]).y -
    (el.clientHeight / 2 - padding.bottom) / (512 * 2 ** zoom);
  return { center: new LngLat(kadr.center.lng, new MercatorCoordinate(0.5, y).toLngLat().lat), zoom };
}

/**
 * Jak daleko wolno oddalić mapę.
 *
 * Na komputerze 4,2 - mniej więcej Europa, dalej nie ma po co, a w szerokim oknie do pinezek
 * minigier w USA dojeżdża się kilkoma pociągnięciami. Na telefonie i tablecie ten sam próg
 * pokazywał ledwie pas szerokości Polski, więc droga do Las Vegas to było kilkanaście
 * przeciągnięć palcem. Tam pozwalamy oddalić aż do całego świata (1,2 na wąskim ekranie
 * mieści mniej więcej półkulę) - Europa i USA naraz, jedno przesunięcie.
 *
 * Dotyk liczy się tak samo jak wąskie okno: iPad w poziomie ma ponad 1024 px, a dalej
 * przewija się go palcem.
 */
function minZoomDla(szerokosc: number) {
  const dotyk = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  return dotyk || szerokosc < 1024 ? 1.2 : 4.2;
}

/**
 * Zapas na panel: po lewej, gdy panel stoi z boku; od dołu, gdy wysuwa się jako arkusz.
 *
 * PRÓG MUSI BYĆ TEN SAM, CO W `Sidebar` (`lg:`, czyli 1024) - inaczej mapa omija panel,
 * którego nie ma, albo wchodzi pod ten, który jest.
 *
 * Stało tu 768. Na tablecie trzymanym pionowo dawało to kadr Polski wciśnięty w
 * 768 - 430 - 70 = 268 pikseli szerokości, więc mapa musiała oddalić się tak, żeby zmieścić
 * w tym cały kraj: na ekranie widać było pół Europy, a Polska była małym kształtem z boku.
 * Panel o stałej szerokości 386 pikseli zajmował tam ponad połowę ekranu.
 *
 * Na komputerze margines jest SYMETRYCZNY. Stało tu 430 pikseli z lewej - miejsce na panel
 * filtrów - tyle że panel domyślnie jest zwinięty: w lewym górnym rogu leży tylko logo,
 * wyszukiwarka i dwa przyciski, a pod nimi jest czysta mapa. Polska stała więc 180 pikseli
 * na prawo od środka ekranu i wyglądało to na błąd. Górny margines jest odrobinę większy
 * od dolnego, bo u góry wisi pasek nawigacji.
 */
/*
  Na telefonie marginesy pionowe są MIERZONE, nie wpisane. Stało tu 90 z góry i 200 z dołu,
  dobrane pod jeden ekran; na telefonie z paskiem przeglądarki albo paskiem gestów arkusz
  filtrów zaczyna się gdzie indziej i Polska lądowała wyżej lub niżej niż środek tego, co
  widać. Teraz kadr bierze dolną krawędź paska nawigacji (`data-kadr="gora"`) i górną
  krawędź zwiniętego arkusza (`data-kadr="dol"`), więc kraj stoi dokładnie pośrodku mapy
  między nimi. Boki to 8% szerokości ekranu - Polska jest o kilka procent mniejsza niż
  przy dawnych 24 px, przy których dotykała krawędzi.
*/
const ODSTEP_KADRU = 20;
const fitPadding = (width: number) => {
  if (width >= 1024) return { top: 90, bottom: 70, left: 70, right: 70 };

  const bok = Math.max(28, Math.round(width * 0.08));
  if (typeof document === "undefined") return { top: 90, bottom: 190, left: bok, right: bok };

  const wys = window.innerHeight;
  const gora = document.querySelector('[data-kadr="gora"]')?.getBoundingClientRect().bottom;
  const dol = document.querySelector('[data-kadr="dol"]')?.getBoundingClientRect().top;
  /* zmierzone tylko, gdy ma sens - arkusz rozwinięty albo jeszcze niewyrenderowany dałby bzdurę */
  const top = gora && gora < wys / 3 ? gora : 68;
  const dolKadru = dol && dol > wys / 2 && dol <= wys ? dol : wys - 170;
  return {
    top: Math.round(top + ODSTEP_KADRU),
    bottom: Math.round(wys - dolKadru + ODSTEP_KADRU),
    left: bok,
    right: bok,
  };
};

/*
  Kiedy grupy boisk rozpadają się na mniejsze (patrz `lib/grupy-boisk.ts`): województwa na
  skupiska, skupiska na okolice, okolice na pojedyncze pinezki.

  Progi liczymy w stopniach przybliżenia PONAD kadr całej Polski na danym ekranie
  (`kadrPolski`), a nie w wartościach bezwzględnych. Polska mieści się w oknie przy
  przybliżeniu 5,6-6,6 na komputerze (zależnie od wysokości ekranu) i ok. 4,5 na telefonie,
  a zasada ma być jedna dla wszystkich: widok startowy pokazuje województwa, pierwsze
  przybliżenie - ich rozpad. Na typowym monitorze (kadr 5,9) wychodzi:

    6,8   skupiska - kilka pinezek na województwo,
    8,9   okolice - duże miasto dzieli się na części,
    10,9  pojedyncze boiska (w dawnym trybie dużej bazy pinezki wchodziły od 11).

  Dolot po kliknięciu w województwo kończy się mniej więcej na kadrze + 1,2, czyli zawsze
  już po rozpadzie na skupiska - odstępy progów są z tym zgrane.

  Węższy ekran dostaje progi przesunięte w głąb (`korekta`). Telefon mieści Polskę
  półtora stopnia przybliżenia płycej niż monitor, a pinezki ma mniejsze tylko o 30-45% -
  względem kraju są więc mniej więcej dwa razy większe i przy tych samych progach grupy
  rozpadałyby się na pinezki wchodzące jedna na drugą. Korekta rośnie płynnie od zera przy
  1024 px do 0,84 przy telefonie 390 px (skupiska dostają połowę, bo dolot do województwa
  na telefonie kończy się płycej).
*/
function progiGrup(szerokosc: number) {
  const korekta = Math.min(0.9, Math.max(0, Math.log2(1024 / Math.max(szerokosc, 1)) * 0.6));
  return { skupiska: 0.9 + korekta / 2, okolice: 3 + korekta, boiska: 5 + korekta };
}
/** Kadr Polski na typowym monitorze - zapas, gdyby mapa nie miała jeszcze wymiarów. */
const ZOOM_POLSKI_ZAPAS = 5.9;
/**
 * Odstęp między pinezkami województw (w pikselach, przy pełnej skali), poniżej którego
 * zlewają się w jedną pinezkę całego kraju - mniej więcej średnica pinezki grupy.
 */
const ODSTEP_WOJEWODZTW = 44;
/** Skala pinezek grup na telefonie - musi być zgodna z `.grupa-marker` w globals.css. */
const SKALA_GRUP_TELEFON = 0.7;
/** Ile trwa rozjazd pinezek przy rozpadzie grupy (ms). */
const CZAS_ROZPADU = 420;

type PoziomMapy = PoziomGrup | "boiska";
const GLEBOKOSC: Record<PoziomMapy, number> = {
  kraj: 0,
  wojewodztwa: 1,
  skupiska: 2,
  okolice: 3,
  boiska: 4,
};

/**
 * Od jakiego przybliżenia widać szare pinezki nieodkrytych boisk.
 *
 * Piętnaście to poziom, na którym widać pojedyncze budynki i podwórka - czyli moment,
 * w którym pytanie „co jest w tej okolicy" zaczyna mieć sens. Na mapie Polski, a nawet
 * na mapie miasta, tych punktów nie ma i to jest zamierzone: siedem tysięcy szarych
 * kropek nad krajem zasłoniłoby prawdziwe boiska i zamieniło mapę w szum.
 *
 * Pinezki wydarzeń mają wyjątek od grupowania (patrz „pinezki i grupy boisk"), szare punkty
 * nie mają żadnego - nieodkryte boisko to zaproszenie dla kogoś, kto już jest w okolicy.
 */
const PRZYBLIZENIE_PUNKTOW = 15;

/**
 * Ile czekamy po zatrzymaniu mapy, zanim spytamy o punkty.
 *
 * Przeciągnięcie mapy palcem to kilkanaście zdarzeń `moveend` pod rząd. Bez tego opóźnienia
 * każde z nich byłoby osobnym zapytaniem do bazy - a interesuje nas wyłącznie to, gdzie
 * mapa się w końcu zatrzymała.
 */
const ZWLOKA_PUNKTOW_MS = 250;
/** Górny limit pinezek HTML naraz - powyżej i tak zlewałyby się w plamę. */
const PIN_LIMIT = 160;
/** Ile trwa gaśnięcie wizytówki - musi być zgodne z `.karta-mapy-znika` w globals.css. */
const CZAS_ZNIKANIA = 180;

/*
  Pinezka wydarzenia maleje przy oddalaniu mapy.

  Pinezki mają stały rozmiar w pikselach, więc im dalej odjedziemy, tym większe są
  WZGLĘDEM kraju. Zwykłej pinezki (38-46 px) to nie psuje, ale pinezka wydarzenia ma
  67 px, mnożnik tłumu i płomień wyższy od kuli - na widoku całej Europy zasłaniała pół
  Polski. Skala nie idzie liniowo z przybliżeniem, bo nie musi: powyżej `WYD_ZOOM_PELNY`
  pinezka ma być dokładnie taka, jaka jest teraz, i nic się dla niej nie zmienia.

  Progi z widoku, nie z wzoru. Polska mieści się w oknie przy przybliżeniu około 5,9
  i tam pinezka ma zostać dokładnie taka, jaka jest - to domyślny kadr serwisu i nikt
  się na niego nie skarżył. Zgłoszenie dotyczyło widoku całej Europy, czyli przybliżenia
  około 3: tam pinezka schodzi do jednej trzeciej i przestaje zasłaniać kraj.
*/
const WYD_ZOOM_PELNY = 6;
const WYD_ZOOM_MALY = 3;
const WYD_SKALA_MIN = 0.34;

function skalaPinezkiWydarzenia(zoom: number) {
  if (zoom >= WYD_ZOOM_PELNY) return 1;
  if (zoom <= WYD_ZOOM_MALY) return WYD_SKALA_MIN;
  const t = (zoom - WYD_ZOOM_MALY) / (WYD_ZOOM_PELNY - WYD_ZOOM_MALY);
  return WYD_SKALA_MIN + (1 - WYD_SKALA_MIN) * t;
}

/*
  ZWYKŁA pinezka też maleje przy oddalaniu - ten sam powód, mniejsza skala.

  Stały rozmiar w pikselach znaczy, że im dalej odjedziemy, tym większa jest pinezka
  względem kraju. Przy widoku Polski w oknie kule zaczynają się zlewać, a przy widoku
  pół Europy dziesięć boisk zasłania środek mapy.

  Progi wzięte z konkretnych widoków, nie z wzoru:

    7    - miasto i bliżej. Tu nikt się nie skarżył i tu nic się nie zmienia.
    6,4  - Polska wypełnia okno. Zejście o 10%: kule przestają się stykać, ale
           wciąż czytać je jako piłki.
    5,7  - widać pół Europy. Zejście o 30%.

  Poniżej 5,7 skala się zatrzymuje. Można by ciągnąć ją dalej w dół, ale to już
  zgadywanie - a przy takim oddaleniu boiska i tak są już złożone w grupy.

  Pinezki WYDARZENIA to nie dotyczy: mają własne malenie (`--skala-zoom-wyd`, aż do
  jednej trzeciej) i pomnożenie jednego przez drugie zrobiłoby z nich pyłek.
*/
const PIN_ZOOM_PELNY = 7;
const PIN_ZOOM_KRAJ = 6.4;
const PIN_ZOOM_DALEKI = 5.7;
const PIN_SKALA_KRAJ = 0.9;
const PIN_SKALA_DALEKA = 0.7;

function skalaPinezkiOdZoomu(zoom: number) {
  if (zoom >= PIN_ZOOM_PELNY) return 1;
  if (zoom <= PIN_ZOOM_DALEKI) return PIN_SKALA_DALEKA;

  if (zoom >= PIN_ZOOM_KRAJ) {
    const t = (zoom - PIN_ZOOM_KRAJ) / (PIN_ZOOM_PELNY - PIN_ZOOM_KRAJ);
    return PIN_SKALA_KRAJ + (1 - PIN_SKALA_KRAJ) * t;
  }

  const t = (zoom - PIN_ZOOM_DALEKI) / (PIN_ZOOM_KRAJ - PIN_ZOOM_DALEKI);
  return PIN_SKALA_DALEKA + (PIN_SKALA_KRAJ - PIN_SKALA_DALEKA) * t;
}
/**
 * Gaśnięcie żaru przy oddalaniu kamery, w stopniach przybliżenia.
 *
 * `MARTWA_STREFA` to zapas na drobne poprawki kadru - bezwładność rolki, odbicie po
 * szczypnięciu, dociągnięcie po dolocie. W tym zakresie żar świeci pełnią, bo to jeszcze
 * nie jest „chcę wyjść". Dalej gaśnie liniowo przez `ZAKRES_GASNIECIA`, a na końcu
 * wybór się kasuje i mapa wraca do kadru na Polskę.
 */
const MARTWA_STREFA = 0.25;
const ZAKRES_GASNIECIA = 1;

// Worker MapLibre serwujemy z /public - patrz scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/*
  Ulice po przybliżeniu. Ciemny styl CARTO rysuje tło #0e0e0e, a drobne ulice #1a1a1a -
  po naszym przyciemnieniu obie wartości lądowały tuż przy czerni i miasto wyglądało jak
  pusta plama.

  Sam `raster-contrast` tu nie pomoże: w shaderze MapLibre kontrast rozciąga kolory wokół
  połowy jasności, więc wszystko ciemniejsze od 50% - czyli cała ta mapa - robi się jeszcze
  ciemniejsze. Ale shader liczy kontrast i zaraz po nim `brightness-min/max` bez obcinania
  po drodze, więc razem dają zwykłe przekształcenie liniowe jasność·k + b. Przystanki niżej
  są policzone tak, żeby tło zostało na ~4/255, a nachylenie k rosło z przybliżeniem:
  1 do poziomu 9 (dawny wygląd całego kraju), 1,75 od poziomu 13. Drobne ulice wychodzą
  z 15 na 25, główne z 58 na ~105. Przystanki są co jeden poziom, bo te dwa parametry
  nie są względem siebie liniowe - przy rzadszych tło między nimi szarzałoby.

  Tylko dla CARTO - zapasowe Esri ma jaśniejsze tło i to samo przekształcenie zrobiłoby
  z niego brązową szarzyznę, więc zostaje przy dawnych wartościach.
*/
type FarbaRastra = NonNullable<Extract<StyleSpecification["layers"][number], { type: "raster" }>["paint"]>;
type Wyostrzenie = Required<Pick<FarbaRastra, "raster-contrast" | "raster-brightness-min" | "raster-brightness-max">>;

const WYOSTRZENIE_ULIC: Wyostrzenie = process.env.NEXT_PUBLIC_CARTO_KEY
  ? {
      "raster-contrast": ["interpolate", ["linear"], ["zoom"], 9, 0.08, 10, 0.181, 11, 0.434, 12, 0.622, 13, 0.767],
      "raster-brightness-min": ["interpolate", ["linear"], ["zoom"], 9, 0, 10, 0.058, 11, 0.236, 12, 0.414, 13, 0.592],
      "raster-brightness-max": ["interpolate", ["linear"], ["zoom"], 9, 0.94, 10, 1],
    }
  : { "raster-contrast": 0.08, "raster-brightness-min": 0, "raster-brightness-max": 0.94 };

const STYLE: StyleSpecification = {
  version: 8,
  // fonts.openmaptiles.org oddaje HTML zamiast pliku .pbf - Protomaps serwuje poprawne glify
  /*
    Glify trzymamy u siebie, w `public/mapa/fonts`. Wcześniej leciały z GitHub Pages
    projektu Protomaps - działało, ale to cudze repozytorium, którego nikt nam nie
    obiecał utrzymywać. Gdyby zniknęło albo zmieniło układ katalogów, z mapy zniknęłyby
    wszystkie napisy, a my dowiedzielibyśmy się o tym od kogoś, kto to zauważy.

    Trzy zakresy wystarczają na polską mapę: 0-255 to łacina podstawowa, 256-511 dodaje
    ogonki i kreski (Świdnica, Łódź, Gdańsk), 8192-8447 to znaki interpunkcyjne, po które
    sięga MapLibre. Razem niecałe pół megabajta, wczytywane leniwie i tylko raz.
  */
  glyphs: "/mapa/fonts/{fontstack}/{range}.pbf",
  sources: {
    carto: podkladMapy("dark_nolabels"),
    "polska-maska": { type: "geojson", data: "/geo/polska-maska.geojson" },
    winieta: { type: "image", url: "/mapa/winieta.png", coordinates: WINIETA_ROGI },
    "winieta-usa": { type: "image", url: "/mapa/winieta-usa.png", coordinates: WINIETA_USA_ROGI },
    "winieta-dal": {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
            dziura(WINIETA_ROGI),
            dziura(WINIETA_USA_ROGI),
          ],
        },
      },
    },
    woj: { type: "geojson", data: "/geo/wojewodztwa.geojson" },
    miasta: { type: "geojson", data: CITIES_GEOJSON },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#07070a" } },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      // ocieplenie i wyciszenie kafelków - bez dotykania warstw własnych
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.92, 12, 1],
        "raster-saturation": -0.35,
        "raster-hue-rotate": -12,
        ...WYOSTRZENIE_ULIC,
      },
    },
    /* kraje dookoła gasną - opis przy WINIETA_A0 */
    {
      id: "winieta-blisko",
      type: "fill",
      source: "polska-maska",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": "rgb(7,7,7)", "fill-opacity": winietaWgPrzyblizenia(WINIETA_A0) },
    },
    {
      id: "winieta",
      type: "raster",
      source: "winieta",
      paint: {
        "raster-opacity": winietaWgPrzyblizenia(1),
        "raster-fade-duration": 0,
        /* biały obrazek przyjmuje szarość tła motywu, patrz pomalujWgMotywu */
        "raster-brightness-min": 7 / 255,
        "raster-brightness-max": 7 / 255,
      },
    },
    {
      id: "winieta-usa",
      type: "raster",
      source: "winieta-usa",
      paint: {
        "raster-opacity": winietaWgPrzyblizenia(1),
        "raster-fade-duration": 0,
        "raster-brightness-min": 7 / 255,
        "raster-brightness-max": 7 / 255,
      },
    },
    {
      id: "winieta-dal",
      type: "fill",
      source: "winieta-dal",
      paint: {
        "fill-color": "rgb(7,7,7)",
        "fill-opacity": winietaWgPrzyblizenia(WINIETA_DAL),
        "fill-antialias": false,
      },
    },
    {
      id: "woj-fill",
      type: "fill",
      source: "woj",
      paint: { "fill-color": BARWY_MAPY.flame, "fill-opacity": 0.06 },
    },
    {
      id: "woj-active",
      type: "fill",
      source: "woj",
      filter: ["==", ["get", "nazwa"], "__none__"],
      /*
        Płaskie wypełnienie jest tylko podkładem - żywy gradient dokłada warstwa SVG
        (`lib/zarWojewodztwa`). Zostaje niższe niż kiedyś, żeby suma nie wyszła jaskrawa,
        a jednocześnie na tyle widoczna, że podświetlenie działa nawet wtedy, gdy
        przeglądarka nie poradzi sobie z warstwą SVG.
      */
      paint: { "fill-color": BARWY_MAPY.flame, "fill-opacity": 0.05 },
    },
    {
      id: "woj-line",
      type: "line",
      source: "woj",
      paint: {
        "line-color": BARWY_MAPY.glow,
        /* cienka nitka (opcja 51 z podglądu, październik 2026) - wcześniej 0,8 px */
        "line-width": 0.35,
        "line-opacity": 0.35,
      },
    },
    {
      id: "miasta-kropka",
      type: "circle",
      source: "miasta",
      filter: ["<=", ["get", "rank"], ["step", ["zoom"], 1, 6.2, 2, 7.6, 3]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 10, 3],
        "circle-color": "#ffffff",
        "circle-opacity": 0.5,
      },
    },
    {
      id: "miasta-nazwa",
      type: "symbol",
      source: "miasta",
      filter: ["<=", ["get", "rank"], ["step", ["zoom"], 1, 6.2, 2, 7.6, 3]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Instrument Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10.5, 9, 14],
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "text-letter-spacing": 0.04,
        "text-padding": 6,
      },
      paint: {
        "text-color": "rgba(242,242,245,0.82)",
        "text-halo-color": "rgba(7,7,10,0.9)",
        "text-halo-width": 1.3,
      },
    },
  ],
};

interface MapDiag {
  webgl: string;
  created: boolean;
  style: boolean;
  loaded: boolean;
  tiles: number;
  errors: string[];
}

/** Barwy warstw i podkład pod aktualny motyw strony (`data-motyw` na `html`). */
function pomalujWgMotywu(map: MlMap) {
  const barwy = {
    flame: zeStylu("--color-flame", BARWY_MAPY.flame),
    glow: zeStylu("--color-glow", BARWY_MAPY.glow),
    tlo: zeStylu("--color-void", BARWY_MAPY.tlo),
    atrament: zeStylu("--color-ink", BARWY_MAPY.atrament),
  };

  for (const [warstwa, wlasciwosc, barwa] of WARSTWY_MOTYWU) {
    if (map.getLayer(warstwa)) map.setPaintProperty(warstwa, wlasciwosc, barwy[barwa]);
  }

  /*
    Ciemność winiety ma barwę tła motywu (ciemną albo jasną), ale w odcieniu szarości:
    obrazki są białe, a jasność rastra potrafi zrobić z bieli tylko szarość. Wypełnienia
    dostają dokładnie ten sam szary - z odcieniem tła (#07070a jest lekko niebieskie) na
    styku obrazka z wypełnieniem było widać krawędź.
  */
  const tlo = /^#([0-9a-f]{6})$/i.exec(barwy.tlo);
  if (tlo) {
    const n = parseInt(tlo[1], 16);
    const szary = Math.round(0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
    for (const warstwa of ["winieta-blisko", "winieta-dal"]) {
      if (map.getLayer(warstwa)) map.setPaintProperty(warstwa, "fill-color", `rgb(${szary},${szary},${szary})`);
    }
    for (const warstwa of ["winieta", "winieta-usa"]) {
      if (!map.getLayer(warstwa)) continue;
      map.setPaintProperty(warstwa, "raster-brightness-min", szary / 255);
      map.setPaintProperty(warstwa, "raster-brightness-max", szary / 255);
    }
  }

  /*
    Podkład też musi iść za motywem: ciemna mapa pod jasnym interfejsem wygląda jak
    dziura wycięta w stronie. O jasność pytamy `color-scheme`, bo to arkusz wie, który
    motyw jest jasny - komponent nie musi trzymać drugiej listy.

    Same kafelki podmieniamy przez `setTiles`, bez przebudowy stylu: przebudowa zdejmuje
    wszystkie warstwy dołożone później (boiska, klastry, żar) i trzeba by je stawiać od
    nowa razem z ich obsługą zdarzeń.
  */
  const jasny = getComputedStyle(document.documentElement).colorScheme === "light";
  const zrodlo = map.getSource("carto");
  if (zrodlo && "setTiles" in zrodlo) {
    (zrodlo as { setTiles: (t: string[]) => void }).setTiles(
      kafelkiPodkladu("dark_nolabels", jasny)
    );
  }

  /* ocieplenie kafelków było dobrane pod ciemny podkład - na jasnym gasi mapę do szarości */
  if (map.getLayer("carto")) {
    map.setPaintProperty("carto", "raster-saturation", jasny ? -0.12 : -0.35);
    /* jasny podkład ma ulice wyraźne sam z siebie - wyostrzenie zostaje tylko dla ciemnego */
    const farba: Wyostrzenie = jasny
      ? { "raster-contrast": 0.08, "raster-brightness-min": 0, "raster-brightness-max": 1 }
      : WYOSTRZENIE_ULIC;
    for (const wlasciwosc of Object.keys(farba) as (keyof Wyostrzenie)[]) {
      map.setPaintProperty("carto", wlasciwosc, farba[wlasciwosc]);
    }
    map.setPaintProperty("carto", "raster-hue-rotate", jasny ? 0 : -12);
  }
}

export function MapView({
  courts,
  activeId,
  highlightVoivodeship,
  onHoverCourt,
  onSelectCourt,
  onSelectPunkt,
  leads,
  onSelectLead,
  registerClearCard,
  sheetOpen = false,
  checkiny,
}: {
  courts: MapCourt[];
  activeId: string | null;
  highlightVoivodeship: string;
  onHoverCourt: (id: string | null) => void;
  onSelectCourt: (court: MapCourt) => void;
  /** klik w szarą pinezkę nieodkrytego boiska - prowadzi na jego małą stronę */
  onSelectPunkt: (osmId: string) => void;
  /** szare punkty z OSM - tylko dla administratora, po włączeniu przycisku */
  leads?: LeadPoint[];
  onSelectLead?: (lead: LeadPoint) => void;
  /** oddaje na zewnątrz funkcję gaszenia wizytówki - woła ją Explorer przy otwarciu arkusza */
  registerClearCard?: (fn: () => void) => void;
  /** arkusz z filtrami na telefonie jest rozwinięty - wizytówki wtedy nie pokazujemy */
  sheetOpen?: boolean;
  /** ile osób zapisało się dziś na które boisko - pobiera Explorer, bo filtruje po tym listę */
  checkiny: Record<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Record<string, { marker: Marker; el: HTMLDivElement }>>({});
  /** pinezki grup boisk po identyfikatorze grupy; `podpis` mówi, czy treść trzeba przerysować */
  const grupyRef = useRef<
    Record<string, { marker: Marker; el: HTMLDivElement; grupa: GrupaBoisk; podpis: string }>
  >({});
  const [ready, setReady] = useState(false);
  const [diag, setDiag] = useState<MapDiag | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  /** pinezka z wizytówką: boisko, punkt zaczepienia na ekranie i ilu ludzi idzie tam dziś */
  type Karta = { court: MapCourt; x: number; y: number; osoby: number };
  const [hover, setHover] = useState<Karta | null>(null);
  /**
   * Wizytówka, która właśnie gaśnie.
   *
   * Bez tego karta znikała cięciem: React zdejmuje węzeł z drzewa, więc nie ma czego
   * animować. Trzymamy ostatnią kopię przez czas animacji wyjścia i dopiero potem ją
   * zdejmujemy - wejście i wyjście wyglądają wtedy jak jeden ruch, a nie mrugnięcie.
   */
  const [znika, setZnika] = useState<Karta | null>(null);
  const ostatniaKartaRef = useRef<Karta | null>(null);
  const zegarZnikaniaRef = useRef<number | undefined>(undefined);
  const hoverRef = useRef<MapCourt | null>(null);
  /**
   * Na ekranie dotykowym nie ma najeżdżania: pierwsze dotknięcie pinezki podświetla ją
   * i pokazuje wizytówkę, a dopiero dotknięcie wizytówki otwiera kartę boiska.
   */
  const [coarse] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches
  );
  const clearCardRef = useRef(() => undefined as void);
  /** wybrany motyw - warstwy mapy trzeba przy jego zmianie przemalować ręcznie */
  const motyw = useMotyw();
  /** warstwa z żywym gradientem w obrysie województwa */
  const zarRef = useRef<ZarWojewodztwa | null>(null);
  /**
   * Województwo wybrane kliknięciem w puste miejsce na mapie.
   *
   * Trzymane osobno od `highlightVoivodeship`, które przychodzi z filtrów: to dwa różne
   * gesty i nie powinny się nadpisywać. Filtr ma pierwszeństwo - skoro ktoś zawęził
   * wyniki do jednego województwa, to ono ma świecić, choćby kliknął gdzie indziej.
   */
  /*
    Stan startuje od województwa wskazanego w adresie (`?woj=...`) - tak trafia się tu ze
    stopki i z pustego regionu. Taki adres traktujemy jak kliknięcie w mapę, a nie jak samo
    zawężenie listy: obrys się zapala, kamera dolatuje do regionu, a oddalenie gasi jedno
    i drugie. Inaczej odnośnik ze stopki otwierał mapę całej Polski z zawężoną listą
    i człowiek musiał sam szukać, gdzie ten region leży.

    Właściwość czytamy tylko przy montowaniu. Późniejsze zmiany w panelu filtrów mają własną
    ścieżkę (patrz `ostatniFiltrWoj`) i nie ruszają kamery - wybór z panelu jest zawężeniem
    listy, nie wskazaniem miejsca.
  */
  const [wojKlikniete, setWojKlikniete] = useState<string | null>(
    () => highlightVoivodeship || null
  );
  /**
   * Kopia `wojKlikniete` do czytania z nasłuchów mapy.
   *
   * Nasłuchy wieszamy raz, przy tworzeniu mapy, więc ich domknięcie ma zamrożoną pierwszą
   * wartość stanu. Ref jest tu jedynym sposobem, żeby obsługa oddalania wiedziała, z którego
   * województwa użytkownik właśnie wychodzi. Wypełnia go efekt zaraz po zamontowaniu -
   * nasłuchy strzelają dopiero po pierwszym ruchu myszy albo pomiarze kontenera, więc nigdy
   * nie trafiają na puste.
   */
  const wojKlikRef = useRef<string | null>(null);
  /**
   * Województwo opuszczone własnym gestem, choć wciąż zawęża listę.
   *
   * Bez tego wyjście z regionu wskazanego w adresie kończyło się mrugnięciem: żar gasł
   * w rytm oddalania, a w chwili wyzerowania wracał w pełnej sile - bo filtr został
   * włączony i podświetlenie zapalało się od nowa, tym razem na kadrze całej Polski.
   */
  const [porzuconeWoj, setPorzuconeWoj] = useState<string | null>(null);
  /**
   * Miejsce ostatniego kliknięcia w mapę (lng, lat) - punkt wyjścia fali podświetlenia.
   *
   * Trzymane w stanie, a nie w refie, właśnie po to, żeby zmiana wywołała efekt zapalający
   * żar: dzięki temu drugie kliknięcie w to samo województwo też puszcza falę, choć nazwa
   * regionu się nie zmieniła. Każde kliknięcie daje nową tablicę, czyli nową tożsamość.
   */
  const [punktKliku, setPunktKliku] = useState<[number, number] | null>(null);
  /**
   * Przybliżenie osiągnięte po dolocie do województwa - punkt odniesienia dla gaśnięcia.
   *
   * Ustawiane po zakończeniu dolotu, nie przy kliknięciu: samo `fitBounds` przejeżdża
   * przez pośrednie wartości przybliżenia i uzbrojony wcześniej punkt odniesienia
   * wygaszałby żar w połowie własnej animacji.
   */
  const zoomWejsciaRef = useRef<number | null>(null);
  /** znacznik czasu dotknięcia pinezki - chroni wizytówkę przed klikiem mapy z tego samego dotknięcia */
  const lastPinTapRef = useRef(0);
  /** wizytówka na dotyku - z jej położenia liczymy, gdzie ma wylądować pinezka */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onSelectLeadRef = useRef(onSelectLead);
  useEffect(() => {
    onSelectLeadRef.current = onSelectLead;
  }, [onSelectLead]);

  /*
    Ile osób wybiera się dziś na które boisko. Trzymamy to w ref, a nie w stanie: dane
    zmieniają pinezki bezpośrednio (klasa i zmienna CSS), więc przerysowywanie całej mapy
    Reactem byłoby zbędne. Dane przychodzą z Explorera (odświeża je co dwie minuty) -
    deklaracja żyje jeden dzień, ale ludzie dopisują się w ciągu dnia i pinezka ma to
    pokazać bez przeładowania strony.
  */
  const checkinyRef = useRef<Record<string, number>>({});

  /** pokazanie karty przerywa ewentualne znikanie poprzedniej */
  const pokazKarte = useCallback((karta: Karta) => {
    window.clearTimeout(zegarZnikaniaRef.current);
    setZnika(null);
    ostatniaKartaRef.current = karta;
    setHover(karta);
  }, []);

  const schowajKarte = useCallback(() => {
    const ostatnia = ostatniaKartaRef.current;
    setHover(null);
    if (!ostatnia) return;
    setZnika(ostatnia);
    window.clearTimeout(zegarZnikaniaRef.current);
    zegarZnikaniaRef.current = window.setTimeout(() => setZnika(null), CZAS_ZNIKANIA);
  }, []);

  useEffect(() => () => window.clearTimeout(zegarZnikaniaRef.current), []);

  /** pojemnik wizytówki na kursor - dostaje zmienne przechyłu i odblasku */
  const kartaPozRef = useRef<HTMLDivElement | null>(null);
  /*
    Zmierzona wysokość wizytówki na kursor. Karta boiska ma 380 px, ale wizytówka wydarzenia
    rośnie z treścią, więc mierzymy po narysowaniu - jeszcze przed malowaniem klatki
    (`useLayoutEffect`), żeby karta nie mignęła w złym miejscu.
  */
  const [wysKarty, setWysKarty] = useState(380);
  useLayoutEffect(() => {
    const h = kartaPozRef.current?.offsetHeight;
    if (h && Math.abs(h - wysKarty) > 1) setWysKarty(h);
  }, [hover, znika, wysKarty]);

  /*
    Wizytówka przechyla się za kursorem, a odblask przesuwa się po tafli.

    Karta na kursor nie łapie myszy (`pointer-events-none`) i gaśnie, gdy kursor zejdzie
    z pinezki - więc ruch liczymy względem samej pinezki, nad którą kursor właśnie stoi.
    Pinezka ma ~40 px szerokości, dlatego odchylenie jest mocno wzmocnione: przejechanie
    kursorem od lewej do prawej krawędzi kuli to pełny zakres przechyłu.

    Zmienne lądują prosto w stylu pojemnika, z pominięciem Reacta - ruch myszy przychodzi
    kilkadziesiąt razy na sekundę i przerysowywanie drzewa przy każdym byłoby marnotrawstwem.
    Płynność daje przejście zarejestrowanych zmiennych w arkuszu (`.wiz` w globals.css).
  */
  useEffect(() => {
    const kontener = containerRef.current;
    if (coarse || !hover || !kontener) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { x, y } = hover;
    /* środek kuli pinezki: punkt zaczepienia to jej ostry koniec, kula jest ~30 px wyżej */
    const srodekY = y - 30;
    const rusz = (e: MouseEvent) => {
      const el = kartaPozRef.current;
      if (!el) return;
      const ramka = kontener.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - ramka.left - x) / 22));
      const ny = Math.max(-1, Math.min(1, (e.clientY - ramka.top - srodekY) / 22));
      el.style.setProperty("--wiz-ry", `${(nx * 9).toFixed(2)}deg`);
      el.style.setProperty("--wiz-rx", `${(-ny * 6).toFixed(2)}deg`);
      el.style.setProperty("--wiz-mx", `${(50 + nx * 38).toFixed(1)}%`);
      el.style.setProperty("--wiz-my", `${(42 + ny * 30).toFixed(1)}%`);
    };
    kontener.addEventListener("mousemove", rusz);
    return () => kontener.removeEventListener("mousemove", rusz);
  }, [hover, coarse]);

  const clearCard = useCallback(() => {
    hoverRef.current = null;
    schowajKarte();
    onHoverCourt(null);
  }, [onHoverCourt, schowajKarte]);

  useEffect(() => {
    clearCardRef.current = clearCard;
    registerClearCard?.(clearCard);
  }, [clearCard, registerClearCard]);

  /**
   * Dotknięta pinezka ma stanąć na środku wolnego pola: w poziomie pośrodku ekranu, a w pionie
   * w połowie odległości między paskiem nawigacji a górną krawędzią wizytówki. Wysokość
   * wizytówki zależy od treści, więc mierzymy ją po dorysowaniu, a nie zgadujemy.
   */
  const centerPin = useCallback((court: MapCourt) => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const ease = () => {
      const box = container.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      const nav = document.querySelector("nav")?.getBoundingClientRect();
      // dolna krawędź paska nawigacji z oddechem - na telefonie pasek jest niższy niż na monitorze
      const topEdge = (nav ? nav.bottom - box.top : 56) + 10;
      // bez wizytówki (nie powinno się zdarzyć) zostaje rozsądne domyślne pole
      const bottomEdge = card ? card.top - box.top : box.height * 0.55;
      // pinezka jest zaczepiona ostrym końcem, a jej korpus rysuje się wyżej - stąd korekta,
      // żeby wizualnie leżała pośrodku, nie tuż pod krawędzią wizytówki
      const target = (topEdge + bottomEdge) / 2 + 26;

      map.easeTo({
        center: [court.lng, court.lat],
        offset: [0, target - box.height / 2],
        duration: 460,
      });
    };

    // dwie klatki: pierwsza dorysowuje wizytówkę, druga oddaje jej zmierzone wymiary
    requestAnimationFrame(() => requestAnimationFrame(ease));
  }, []);

  const reposition = useCallback(() => {
    const map = mapRef.current;
    const c = hoverRef.current;
    if (!map || !c) return;
    const p = map.project([c.lng, c.lat]);
    pokazKarte({ court: c, x: p.x, y: p.y, osoby: checkinyRef.current[c.id] ?? 0 });
  }, [pokazKarte]);

  /*
    OSTRZEŻENIE DLA MIERZĄCEGO: w niewidocznej karcie mapa nie pobiera ANI JEDNEGO kafelka.

    MapLibre rysuje na `requestAnimationFrame`, a przeglądarka wstrzymuje rAF w karcie,
    która jest w tle albo schowana. Mapa powstaje, płótno ma poprawny rozmiar, `styledata`
    przychodzi - i na tym koniec: skoro nie ma klatki do narysowania, nie ma też pytania,
    których kafelków do niej potrzeba. Ruch rusza dopiero, gdy karta staje się widoczna.

    To nie jest usterka, tylko poprawne zachowanie przeglądarki - karta w tle nie ma prawa
    palić cudzego transferu. Zostawiam tę notę, bo kosztowała już dwa fałszywe alarmy:
    „mapa wstaje 30 sekund" i „szare pinezki nie pojawiają się same". Oba razy stoper
    mierzył moment, w którym narzędzie zrobiło zrzut ekranu i obudziło kartę, a nie żadną
    powolność kodu.

    Zmierzone 11 września 2026 na produkcji, przy widocznej karcie: pierwszy kafelek pół
    sekundy po wejściu, wszystkie sto pięćdziesiąt gotowe pół sekundy później. Kto chce to
    powtórzyć, musi najpierw sprawdzić `document.visibilityState` - inaczej zmierzy siebie.
  */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const probe = document.createElement("canvas");
    const webgl =
      (!!probe.getContext("webgl2") && "webgl2") ||
      (!!probe.getContext("webgl") && "webgl") ||
      "brak";
    const diag: MapDiag = { webgl, created: false, style: false, loaded: false, tiles: 0, errors: [] };
    setDiag({ ...diag });
    const push = () => setDiag({ ...diag, errors: [...diag.errors] });

    /*
      Skąd bierzemy kadr, w kolejności:

      1. adres (`m=lat,lng,zoom`) - link do konkretnego miejsca otwiera się tam, gdzie
         został wysłany, i to bije wszystko inne;
      2. pamięć sesji - powrót z karty boiska linkiem „Mapa" albo logiem prowadzi na gołe
         `/`, więc bez tego mapa cofałaby się do widoku całej Polski przy każdym takim
         wejściu; przycisk „wstecz" radził sobie sam, bo przywraca adres z historii;
      3. nic - wtedy dopiero kadr na Polskę.
    */
    const zUrl = czytajWidok();
    const zAdresu = zUrl ?? ostatniKadr();
    /*
      Kadr wzięty z pamięci sesji od razu wpisujemy do adresu. Inaczej pasek pokazywałby
      gołe `/`, podczas gdy mapa stoi nad Krakowem - i link skopiowany z takiej strony
      wysyłałby kogoś na widok całej Polski. `moveend` sam tego nie naprawi, bo mapa
      postawiona od razu we właściwym miejscu nigdzie się nie rusza.
    */
    if (!zUrl && zAdresu) zapiszWidok(zAdresu);

    let map: MlMap;
    try {
      map = new MlMap({
        container: containerRef.current,
        style: STYLE,
        ...(zAdresu
          ? { center: [zAdresu.lng, zAdresu.lat] as [number, number], zoom: zAdresu.zoom }
          : {
              bounds: POLAND_BOUNDS,
              fitBoundsOptions: {
                padding: fitPadding(containerRef.current.clientWidth || 1024),
              },
            }),
        minZoom: minZoomDla(containerRef.current.clientWidth || window.innerWidth),
        maxZoom: 18,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch (e) {
      diag.errors.push(`init: ${(e as Error).message}`);
      push();
      return;
    }
    diag.created = true;
    push();

    map.on("error", (e) => {
      const msg = (e as unknown as { error?: Error }).error?.message ?? "nieznany błąd mapy";
      if (!diag.errors.includes(msg)) diag.errors.push(msg);
      push();
    });
    map.on("styledata", () => {
      diag.style = true;
      push();
      // pinezki wieszamy już po sparsowaniu stylu - nie czekamy na `load`, które
      // w nieaktywnej karcie przeglądarki potrafi nie przyjść wcale
      setReady(true);
    });
    map.on("data", (e) => {
      if (e.dataType === "source" && e.tile) diag.tiles += 1;
    });
    map.on("load", () => {
      diag.loaded = true;
      push();
      setReady(true);
    });
    map.on("move", reposition);
    // dotknięcie samej mapy zamyka wizytówkę boiska (na markerach zatrzymujemy zdarzenie)
    map.on("click", (e) => {
      if (performance.now() - lastPinTapRef.current < 500) return;
      clearCardRef.current();

      /*
        Kliknięcie w puste miejsce wybiera województwo. „Puste" znaczy: poza pinezkami
        boisk i grup - te mają własne obsługi i prowadzą do boiska albo w głąb grupy, a nie
        do kadru na region. Pinezki HTML zatrzymują zdarzenie na swoim elemencie i tu w ogóle
        nie docierają; warstwę szarych punktów (GeoJSON) trzeba odsiać ręcznie, bo żyje na
        tej samej kanwie.
      */
      const warstwy = ["leads-dots"].filter((w) => map.getLayer(w));
      if (warstwy.length && map.queryRenderedFeatures(e.point, { layers: warstwy }).length) {
        return;
      }

      if (!map.getLayer("woj-fill")) return;
      const trafione = map.queryRenderedFeatures(e.point, { layers: ["woj-fill"] });
      const nazwa = trafione[0]?.properties?.nazwa;
      const wRegionie = typeof nazwa === "string";
      setPunktKliku(wRegionie ? [e.lngLat.lng, e.lngLat.lat] : null);
      setWojKlikniete(wRegionie ? nazwa : null);
    });

    /*
      Wyjście z województwa własnym gestem, ale nie skokiem: żar gaśnie w rytm oddalania.
      Rolka i szczypanie na telefonie wysyłają zdarzenie zmiany przybliżenia w sposób
      ciągły, więc przezroczystość idzie za palcem - widać, że wyjście się zbliża, zanim
      nastąpi. Dopiero na zerze kasujemy wybór i wracamy do kadru na Polskę.

      Próg gasimy od razu po wykryciu, żeby sam powrót (który przecież zmienia
      przybliżenie) nie wywołał tej samej ścieżki drugi raz.
    */
    /*
      Skalę pinezki wydarzenia podajemy arkuszowi zmienną własną na KONTENERZE mapy,
      a nie stylem na każdej pinezce: zmienne dziedziczą się w dół, więc jedno ustawienie
      trafia do wszystkich pinezek naraz i nie musimy ich przy zoomie obchodzić. Poza tym
      pinezki są przebudowywane przy każdej zmianie danych - styl wpisany na element
      zniknąłby razem z nimi, a zmienna na kontenerze zostaje.
    */
    const odswiezSkaleOdZoomu = () => {
      const zoom = map.getZoom();
      const styl = map.getContainer().style;
      styl.setProperty("--skala-zoom-wyd", String(skalaPinezkiWydarzenia(zoom)));
      styl.setProperty("--skala-zoom", String(skalaPinezkiOdZoomu(zoom)));
    };
    odswiezSkaleOdZoomu();
    map.on("zoom", odswiezSkaleOdZoomu);

    map.on("zoom", () => {
      const wejscie = zoomWejsciaRef.current;
      if (wejscie === null) return;

      const dolna = wejscie - MARTWA_STREFA - ZAKRES_GASNIECIA;
      const jasnosc = (map.getZoom() - dolna) / ZAKRES_GASNIECIA;
      zarRef.current?.przygas(jasnosc);

      if (jasnosc > 0) return;
      zoomWejsciaRef.current = null;
      setPorzuconeWoj(wojKlikRef.current);
      setWojKlikniete(null);
      setPunktKliku(null);
    });
    /*
      Easter egg: dwie niebieskie pinezki poza Polską - Venice Beach i Manhattan. Wieszamy
      je tu, przy tworzeniu mapy, a nie razem z boiskami, bo nie są boiskami: nie ma ich
      w bazie, nie liczą się w filtrach i nie mogą wpaść pod czyszczenie pinezek, które
      usuwa wszystko spoza aktualnej listy.
    */
    for (const g of MIEJSCA_GRY) {
      const el = document.createElement("a");
      el.className = "court-marker pinezka-gry";
      el.href = `/gra/${g.slug}`;
      /*
        Bez `title`. Systemowa chmurka przeglądarki wyskakiwała obok naszej wizytówki -
        dwie dymki naraz, jedna w stylu serwisu, druga w stylu systemu. Treść i tak jest
        teraz w karcie, a dla czytnika ekranu zostaje `aria-label`.
      */
      el.setAttribute("aria-label", `Minigra: ${g.nazwa}, ${g.miasto}`);
      el.innerHTML = markerGryHtml(g);
      el.addEventListener("click", (e) => e.stopPropagation());

      new Marker({ element: el, anchor: "bottom" }).setLngLat([g.lng, g.lat]).addTo(map);
    }

    mapRef.current = map;

    // Style w dev-mode dochodzą po hydracji, więc kontener bywa chwilowo zerowy -
    // pilnujemy rozmiaru i po pierwszym sensownym pomiarze ustawiamy kadr na Polskę
    // (chyba że widok przyszedł z adresu - wtedy go nie ruszamy)
    let framed = !!zAdresu;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      map.resize();
      /* obrót tabletu albo zmiana okna przestawia próg oddalenia razem z szerokością */
      map.setMinZoom(minZoomDla(width));
      if (!framed) {
        framed = true;
        // z województwem w adresie kadr ustawia dolot do regionu - nie odbieramy mu go
        if (!wojKlikRef.current) {
          const kadr = kadrPolski(map);
          if (kadr) map.jumpTo(kadr);
        }
      }
    });
    ro.observe(containerRef.current);

    /*
      Drugie, ciche dokadrowanie po pierwszym narysowaniu - tylko na kadrze startowym i tylko,
      dopóki nikt mapy nie ruszył. Na telefonie marginesy liczymy od paska i arkusza filtrów
      (patrz `fitPadding`), a arkusz układa się jeszcze chwilę po tym, jak mapa ustawi kadr:
      zmierzony za wcześnie dawał Polskę kilka pikseli nad środkiem.
    */
    let ruszona = false;
    const poGescie = (e: { originalEvent?: Event }) => {
      if (e.originalEvent) ruszona = true;
    };
    map.on("movestart", poGescie);
    if (!zAdresu) {
      map.once("idle", () => {
        if (ruszona || wojKlikRef.current) return;
        const kadr = kadrPolski(map);
        if (kadr) map.jumpTo(kadr);
      });
    }

    // Po każdym przesunięciu zapisujemy kadr w dwóch miejscach: w adresie - żeby widok dało
    // się wysłać linkiem i żeby przetrwał odświeżenie - oraz w pamięci sesji, bo z niej
    // odtwarza się powrót na mapę linkiem, który adresu ze sobą nie niesie.
    const zapiszKadr = () => {
      /*
        Z jednym wyjątkiem: kadr całej Polski - ten, na którym mapa wstaje sama - NIE jest
        zapisywany, a dotychczasowy zapis znika. Wcześniej trafiał do adresu już przy starcie
        (samo ustawienie kadru to też przesunięcie), więc po odświeżeniu strony w adresie
        stało `m=...` i mapa brała to za link do konkretnego miejsca - adres wyglądał na
        zapisany widok, choć nikt mapy nie ruszył. To samo po powrocie przyciskiem z globusem
        albo po wyjściu z województwa.
      */
      const polska = kadrPolski(map);
      if (polska) {
        const tu = map.project(map.getCenter());
        const tam = map.project(polska.center);
        if (Math.abs(map.getZoom() - polska.zoom) < 0.02 && tu.dist(tam) < 2) {
          zapomnijKadr();
          return;
        }
      }
      const c = map.getCenter();
      const widok = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      zapiszWidok(widok);
      zapamietajKadr(widok);
    };
    map.on("moveend", zapiszKadr);

    if (typeof window !== "undefined") {
      (window as unknown as { __mapDiag: MapDiag }).__mapDiag = diag;
      // uchwyt do mapy przydatny przy diagnostyce w konsoli - tylko w dev
      if (process.env.NODE_ENV !== "production")
        (window as unknown as { __map: MlMap }).__map = map;
    }

    return () => {
      map.off("movestart", poGescie);
      ro.disconnect();
      map.off("moveend", zapiszKadr);
      map.remove();
      mapRef.current = null;
    };
  }, [reposition]);

  /* Diagnostyka po 5 s bez wstania mapy. W karcie w tle przeglądarka wstrzymuje
     klatki animacji i MapLibre celowo nic nie rysuje - wtedy panel milczy. */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!document.hidden) setShowDiag(true);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  /*
    Wydarzenia trzymamy INACZEJ niż deklaracje: w stanie, nie tylko w referencji. Deklaracje
    zmieniają wyłącznie wygląd pinezki, a wydarzenie zmienia też treść wizytówki nad nią -
    a tę rysuje React i musi się o zmianie dowiedzieć. Referencja obok stanu jest po to, żeby
    `oznaczPinezke` (stałe wywołanie zwrotne) czytało najświeższe dane bez przebudowy mapy.
  */
  const [wydarzenia, setWydarzenia] = useState<Record<string, Wydarzenie>>({});
  const wydarzeniaRef = useRef<Record<string, Wydarzenie>>({});

  const oznaczPinezke = useCallback((el: HTMLElement, id: string) => {
    const osoby = checkinyRef.current[id] ?? 0;
    const swieto = Boolean(wydarzeniaRef.current[id]);

    /*
      Pinezka wydarzenia płonie ZAWSZE i najmocniej, niezależnie od tego, czy ktoś się
      zapisał. Ogień jest tu zaproszeniem, nie licznikiem ludzi - a pusty licznik przy
      wydarzeniu, które dopiero będzie, to najgorsza możliwa informacja.
    */
    if (swieto) {
      el.dataset.wydarzenie = "1";
      el.dataset.osoby = String(Math.max(osoby, 1));
      el.style.setProperty("--zar", "6");
      return;
    }

    delete el.dataset.wydarzenie;
    if (osoby > 0) {
      el.dataset.osoby = String(osoby);
      /* trzy stopnie „gorąca": jedna osoba, kilka, tłum - wyżej i tak nie widać różnicy */
      el.style.setProperty("--zar", String(Math.min(osoby, 6)));
    } else {
      delete el.dataset.osoby;
      el.style.removeProperty("--zar");
    }
  }, []);

  /*
    Ogień zapisów na pinezce grupy: płonie, jeśli ktoś wybiera się dziś na którekolwiek
    z jej boisk. Bez tego grupowanie chowałoby jedyną informację na mapie, która żyje
    w ciągu dnia - na widoku całej Polski ogień byłby widoczny dopiero po przybliżeniu.
    Rozmiaru grupy zapisy nie zmieniają (patrz `.grupa-marker` w arkuszu), tylko płomień.
  */
  const oznaczGrupe = useCallback((el: HTMLElement, g: GrupaBoisk) => {
    let osoby = 0;
    for (const id of g.idBoisk) osoby += checkinyRef.current[id] ?? 0;
    if (osoby > 0) {
      el.dataset.osoby = String(osoby);
      el.style.setProperty("--zar", String(Math.min(osoby, 6)));
    } else {
      delete el.dataset.osoby;
      el.style.removeProperty("--zar");
    }
  }, []);

  useEffect(() => {
    checkinyRef.current = checkiny;
    for (const [id, { el }] of Object.entries(markersRef.current)) oznaczPinezke(el, id);
    for (const { el, grupa } of Object.values(grupyRef.current)) oznaczGrupe(el, grupa);
  }, [checkiny, oznaczPinezke, oznaczGrupe]);

  /*
    Wydarzenia. Osobne pobranie od boisk (lista boisk siedzi w pamięci podręcznej na
    godziny, a wydarzenie ma być widoczne od razu po założeniu) i rzadsze niż deklaracje -
    turnieju nie dopisuje się w ciągu minuty.

    Pinezki wydarzeń przerysowujemy w całości, a nie tylko oznaczamy atrybutem: biało-
    czerwona kula i jej rozmiar siedzą w treści pinezki, nie w arkuszu. Przerysowanie
    dotyczy wyłącznie tych kilku, których to dotyczy.
  */
  useEffect(() => {
    let aktualne = true;

    const odswiez = async () => {
      const dane = await pobierzWydarzenia();
      if (!aktualne) return;

      const bylo = wydarzeniaRef.current;
      wydarzeniaRef.current = dane;
      setWydarzenia(dane);

      const zmienione = new Set([...Object.keys(bylo), ...Object.keys(dane)]);
      for (const [id, { el }] of Object.entries(markersRef.current)) {
        if (zmienione.has(id)) {
          const boisko = courts.find((c) => c.id === id);
          if (boisko) el.innerHTML = markerHtml(boisko, Boolean(dane[id]));
        }
        oznaczPinezke(el, id);
      }
    };

    void odswiez();
    const zegar = window.setInterval(() => void odswiez(), 600_000);

    return () => {
      aktualne = false;
      window.clearInterval(zegar);
    };
  }, [oznaczPinezke, courts]);

  /* ---- szare pinezki nieodkrytych boisk ----

     Osobny efekt, osobne pinezki, osobna pamięć. Nie wchodzi w warstwę boisk i nie zna jej
     stanu: nieodkryty punkt nie ma wizytówki, nie ma zapisów, nie klastruje się i nie ma
     nic wspólnego z podpaleniami. Wplecenie go w tamten efekt oznaczałoby gałąź „a jeśli to
     nie jest boisko" w każdym z jego kroków.

     Punkty pobieramy PO KADRZE i dopiero od `PRZYBLIZENIE_PUNKTOW`. Nie ma tu żadnej listy
     w pamięci przeglądarki - siedem tysięcy punktów nigdy nie jedzie na klienta, jedzie
     kilkanaście widocznych. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let zywy = true;
    let zwloka: number | undefined;
    const pinezki = new Map<string, Marker>();

    const wyczysc = () => {
      for (const m of pinezki.values()) m.remove();
      pinezki.clear();
    };

    const narysuj = (punkty: PunktOsm[]) => {
      const zostaja = new Set(punkty.map((p) => p.id));
      for (const [id, m] of pinezki) {
        if (!zostaja.has(id)) {
          m.remove();
          pinezki.delete(id);
        }
      }

      for (const punkt of punkty) {
        if (pinezki.has(punkt.id)) continue;

        const el = document.createElement("div");
        el.className = "punkt-osm";
        el.innerHTML = markerHtmlNieodkryte();
        el.title = "Boisko nieodkryte - przyjdź tu i dodaj je do mapy";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectPunkt(punkt.id);
        });

        pinezki.set(
          punkt.id,
          new Marker({ element: el, anchor: "bottom" })
            .setLngLat([punkt.lng, punkt.lat])
            .addTo(map)
        );
      }
    };

    const odswiez = () => {
      if (map.getZoom() < PRZYBLIZENIE_PUNKTOW) {
        wyczysc();
        return;
      }

      const b = map.getBounds();
      void punktyWKadrze({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      })
        .then((punkty) => {
          if (zywy) narysuj(punkty);
        })
        .catch(() => undefined);
    };

    const zaplanuj = () => {
      window.clearTimeout(zwloka);
      zwloka = window.setTimeout(odswiez, ZWLOKA_PUNKTOW_MS);
    };

    /*
      Trzy wyzwalacze: teraz, przy pierwszym spoczynku mapy i przy każdym późniejszym ruchu.

      `once("idle")` to siatka bezpieczeństwa na wyścig, którego NIE UDAŁO MI SIĘ POTWIERDZIĆ,
      więc zapisuję uczciwie, czym jest. Efekt startuje, gdy mapa zgłosi gotowość, a odpytanie
      idzie ćwierć sekundy później. Gdyby w tej ćwierci mapa nie miała jeszcze docelowego
      przybliżenia, warunek progu odrzuciłby zapytanie i - przy wejściu z gotowym kadrem, gdzie
      `moveend` nie pada ani razu - nic by go nie ponowiło. `idle` pada, gdy mapa skończy
      rysować, czyli gdy kadr jest już na pewno ustalony, i zamyka tę dziurę.

      Skąd podejrzenie: na produkcji zobaczyłem zero pinezek po wejściu i dziewięć po jednym
      przeciągnięciu. Wyglądało to na brakujący wyzwalacz, ale przyczyna była inna - w tamtym
      oknie (kanwa 3747 x 1979) pierwsze kafelki mapy poszły dwadzieścia dziewięć sekund po
      wczytaniu strony, a ja mierzyłem po kilkunastu. Przy dłuższym czekaniu pinezki pojawiają
      się same, bez dotykania mapy. Wyzwalacz zostaje mimo to: kosztuje jedną linijkę i jedno
      wywołanie, a broni przed wyścigiem, który jest możliwy nawet jeśli tamtego dnia go nie było.

      `once`, bo `idle` powtarza się po każdej zmianie i jako stały nasłuch byłby drugim
      `moveend`, tylko częstszym.
    */
    zaplanuj();
    map.once("idle", zaplanuj);
    map.on("moveend", zaplanuj);

    return () => {
      zywy = false;
      window.clearTimeout(zwloka);
      map.off("idle", zaplanuj);
      map.off("moveend", zaplanuj);
      wyczysc();
    };
  }, [ready, onSelectPunkt]);

  /* ---- pinezki i grupy boisk ----

     Na widoku całej Polski boiska są złożone w pinezki z liczbą: jedna na województwo.
     Przybliżanie rozkłada je warstwa po warstwie - województwo na skupiska, skupisko na
     okolice, okolicę na pojedyncze pinezki. Drzewo grup liczy `lib/grupy-boisk.ts`, wygląd
     pinezki grupy to `markerGrupyHtml` niżej (propozycja 10 z galerii, 17.10.2026).

     Zastąpiło to dwa dawne tryby: do trzystu boisk każde miało własną pinezkę na każdym
     przybliżeniu, a powyżej wchodziły kropki z klastrami biblioteki mapy. Pierwszy przy
     setkach boisk w województwie robił z mapy plamę, drugi nie wyglądał jak reszta serwisu.

     Dwa wyjątki od grupowania, oba z tego samego powodu - mają być widoczne od razu:
       - boisko z wydarzeniem stoi zawsze osobno, na każdym poziomie,
       - grupa z jednym boiskiem to po prostu pinezka tego boiska.

     Pinezki HTML powstają tylko dla tego, co jest na ekranie (z zapasem), więc baza
     z tysiącami boisk nie zamienia się w tysiące elementów strony. */
  const drzewoGrup = useMemo(
    () => zbudujDrzewoGrup(courts.filter((c) => !wydarzenia[c.id])),
    [courts, wydarzenia]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const byId = new Map(courts.map((c) => [c.id, c]));
    const zWydarzeniem = courts.filter((c) => wydarzeniaRef.current[c.id]);
    const bezRuchu = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /** Tworzy (albo zwraca istniejącą) pinezkę HTML dla boiska. */
    const ensureMarker = (court: MapCourt) => {
      const gotowa = markersRef.current[court.id];
      if (gotowa) return gotowa;

      const el = document.createElement("div");
      el.className = "court-marker";
      el.innerHTML = markerHtml(court, Boolean(wydarzeniaRef.current[court.id]));
      // Zdarzenia myszy tylko tam, gdzie jest prawdziwe najeżdżanie. Na dotyku przeglądarka
      // wysyła po kliknięciu sztuczne mouseenter i zaraz mouseleave - to gasiło wizytówkę
      // po chwili od dotknięcia pinezki.
      if (!coarse) {
        el.addEventListener("mouseenter", () => {
          hoverRef.current = court;
          onHoverCourt(court.id);
          reposition();
        });
        el.addEventListener("mouseleave", () => {
          hoverRef.current = null;
          onHoverCourt(null);
          schowajKarte();
        });
      }
      // zdjęcia wizytówki zaczynają lecieć przy przyłożeniu palca, nie dopiero po kliknięciu
      if (coarse) el.addEventListener("pointerdown", () => rozgrzejBoisko(court.id));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (coarse) {
          // dotyk: podświetlamy pinezkę, pokazujemy wizytówkę i przysuwamy kadr
          lastPinTapRef.current = performance.now();
          hoverRef.current = court;
          onHoverCourt(court.id);
          reposition();
          centerPin(court);
          return;
        }
        onSelectCourt(court);
      });

      oznaczPinezke(el, court.id);

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([court.lng, court.lat])
        .addTo(map);
      const entry = { marker, el };
      markersRef.current[court.id] = entry;
      return entry;
    };

    /** Usuwa pinezki, których nie ma na liście `zostaw`. */
    const pruneMarkers = (zostaw: Set<string>) => {
      for (const [id, entry] of Object.entries(markersRef.current)) {
        if (!zostaw.has(id)) {
          entry.marker.remove();
          delete markersRef.current[id];
        }
      }
    };

    /**
     * Przybliżenie po kliknięciu grupy: kadr na jej boiska, ale nie płycej niż próg, na
     * którym grupa się rozpada. Bez tej dolnej granicy kliknięcie w województwo z boiskami
     * rozrzuconymi od granicy do granicy tylko przesuwałoby mapę - kadr na nie wypadał
     * przed progiem i na ekranie zostawała ta sama liczba.
     */
    const przyblizDoGrupy = (g: GrupaBoisk) => {
      const polska = kadrPolski(map);
      if (g.poziom === "kraj") {
        if (polska) map.flyTo({ ...polska, duration: 800, essential: true });
        return;
      }

      const progi = progiGrup(map.getContainer().clientWidth);
      const prog =
        g.poziom === "wojewodztwa" ? progi.skupiska : g.poziom === "skupiska" ? progi.okolice : progi.boiska;
      const minimum = (polska?.zoom ?? ZOOM_POLSKI_ZAPAS) + prog + 0.05;
      const kamera = map.cameraForBounds(g.ramka, {
        padding: fitPadding(map.getContainer().clientWidth),
        maxZoom: 15,
      });
      map.flyTo({
        center: kamera?.center ? LngLat.convert(kamera.center) : [g.lng, g.lat],
        zoom: Math.max(kamera?.zoom ?? minimum, minimum),
        duration: 750,
        essential: true,
      });
    };

    /** Tworzy albo odświeża pinezkę grupy; `nowa` mówi, czy właśnie powstała. */
    const ensureGrupa = (g: GrupaBoisk) => {
      const podpis = `${g.idBoisk.length}|${g.lat}|${g.lng}|${g.nazwa}`;
      const gotowa = grupyRef.current[g.id];
      if (gotowa) {
        gotowa.grupa = g;
        if (gotowa.podpis !== podpis) {
          gotowa.podpis = podpis;
          gotowa.el.innerHTML = markerGrupyHtml(g);
          gotowa.el.setAttribute("aria-label", `${opisGrupy(g)} - przybliż`);
          gotowa.marker.setLngLat([g.lng, g.lat]);
        }
        oznaczGrupe(gotowa.el, g);
        return { el: gotowa.el, nowa: false };
      }

      const el = document.createElement("div");
      el.className = "court-marker grupa-marker";
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${opisGrupy(g)} - przybliż`);
      el.innerHTML = markerGrupyHtml(g);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        lastPinTapRef.current = performance.now();
        /* skład grupy mógł się zmienić od założenia pinezki (filtry) - bierzemy aktualny */
        przyblizDoGrupy(grupyRef.current[g.id]?.grupa ?? g);
      });
      oznaczGrupe(el, g);

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([g.lng, g.lat])
        .addTo(map);
      grupyRef.current[g.id] = { marker, el, grupa: g, podpis };
      return { el, nowa: true };
    };

    const pruneGrupy = (zostaw: Set<string>) => {
      for (const [id, wpis] of Object.entries(grupyRef.current)) {
        if (!zostaw.has(id)) {
          wpis.marker.remove();
          delete grupyRef.current[id];
        }
      }
    };

    /** Który poziom pokazać przy obecnym przybliżeniu - progi opisane przy `progiGrup`. */
    const wybierzPoziom = (): PoziomMapy => {
      const zoom = map.getZoom();
      const zPolski = kadrPolski(map)?.zoom ?? ZOOM_POLSKI_ZAPAS;
      const progi = progiGrup(map.getContainer().clientWidth);
      if (zoom >= zPolski + progi.boiska) return "boiska";
      if (zoom >= zPolski + progi.okolice) return "okolice";
      if (zoom >= zPolski + progi.skupiska) return "skupiska";

      /*
        Województwa zlewają się w jedną pinezkę kraju dopiero wtedy, kiedy ich pinezki
        zaczęłyby na siebie wjeżdżać - w praktyce na telefonie oddalonym do Europy i dalej.
        Mierzymy to wprost na ekranie, a nie progiem przybliżenia: odstęp zależy od tego,
        które województwa mają boiska i jak duże są pinezki na danym ekranie.
      */
      const punkty = drzewoGrup.poziomy.wojewodztwa.map((g) => map.project([g.lng, g.lat]));
      let najblizej = Infinity;
      for (let i = 0; i < punkty.length; i++) {
        for (let j = i + 1; j < punkty.length; j++) {
          najblizej = Math.min(najblizej, punkty[i].dist(punkty[j]));
        }
      }
      const skala = window.matchMedia("(max-width: 640px)").matches ? SKALA_GRUP_TELEFON : 1;
      return najblizej < ODSTEP_WOJEWODZTW * skala ? "kraj" : "wojewodztwa";
    };

    /** Grupa z poziomu `poziom`, w której leży grupa `g` - stamtąd wyjeżdża jej pinezka. */
    const przodek = (g: GrupaBoisk, poziom: PoziomGrup) => {
      let a: GrupaBoisk | undefined = g;
      while (a && GLEBOKOSC[a.poziom] > GLEBOKOSC[poziom]) {
        a = a.rodzic ? drzewoGrup.grupy.get(a.rodzic) : undefined;
      }
      return a?.poziom === poziom ? a : undefined;
    };

    /**
     * Rozpad grupy: nowa pinezka startuje w miejscu grupy, z której się wyłania, i odjeżdża
     * na swoje. Animujemy właściwość `translate` samego znacznika, bo `transform` należy do
     * MapLibre (nim stawia pinezkę na mapie) - a te dwie właściwości się składają, nie
     * nadpisują. Przezroczystości znacznika też nie ruszamy, bo i nią rządzi MapLibre.
     */
    const wyjedz = (el: HTMLElement, skad: GrupaBoisk | undefined, dokad: [number, number]) => {
      if (!skad || bezRuchu) return;
      const a = map.project([skad.lng, skad.lat]);
      const b = map.project(dokad);
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.hypot(dx, dy) < 2) return;

      el.style.transition = "none";
      el.style.translate = `${dx}px ${dy}px`;
      const koniec = (e: TransitionEvent) => {
        if (e.target !== el || e.propertyName !== "translate") return;
        el.style.transition = "";
        el.style.translate = "";
        el.removeEventListener("transitionend", koniec);
      };
      el.addEventListener("transitionend", koniec);
      /* dwie klatki: pierwsza maluje pinezkę w miejscu startu, druga puszcza ruch */
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = `translate ${CZAS_ROZPADU}ms cubic-bezier(.2,.8,.2,1)`;
          el.style.translate = "0px 0px";
        })
      );
    };

    /*
      Poziom wybrany progami i poziom faktycznie narysowany. Bywają różne: przy zbyt wielu
      boiskach na ekranie zamiast pojedynczych pinezek zostają okolice (`PIN_LIMIT`).
    */
    let wybrany: PoziomMapy | null = null;
    let narysowany: PoziomMapy | null = null;

    const sync = () => {
      wybrany = wybierzPoziom();
      let poziom = wybrany;

      const b = map.getBounds();
      /* zapas za krawędzią ekranu, żeby przy przesuwaniu pinezki nie wyskakiwały znikąd */
      const zapasX = (b.getEast() - b.getWest()) * 0.15;
      const zapasY = (b.getNorth() - b.getSouth()) * 0.15;
      const naEkranie = (lng: number, lat: number) =>
        lng >= b.getWest() - zapasX &&
        lng <= b.getEast() + zapasX &&
        lat >= b.getSouth() - zapasY &&
        lat <= b.getNorth() + zapasY;

      const boiskaNaMapie = new Map(zWydarzeniem.map((c) => [c.id, c]));
      const grupyNaMapie: GrupaBoisk[] = [];

      if (poziom === "boiska") {
        const widoczne = courts.filter(
          (c) => !wydarzeniaRef.current[c.id] && naEkranie(c.lng, c.lat)
        );
        // przy zbyt wielu boiskach na ekranie zostają okolice - pinezki byłyby kaszą
        if (widoczne.length > PIN_LIMIT) poziom = "okolice";
        else for (const c of widoczne) boiskaNaMapie.set(c.id, c);
      }

      if (poziom !== "boiska") {
        /* województw jest kilkanaście, a kraj jeden - te rysujemy zawsze, resztę tylko na ekranie */
        const wszystkie = poziom === "kraj" || poziom === "wojewodztwa";
        for (const g of drzewoGrup.poziomy[poziom]) {
          if (!wszystkie && !naEkranie(g.lng, g.lat)) continue;
          if (g.idBoisk.length === 1) {
            const c = byId.get(g.idBoisk[0]);
            if (c) boiskaNaMapie.set(c.id, c);
          } else {
            grupyNaMapie.push(g);
          }
        }
      }

      /* rozjazd tylko przy przybliżaniu - przy oddalaniu grupy po prostu się pojawiają */
      const poprzedni =
        narysowany && narysowany !== "boiska" && GLEBOKOSC[poziom] > GLEBOKOSC[narysowany]
          ? narysowany
          : null;

      pruneMarkers(new Set(boiskaNaMapie.keys()));
      for (const court of boiskaNaMapie.values()) {
        const nowa = !markersRef.current[court.id];
        const { el } = ensureMarker(court);
        el.dataset.active = String(court.id === activeId);
        if (nowa && poprzedni) {
          const id = drzewoGrup.przynaleznosc[poprzedni].get(court.id);
          wyjedz(el, id ? drzewoGrup.grupy.get(id) : undefined, [court.lng, court.lat]);
        }
      }

      pruneGrupy(new Set(grupyNaMapie.map((g) => g.id)));
      for (const g of grupyNaMapie) {
        const { el, nowa } = ensureGrupa(g);
        /* boisko podświetlone na liście świeci przez grupę, w której jest schowane */
        el.dataset.active = String(
          activeId !== null && drzewoGrup.przynaleznosc[g.poziom].get(activeId) === g.id
        );
        if (nowa && poprzedni) wyjedz(el, przodek(g, poprzedni), [g.lng, g.lat]);
      }

      narysowany = poziom;
    };

    /*
      Przy przybliżaniu sprawdzamy poziom w każdej klatce (rolka, szczypanie, dolot), żeby
      rozpad szedł za palcem, a nie czekał na koniec ruchu. Pełne przeliczenie tylko przy
      zmianie poziomu - sam wybór poziomu to kilkanaście rzutów punktów. Po zatrzymaniu
      mapy liczymy wszystko od nowa, bo przesunięcie zmienia to, co jest na ekranie.
    */
    let klatka = 0;
    const przyZoomie = () => {
      if (klatka) return;
      klatka = requestAnimationFrame(() => {
        klatka = 0;
        if (wybierzPoziom() !== wybrany) sync();
      });
    };

    sync();
    map.on("zoom", przyZoomie);
    map.on("moveend", sync);
    map.on("resize", sync);
    return () => {
      cancelAnimationFrame(klatka);
      map.off("zoom", przyZoomie);
      map.off("moveend", sync);
      map.off("resize", sync);
    };
    /*
      Wydarzenia wchodzą tu przez `drzewoGrup`: boisko z wydarzeniem wychodzi z grupy
      i dostaje własną pinezkę, a wydarzenia dociągają się osobnym zapytaniem, już po
      pierwszym rysowaniu - bez tej zależności pinezka wydarzenia nie powstałaby wcale.
    */
  }, [courts, drzewoGrup, ready, activeId, onHoverCourt, onSelectCourt, reposition, centerPin, coarse, oznaczPinezke, oznaczGrupe, schowajKarte]);

  /* ---- podświetlenie aktywnej pinezki ---- */
  useEffect(() => {
    for (const [id, { el }] of Object.entries(markersRef.current)) {
      el.dataset.active = String(id === activeId);
    }
    /* boisko schowane w grupie świeci przez nią */
    for (const { el, grupa } of Object.values(grupyRef.current)) {
      el.dataset.active = String(
        activeId !== null && drzewoGrup.przynaleznosc[grupa.poziom].get(activeId) === grupa.id
      );
    }
  }, [activeId, courts, drzewoGrup]);

  /* ---- szare punkty kandydatów z OSM ----
     Tysiące pinezek HTML zabiłyby przeglądarkę, więc lecą jako warstwa GeoJSON.
     Nie czekamy na zdarzenie `load` (w karcie w tle nigdy nie przychodzi) - wystarczy
     sparsowany styl, czyli obecność warstwy bazowej. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const data = {
      type: "FeatureCollection" as const,
      features: (leads ?? []).map((l) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
        properties: { id: l.id, name: l.name },
      })),
    };

    const attach = () => {
      const source = map.getSource("leads");
      if (source) {
        (source as unknown as { setData: (d: typeof data) => void }).setData(data);
        return;
      }

      map.addSource("leads", { type: "geojson", data });
      map.addLayer({
        id: "leads-dots",
        type: "circle",
        source: "leads",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.4, 9, 4, 13, 7, 16, 10],
          "circle-color": "#9aa1ab",
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "rgba(8,8,11,0.9)",
        },
      });

      map.on("click", "leads-dots", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        onSelectLeadRef.current?.({
          id: String(f.properties?.id ?? ""),
          name: String(f.properties?.name ?? ""),
          lat,
          lng,
        });
      });
      map.on("mouseenter", "leads-dots", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "leads-dots", () => {
        map.getCanvas().style.cursor = "";
      });
    };

    if (map.getLayer("carto")) attach();
    else map.once("styledata", attach);
  }, [leads, ready]);

  /*
    Które województwo świeci: kliknięte na mapie albo wybrane w filtrach. Kliknięcie ma
    pierwszeństwo, bo jest gestem świeższym i bardziej bezpośrednim - palec wskazał
    konkretne miejsce. Gdy wybór kliknięciem znika (odsunięcie kamery), wraca podświetlenie
    z filtrów, o ile jakieś było.
  */
  const zFiltru = highlightVoivodeship === porzuconeWoj ? "" : highlightVoivodeship;
  const wybraneWoj = wojKlikniete || zFiltru;

  /* nasłuchy mapy czytają wybór z refa - patrz komentarz przy `wojKlikRef` */
  useEffect(() => {
    wojKlikRef.current = wojKlikniete;
  }, [wojKlikniete]);

  /*
    Zmiana województwa w filtrach kasuje wybór z mapy. Bez tego stare kliknięcie
    przykrywałoby świeży wybór z panelu i podświetlone byłoby co innego niż na liście.

    Poprawka stanu w trakcie renderu, a nie w efekcie - to dokładnie ten przypadek, dla
    którego React taki zapis dopuszcza: stan zależny od zmiany właściwości. W efekcie
    oznaczałoby to render z chwilowo złym podświetleniem i drugi zaraz po nim.
  */
  const [ostatniFiltrWoj, setOstatniFiltrWoj] = useState(highlightVoivodeship);
  if (ostatniFiltrWoj !== highlightVoivodeship) {
    setOstatniFiltrWoj(highlightVoivodeship);
    setWojKlikniete(null);
    /* świeży wybór w panelu ma świecić także wtedy, gdy z tego samego regionu się wyszło */
    setPorzuconeWoj(null);
  }

  /*
    Barwy warstw mapy pod aktualny motyw.
    
    MapLibre trzyma własną kopię stylu i nie wie nic o arkuszu, więc przy zmianie skórki
    trzeba mu je podać wprost. Odczytujemy wyliczone zmienne (czyli już po zadziałaniu
    `data-motyw`) i przestawiamy malowanie warstwa po warstwie.

    Efekt zależy od `courts`, choć barw z nich nie bierze: warstwy `boiska-*` powstają
    dopiero razem z danymi, a `setPaintProperty` na nieistniejącej warstwie rzuca wyjątkiem.
    Stąd też `getLayer` przed każdym wpisem - to nie ostrożność na zapas, tylko jedyny
    sposób, żeby przemalowanie nie zależało od kolejności efektów.
  */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    pomalujWgMotywu(map);
  }, [motyw, ready, courts]);

  /* ---- podświetlenie województwa ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("woj-active", ["==", ["get", "nazwa"], wybraneWoj || "__none__"]);
  }, [wybraneWoj, ready]);

  /*
    Kadr na kliknięte województwo i powrót po odsunięciu.

    Dolot kończy się zapamiętaniem osiągniętego przybliżenia - od niego liczy się potem
    gaśnięcie żaru przy oddalaniu kamery (patrz obsługa zdarzenia `zoom` wyżej).
  */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!wojKlikniete) {
      zoomWejsciaRef.current = null;
      return;
    }

    let aktualne = true;

    void (async () => {
      const kolekcja = await wczytajWojewodztwa();
      if (!aktualne || !kolekcja) return;

      /*
        Szerokość mierzymy po dociągnięciu granic, nie przed. Przy wejściu z adresu ten
        efekt rusza razem z mapą i kontener bywa w tej chwili jeszcze zerowy - wyliczony
        z niego margines dawałby kadr obok regionu.
      */
      const szerokosc = containerRef.current?.clientWidth ?? 1024;

      const cecha = kolekcja.features.find((f) => f.properties?.nazwa === wojKlikniete);
      const bbox = cecha?.geometry ? bboxWojewodztwa(cecha.geometry) : null;
      if (!bbox) return;

      const koniec = () => {
        if (!aktualne) return;
        zoomWejsciaRef.current = map.getZoom();
      };
      map.once("moveend", koniec);

      map.fitBounds(bbox, {
        padding: fitPadding(szerokosc),
        duration: 950,
        essential: true,
      });
    })();

    return () => {
      aktualne = false;
    };
  }, [wojKlikniete, ready]);

  /*
    Powrót do kadru na Polskę po opuszczeniu województwa. Osobny efekt od tego wyżej,
    bo ma się wykonać TYLKO przy przejściu z wyboru w brak - a nie przy pierwszym
    renderze, kiedy wyboru nigdy nie było i mapa dopiero układa się w kadrze startowym.
  */
  const bylWybor = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (wojKlikniete) {
      bylWybor.current = true;
      return;
    }
    if (!bylWybor.current) return;
    bylWybor.current = false;

    const kadr = kadrPolski(map);
    if (kadr) map.flyTo({ ...kadr, duration: 900, essential: true });
  }, [wojKlikniete, ready]);

  /*
    Żywy gradient w obrysie wybranego województwa.

    Kształt bierzemy z tego samego pliku, którym karmimy mapę - przeglądarka ma go już
    w pamięci, więc drugie pobranie nic nie kosztuje. Czytamy go osobno, a nie przez
    `querySourceFeatures`, bo tamto oddaje geometrię pociętą na kafelki: obrys byłby
    poszarpany na granicach kafelków i zależny od aktualnego przybliżenia.
  */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const zar = stworzZarWojewodztwa(map, przyrostekZaru());
    zarRef.current = zar;

    return () => {
      zarRef.current = null;
      zar.zniszcz();
    };
  }, [ready]);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const zar = zarRef.current;
      if (!zar) return;

      if (!wybraneWoj) {
        zar.ustaw(null);
        return;
      }

      const kolekcja = await wczytajWojewodztwa();
      if (!aktualne || !kolekcja) return;

      const cecha = kolekcja.features.find((f) => f.properties?.nazwa === wybraneWoj);
      /*
        Punkt kliknięcia podajemy tylko wtedy, gdy świeci region wskazany palcem. Wybór
        z panelu filtrów albo z adresu nie ma miejsca, z którego fala miałaby wyjść - tam
        zostaje zwykłe rozjaśnienie.
      */
      zarRef.current?.ustaw(
        cecha?.geometry ?? null,
        wojKlikniete === wybraneWoj && punktKliku ? punktKliku : undefined
      );
    })();

    return () => {
      aktualne = false;
    };
  }, [wybraneWoj, wojKlikniete, punktKliku, ready]);

  const zoomBy = (d: number) => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 6) + d, { duration: 320 });

  const resetView = () => {
    const map = mapRef.current;
    const kadr = map && kadrPolski(map);
    if (kadr) map.flyTo({ ...kadr, duration: 900 });
  };

  return (
    <div className="map-shell absolute inset-0">
      {/* h-full/w-full, a nie absolute inset-0: maplibre-gl.css wymusza na tym divie
          position:relative, przez co inset-0 nie działa i kontener ma wysokość 0. */}
      <div ref={containerRef} className="h-full w-full" />

      {/* filtr zaginający tło pod wizytówką - musi być w drzewie, sam nic nie rysuje */}
      <FiltrSzkla />

      {/*
        Rysujemy wizytówkę aktywną ALBO tę, która właśnie gaśnie - nigdy obie. Dzięki temu
        przejście z pinezki na pinezkę jest jednym ruchem: stara nie zostaje na ekranie,
        tylko od razu ustępuje nowej.
      */}
      {(hover ?? znika) &&
        !sheetOpen &&
        (() => {
          const karta = (hover ?? znika) as Karta;
          const stan = hover ? "wchodzi" : "znika";
          return coarse ? (
            // dotyk: wizytówka siedzi nad wysuwanym panelem, cała jest linkiem do boiska
            // 266 px zamiast 380 px: karta jest o ~30% mniejsza i nie zjada połowy ekranu
            <div
              ref={cardRef}
              className="pointer-events-auto fixed inset-x-3 bottom-[158px] z-[35] mx-auto max-w-[266px]"
            >
              <Link href={`/boisko/${karta.court.slug}`} className="block">
                <HoverCard
                  court={karta.court}
                  wydarzenie={wydarzenia[karta.court.id]}
                  osobyDzis={karta.osoby}
                  tapHint
                  stan={stan}
                />
              </Link>
              {/*
                Zamknięcie wprost na karcie. Bez niego jedynym sposobem było dotknięcie mapy
                obok - a dotknięcie mapy wybiera województwo i kamera odjeżdżała w region,
                choć ktoś chciał tylko schować wizytówkę. Przycisk leży POZA linkiem, żeby
                dotknięcie go nie otwierało karty boiska.
              */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearCard();
                }}
                aria-label="Zamknij podgląd boiska"
                className="glass absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full text-ink/85 transition active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              className="pointer-events-none absolute z-20"
              ref={kartaPozRef}
              // perspektywa dla przechyłu wizytówki za kursorem (zmienne --wiz-* ustawia efekt wyżej);
              // przy górnej krawędzi mapy karta nie zmieściłaby się nad pinezką - wtedy staje pod nią
              style={
                karta.y - 58 - wysKarty >= 8
                  ? { left: karta.x, top: karta.y - 58, transform: "translate(-50%,-100%)", perspective: 900 }
                  : { left: karta.x, top: karta.y + 14, transform: "translate(-50%,0)", perspective: 900 }
              }
            >
              <HoverCard
                court={karta.court}
                wydarzenie={wydarzenia[karta.court.id]}
                osobyDzis={karta.osoby}
                stan={stan}
              />
            </div>
          );
        })()}

      {showDiag && !ready && diag && (
        <div className="glass absolute left-1/2 top-1/2 z-30 w-[440px] max-w-[86vw] -translate-x-1/2 -translate-y-1/2 rounded-[22px] p-5 text-[13px]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-flame">
            Diagnostyka mapy
          </p>
          <ul className="mt-3 space-y-1.5 text-muted">
            <li>WebGL: <b className="text-ink">{diag.webgl}</b></li>
            <li>Mapa utworzona: <b className="text-ink">{diag.created ? "tak" : "NIE"}</b></li>
            <li>Styl wczytany: <b className="text-ink">{diag.style ? "tak" : "NIE"}</b></li>
            <li>Zdarzenie load: <b className="text-ink">{diag.loaded ? "tak" : "NIE"}</b></li>
            <li>Wczytane kafelki: <b className="text-ink">{diag.tiles}</b></li>
          </ul>
          {diag.errors.length > 0 ? (
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-faint">Błędy</p>
              <ul className="mt-1.5 space-y-1 text-ember">
                {diag.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="break-words">· {e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 border-t border-hairline pt-3 text-faint">
              Brak zgłoszonych błędów.
            </p>
          )}
        </div>
      )}

      {/*
        Na telefonie przyciski są mniejsze i wciśnięte w róg: 36 px zamiast 44 i 10 px od
        krawędzi. Pełne 44 px zajmowały pas mapy, po którym przesuwa się palcem, a przybliżanie
        i tak robi się tam szczypaniem - przyciski są dodatkiem, nie głównym sterowaniem.
      */}
      <div className="absolute bottom-[160px] right-2.5 z-20 flex flex-col gap-1.5 lg:bottom-8 lg:right-6 lg:gap-2">
        <button
          onClick={() => zoomBy(1)}
          className="glass grid h-9 w-9 place-items-center rounded-xl text-lg text-ink/80 transition hover:text-ink active:scale-95 lg:h-11 lg:w-11 lg:rounded-2xl lg:text-xl"
          aria-label="Przybliż"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(-1)}
          className="glass grid h-9 w-9 place-items-center rounded-xl text-lg text-ink/80 transition hover:text-ink active:scale-95 lg:h-11 lg:w-11 lg:rounded-2xl lg:text-xl"
          aria-label="Oddal"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="glass grid h-9 w-9 place-items-center rounded-xl text-ink/70 transition hover:text-ink active:scale-95 lg:h-11 lg:w-11 lg:rounded-2xl"
          aria-label="Cała Polska"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 lg:h-5 lg:w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c4.5 5 4.5 12 0 17M12 3.5c-4.5 5-4.5 12 0 17" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Pinezka boiska: krążek w gradiencie z włosową ikoną piłki w środku.
 *
 * Kontur piłki jest cienki (0,95 przy 24 jednostkach), bo przy 38 pikselach grubsza kreska
 * zamieniała rysunek w czarną plamę. Sam krążek dostaje gradient marki i wewnętrzny błysk
 * na krawędzi - to on daje wrażenie wypukłości, nie ikona.
 */
/**
 * Pinezka minigry - ta sama forma co zwykła, ale niebieska i z piłką zamiast kosza.
 *
 * Kolor jest inny z rozmysłem: pomarańcz to boiska w bazie, zieleń to wyróżnienie Heat,
 * a błękit nie znaczy na tej mapie nic innego - więc od razu widać, że to coś osobnego,
 * i nikt nie pomyśli, że w Kalifornii dodano boisko do polskiej bazy.
 */
/*
  Materiał piłki: „Matowa guma” - wariant 05 z galerii stylów pinezek
  (F:/CLAUDE/podkosz-pinezki/style-pinezek.html), wybrany 19.10.2026.

  Kształt, kolory i szwy zostają, dochodzi wykonanie prawdziwej piłki: ziarnista skóra
  z drobnymi wypustkami, miękkie światło z lewej góry bez połysku i szwy jak wgłębione
  rowki - jasna krawędź rowka po stronie odwróconej od światła. Trzy warstwy leżą w kuli
  POD szwami; barwę cienia biorą z `--b3` (najciemniejszy ton kuli), a wielkość faktury
  z `--kula` - obie zmienne ustawia korpus pinezki. Reguły w globals.css przy `.pilka-faktura`.
*/
const WARSTWY_GUMY =
  `<span class="pilka-faktura"></span><span class="pilka-cien"></span>` +
  `<svg class="pilka-rowki" viewBox="0 0 24 24" aria-hidden="true"><path d="${szwyPilki(12, 12, 12)}"/></svg>`;

/** cień całej pinezki w gumie: krótszy i bliżej mapy niż dawny, bo matowa kula nie świeci */
const CIEN_GUMY = "drop-shadow(0 4px 6px rgb(0 0 0 / calc(.5 * var(--moc-cienia, 1))))";

function markerGryHtml(g: MiejsceGry) {
  const size = 38;
  const gra = NAZWY_GIER[g.rodzaj];

  /*
    Budowa jeden do jednego z `markerHtml`: kolumna, w której kula stoi na nóżce zakończonej
    kropką. Wcześniej ta pinezka miała własną konstrukcję na pozycjonowaniu bezwzględnym i
    dwie rzeczy z tego wynikały, obie źle:

      - kula miała `inset: 0` w pudełku o wysokości `size + 10`, więc rozciągała się na
        38 x 48 px i z koła robiło się jajko;
      - nóżka i kropka leżały POD kulą w tym samym pudełku, czyli były nią zasłonięte -
        pinezka gry nie miała widocznego oparcia, choć w kodzie je miała.

    Teraz obie pinezki są tym samym kształtem w dwóch barwach i nie ma jak ich rozjechać.
  */
  return `<span class="relative flex flex-col items-center"
      style="--cien:29 95 208;--b3:29 95 208;--kula:${size}px;filter:${CIEN_GUMY}">

    ${wizytowkaGryHtml(g, gra)}

    <span class="pulse-glow absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
      style="width:${size * 1.8}px;height:${size * 1.8}px;pointer-events:none;
      background:radial-gradient(circle,rgba(86,172,255,.55) 0%,rgba(24,92,190,.18) 45%,transparent 70%)"></span>

    <span class="marker-core relative grid place-items-center rounded-full transition-all duration-200"
      style="width:${size}px;height:${size}px;
      background:linear-gradient(135deg,#d7ecff,#56acff 55%,#1d5fd0);
      box-shadow:inset 0 0 0 .5px rgb(var(--b3) / .55), 0 5px 14px -7px rgba(20,80,180,.9)">
      ${WARSTWY_GUMY}
      <svg class="pilka-szwy" viewBox="0 0 24 24" style="width:${size}px;height:${size}px" fill="none"
        stroke="rgba(10,30,70,.72)" stroke-width=".97" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
    </span>

    <span style="position:relative;width:2px;height:10px;background:linear-gradient(180deg,#56acff,transparent)"></span>
    <span style="position:relative;width:7px;height:3px;border-radius:99px;background:rgba(86,172,255,.85)"></span>
  </span>`;
}

/**
 * Wizytówka minigry - to, co pokazuje się po najechaniu na niebieską pinezkę.
 *
 * ------------------------------------------------------------------ czemu bez Reacta
 *
 * Wizytówka boiska jest komponentem, bo musi dociągnąć zdjęcia, zna wydarzenia i zmienia
 * treść w trakcie życia strony. Tutaj nie ma czego dociągać: nazwa gry, miasto i jedno
 * zdanie instrukcji są znane w chwili wieszania pinezki i nigdy się nie zmieniają.
 *
 * Skoro treść jest stała, karta może siedzieć WEWNĄTRZ znacznika i pokazywać się samym
 * arkuszem. Dzięki temu nie ma stanu, nie ma nasłuchiwania myszy i - co najważniejsze -
 * nie ma przeliczania położenia przy każdym ruchu mapy: karta jest dzieckiem pinezki,
 * więc jeździ razem z nią za darmo.
 *
 * Widoczna tylko tam, gdzie jest prawdziwe najeżdżanie (`@media (hover: hover)`), bo na
 * dotyku „hover" zapala się po stuknięciu i zostaje - a stuknięcie w tę pinezkę ma
 * otwierać grę, nie zostawiać wiszącą chmurkę.
 */
function wizytowkaGryHtml(g: MiejsceGry, gra: (typeof NAZWY_GIER)[RodzajGry]) {
  /*
    Nazwa gry zaczyna się od słowa „Minigra" (patrz `NAZWY_GIER`), więc nadtytuł
    powtarzałby je dwa razy pod rząd. Zostaje samo rozróżnienie - „Rzuty", „Kozły" -
    a wspólny przedrostek idzie nad nim, mniejszą kreską.
  */
  const [przedrostek, ...reszta] = gra.nazwa.split(" ");
  const nazwaGry = reszta.join(" ") || gra.nazwa;

  /* Chicago stoi w Chicago - „Chicago · Chicago" wygląda jak usterka, więc łączymy w jedno. */
  const gdzie = g.nazwa === g.miasto ? g.nazwa : `${g.nazwa} · ${g.miasto}`;

  return `<span class="wizytowka-gry" aria-hidden="true">
    <span class="wizytowka-gry-karta szklo-plynne">
      <span class="wgk-nadtytul">${przedrostek}</span>
      <span class="wgk-tytul">${nazwaGry}</span>
      <span class="wgk-miejsce">${gdzie}</span>
      <span class="wgk-jak">${gra.jak}</span>
      <span class="wgk-stopka">Kliknij, żeby zagrać</span>
    </span>
  </span>`;
}

/*
  Plik z granicami czytamy raz na całą sesję. Identyfikatory gradientów w SVG muszą być
  unikalne na stronie, stąd licznik - dwie mapy na jednej stronie (np. przy przyszłym
  podglądzie) nie mogą sobie podbierać wypełnień.
*/
let wojewodztwaPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

function wczytajWojewodztwa() {
  wojewodztwaPromise ??= fetch("/geo/wojewodztwa.geojson")
    .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null))
    .catch(() => null);
  return wojewodztwaPromise;
}

let licznikZaru = 0;
function przyrostekZaru() {
  licznikZaru += 1;
  return String(licznikZaru);
}

/**
 * Szara pinezka nieodkrytego boiska.
 *
 * Ta sama rodzina kształtów co pinezka boiska - kula, nóżka, kropka - i to jest cały zamysł:
 * ma być czytelne, że to jest boisko, tylko jeszcze nie nasze. Różnice są celowe i wszystkie
 * mówią „to jeszcze nie istnieje":
 *
 *   - barwa: grafit zamiast ognia, bez ani jednego akcentu koloru,
 *   - brak poświaty i brak płomienia - one należą się boiskom, na których ktoś już był,
 *   - kreska przerywana zamiast pełnej kuli: kształt jest zarysowany, nie wypełniony,
 *   - mniejsza (30 px wobec 38 px), więc obok prawdziwej pinezki nigdy nie wygra spojrzenia.
 *
 * Bez `pinezka-korpus`: tamta klasa jest podpięta pod skalowanie od zapisów i od wydarzeń
 * w arkuszu, a tu nie ma czego skalować.
 */
function markerHtmlNieodkryte() {
  const size = 30;
  return `
  <div class="punkt-osm-korpus relative flex flex-col items-center"
       style="filter: drop-shadow(0 4px 10px rgb(0 0 0 / calc(.5 * var(--moc-cienia, 1))))">
    <span class="punkt-osm-kula grid place-items-center rounded-full"
          style="width:${size}px;height:${size}px">
      <!-- kulka JEST piłką, tak samo jak w pinezce boiska; obrysem jest jej kreskowana krawędź -->
      <svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px" fill="none"
           stroke="currentColor" stroke-width="1.12" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
    </span>
    <span class="punkt-osm-nozka" style="width:2px;height:8px"></span>
    <span class="punkt-osm-kropka" style="width:6px;height:3px;border-radius:99px"></span>
  </div>`;
}

/*
  Pinezka grupy boisk - propozycja 10 („Rośnie z liczbą") z galerii w F:\CLAUDE\podkosz-pinezki,
  wybrana 17.10.2026.

  Budowa jeden do jednego z `markerHtml`: kula na nóżce z kropką, poświata, cień i ogień
  zapisów - więc działają na nią te same reguły arkusza (powiększenie przy najechaniu,
  podświetlenie, płomień). Różnice:

    - w kuli liczba boisk, a szwy zostają pod nią przygaszone do połowy,
    - kula rośnie z liczbą: 38 px (jak zwykła pinezka) do 20 boisk, 58 px od tysiąca,
      pomiędzy logarytmicznie - różnicę między 30 a 300 widać, a 3000 nie rozsadza mapy,
    - nad kulą podpis z nazwą i liczbą, widoczny po najechaniu kursorem.
*/
const KULA_GRUPY_MIN = 38;
const KULA_GRUPY_MAX = 58;

function rozmiarKuliGrupy(ile: number) {
  const t = Math.log(ile / 20) / Math.log(1000 / 20);
  return Math.round(KULA_GRUPY_MIN + (KULA_GRUPY_MAX - KULA_GRUPY_MIN) * Math.max(0, Math.min(1, t)));
}

/** Liczba w kuli: do czterech cyfr wprost, większe w tysiącach - piąta cyfra już się nie mieści. */
function liczbaGrupy(ile: number) {
  return ile < 10_000 ? String(ile) : `${Math.round(ile / 1000)}k`;
}

/** „Małopolskie · 350 boisk" - podpis nad kulą i opis dla czytnika ekranu. */
function opisGrupy(g: GrupaBoisk) {
  const ile = g.idBoisk.length;
  const nazwa = g.nazwa.charAt(0).toLocaleUpperCase("pl") + g.nazwa.slice(1);
  return `${nazwa} · ${ile} ${plural(ile, ["boisko", "boiska", "boisk"])}`;
}

/** Nazwy miast pochodzą ze zgłoszeń - do HTML trafiają zawsze zabezpieczone. */
function bezpieczny(tekst: string) {
  const zamiany: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return tekst.replace(/[&<>"']/g, (z) => zamiany[z] ?? z);
}

function markerGrupyHtml(g: GrupaBoisk) {
  const ile = g.idBoisk.length;
  const size = rozmiarKuliGrupy(ile);
  const tekst = liczbaGrupy(ile);
  /* cyfry drobnieją z ich liczbą, jak w galerii: 15 px do dwóch cyfr przy kuli 38 px */
  const fs = Math.round([15, 15, 13, 11][Math.min(tekst.length, 4) - 1] * (size / 38) * 10) / 10;

  return `
  <div class="pinezka-korpus relative flex flex-col items-center"
       style="filter: ${CIEN_GUMY};--kula:${size}px;--b3:var(--rgb-ember);--cien:var(--rgb-ember);--o1:var(--rgb-glow-soft);--o2:var(--rgb-glow);--o3:var(--rgb-flame);--o4:var(--rgb-ember-deep)">
    <span class="grupa-podpis">${bezpieczny(opisGrupy(g))}</span>
    <span class="pulse-glow absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
          style="width:${size * 1.8}px;height:${size * 1.8}px;background:radial-gradient(circle, rgb(var(--rgb-flame) / .55) 0%, rgb(var(--rgb-ember) / .18) 45%, transparent 70%)"></span>
    <span class="pinezka-ogien">
      <span class="ogien-aura"></span>
      <span class="ogien-jezyk"></span>
      <span class="ogien-jezyk ogien-jezyk-maly"></span>
    </span>
    <span class="marker-core relative grid place-items-center rounded-full transition-all duration-200"
          style="width:${size}px;height:${size}px;background:linear-gradient(135deg,var(--color-glow-soft),var(--color-flame) 55%,var(--color-ember));box-shadow:inset 0 0 0 .5px rgb(var(--b3) / .55), 0 5px 14px -7px rgb(var(--rgb-ember) / calc(.9 * var(--moc-poswiaty, 1)))">
      ${WARSTWY_GUMY}
      <svg class="pilka-szwy" viewBox="0 0 24 24" style="width:${size}px;height:${size}px;opacity:.5" fill="none" stroke="rgba(40,10,0,.72)" stroke-width=".97" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
      <span class="grupa-liczba" style="font-size:${fs}px">${tekst}</span>
    </span>
    <span style="position:relative;width:2px;height:10px;background:linear-gradient(180deg,var(--color-flame),transparent)"></span>
    <span style="position:relative;width:7px;height:3px;border-radius:99px;background:rgb(var(--rgb-flame) / .85)"></span>
  </div>`;
}

function markerHtml(court: MapCourt, wydarzenie = false) {
  const big = court.likes >= 200;
  /*
    Pinezka wydarzenia jest 2,5 raza większa od zwykłej i to jest jej cała robota: ma być
    widoczna z pierwszego spojrzenia na mapę, zanim ktokolwiek zacznie czegoś szukać.
    Reszta różnic (biało-czerwona kula, biało-czerwony ogień, zawsze zapalony) idzie
    poniżej - poza rozmiarem struktura pinezki jest ta sama, więc wszystko, co już działa
    (najechanie, dotyk, wizytówka, ogień), działa dalej bez ani jednej gałęzi więcej.
  */
  const size = wydarzenie ? 67 : big ? 46 : 38;

  /*
    Boiska z wyróżnieniem Heat świecą na zielono, w barwie z logo Coconaut (#38aa32; do
    17.10.2026 na fioletowo) - mają odróżniać się na pierwszy rzut oka. Szwy piłki na
    zielonej kuli są białe (od 19.10.2026, wcześniej ciemnozielone).
  */
  const glow = wydarzenie
    ? "rgba(255,255,255,.62) 0%, rgba(232,17,45,.4) 42%, transparent 72%"
    : court.basketApproved
      ? "rgba(56,170,50,.6) 0%, rgba(29,116,25,.2) 45%, transparent 70%"
      : "rgb(var(--rgb-flame) / .55) 0%, rgb(var(--rgb-ember) / .18) 45%, transparent 70%";
  /*
    Gradient biel-czerwień, nie flaga. Ostry podział na pół czytał się jak wklejona
    chorągiewka i gubił kulę: kula ma światło i cień, a flaga jest płaska. Ten sam
    kierunek (135 stopni), co w pozostałych pinezkach, więc wszystkie wyglądają jak
    jedna rodzina w różnych barwach.
  */
  const core = wydarzenie
    ? "linear-gradient(135deg,#ffffff,#ffd3d8 32%,#e8112d 72%,#a60c1e)"
    : court.basketApproved
      ? "linear-gradient(135deg,#d9f7cf,#38aa32 55%,#1d7419)"
      : "linear-gradient(135deg,var(--color-glow-soft),var(--color-flame) 55%,var(--color-ember))";
  /* łuna pod kulą słabnie w motywach jasnych - na bieli 90% barwy to plama, nie światło */
  const shadow = wydarzenie
    ? "rgb(232 17 45 / calc(.95 * var(--moc-poswiaty, 1)))"
    : court.basketApproved
      ? "rgb(29 116 25 / calc(.9 * var(--moc-poswiaty, 1)))"
      : "rgb(var(--rgb-ember) / calc(.9 * var(--moc-poswiaty, 1)))";
  const seam = wydarzenie
    ? "rgba(150,8,24,.55)"
    : court.basketApproved
      ? "rgba(255,255,255,.9)"
      : "rgba(40,10,0,.72)";
  const stem = wydarzenie ? "#e8112d" : court.basketApproved ? "#38aa32" : "var(--color-flame)";
  const dot = wydarzenie
    ? "rgba(232,17,45,.9)"
    : court.basketApproved
      ? "rgba(56,170,50,.85)"
      : "rgb(var(--rgb-flame) / .85)";

  /*
    Paleta ognia idzie za kolorem pinezki, nie odwrotnie: pomarańczowa pinezka pali się
    pomarańczowo, zielona pinezka Heatu - zielono. Płomień w obcym kolorze wyglądał
    jak nalepka doklejona za kulą; w kolorze pinezki jest jej przedłużeniem.

    Barwy jako trójki liczb, a nie gotowe kolory, bo w gradientach potrzebny jest ten sam
    odcień z zerową przezroczystością - `rgb(var(--o3) / 0)`. Wygaszanie do `transparent`
    idzie w sRGB przez czerń i zostawiało na końcu języka szary muł.
  */
  const ogien = wydarzenie
    ? { o1: "255 255 255", o2: "255 210 214", o3: "232 17 45", o4: "138 6 20" }
    : court.basketApproved
    ? { o1: "238 252 232", o2: "140 220 120", o3: "56 170 50", o4: "22 98 20" }
    : {
        o1: "var(--rgb-glow-soft)",
        o2: "var(--rgb-glow)",
        o3: "var(--rgb-flame)",
        o4: "var(--rgb-ember-deep)",
      };

  /*
    Kolor poświaty pod kulą przy najechaniu i na pinezce aktywnej. Wcześniej ten cień był
    wpisany na sztywno w arkuszu, na pomarańczowo i z `!important` - wyróżniona pinezka
    Heatu dostawała więc pod spodem pomarańczową łunę i wyglądała, jakby ktoś pomylił
    warstwy. Podajemy trójkę RGB, bo arkusz składa z niej kolor z własną przezroczystością.
  */
  const cien = wydarzenie ? "232 17 45" : court.basketApproved ? "56 170 50" : "var(--rgb-ember)";
  /* najciemniejszy ton kuli - nim guma ciemnieje przy krawędzi (patrz WARSTWY_GUMY) */
  const b3 = wydarzenie ? "166 12 30" : court.basketApproved ? "29 116 25" : "var(--rgb-ember)";

  /*
    PODGLĄD PROPOZYCJI PINEZEK - rusztowanie do wyrzucenia po wybraniu kształtu.

    Bez `?pinezka=<nr>` w adresie ta gałąź nie istnieje: `wariantZAdresu` zwraca wtedy
    `null` i pinezka rysuje się dokładnie tak, jak rysowała się dotąd. Podgląd dostaje
    wszystkie barwy wyliczone wyżej, więc podmienia WYŁĄCZNIE kształt - poświata, ogień
    zapisów, powiększenie przy najechaniu i skalowanie zostają mapy.
  */
  const wariant = wariantZAdresu();
  if (wariant !== null) {
    const podglad = pinezkaPodgladHtml(
      wariant,
      wydarzenie ? "wydarzenie" : court.basketApproved ? "approved" : "zwykla",
      size,
      { glow, cien, ogien }
    );
    if (podglad) return podglad;
  }

  return `
  <div class="pinezka-korpus relative flex flex-col items-center transition-transform duration-200 ease-out"
       style="filter: ${CIEN_GUMY};--kula:${size}px;--b3:${b3};--cien:${cien};--o1:${ogien.o1};--o2:${ogien.o2};--o3:${ogien.o3};--o4:${ogien.o4}">
    <span class="pulse-glow absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
          style="width:${size * 1.8}px;height:${size * 1.8}px;background:radial-gradient(circle, ${glow})"></span>
    <!--
      Ogień zapisów. Jest w pinezce zawsze, ale widać go dopiero, gdy mapa oznaczy ją
      atrybutem data-osoby. Prawdziwy element, a nie pseudoelement z ujemnym z-indeksem:
      korpus ma filtr, więc tworzy własny kontekst nakładania i ujemny z-index chował
      ogień pod tłem korpusu zamiast położyć go za kulą.

      Kolejność w drzewie jest tu całą mechaniką warstw: ogień stoi PO poświacie, więc
      kładzie się na niej, i PRZED kulą, więc języki liżą pinezkę od tyłu, a nie
      zasłaniają piłki.

      Trzy warstwy, bo bez pierwszej widać szew: aura to poświata wyśrodkowana na kuli,
      która obrysowuje ją ogniem i zszywa płomień z pinezką w jeden kształt. Dopiero na
      niej stoją dwa języki - szeroki i wąski, w przeciwfazie.
    -->
    <span class="pinezka-ogien">
      <span class="ogien-aura"></span>
      <span class="ogien-jezyk"></span>
      <span class="ogien-jezyk ogien-jezyk-maly"></span>
    </span>
    <span class="marker-core relative grid place-items-center rounded-full transition-all duration-200"
          style="width:${size}px;height:${size}px;background:${core};box-shadow:inset 0 0 0 .5px rgb(var(--b3) / .55), 0 5px 14px -7px ${shadow}">
      ${WARSTWY_GUMY}
      <!--
        Szwy idą przez CAŁĄ kulę, nie przez jej środek.

        Wcześniej rysunek piłki miał 62% średnicy pinezki i własny, ciemny obrys - więc
        w kulce siedziała druga, mniejsza piłka, a dookoła niej zostawał pusty pomarańczowy
        pierścień. Teraz kulka JEST piłką: obrysem jest jej własna krawędź, a szwy sięgają
        od brzegu do brzegu.

        Grubość 0.97 przy promieniu 12 to dokładnie ta sama proporcja kreski do średnicy,
        co w galerii propozycji (1.05 przy 13) - inaczej pinezka wyglądałaby na mapie
        inaczej niż wariant, który został wybrany.
      -->
      <svg class="pilka-szwy" viewBox="0 0 24 24" style="width:${size}px;height:${size}px" fill="none" stroke="${seam}" stroke-width=".97" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
    </span>
    <span style="position:relative;width:2px;height:10px;background:linear-gradient(180deg,${stem},transparent)"></span>
    <span style="position:relative;width:7px;height:3px;border-radius:99px;background:${dot}"></span>
  </div>`;
}
