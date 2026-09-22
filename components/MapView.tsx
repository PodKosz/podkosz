"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Map as MlMap, Marker, StyleSpecification, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapCourt } from "@/lib/types";
import { CITIES_GEOJSON } from "@/lib/cities";
import type { LeadPoint } from "@/lib/leads";
import { HoverCard } from "./HoverCard";
import { kafelkiPodkladu, podkladMapy } from "@/lib/podklad";
import { ZarWojewodztwa, bboxWojewodztwa, stworzZarWojewodztwa } from "@/lib/zarWojewodztwa";
import { useMotyw } from "@/lib/motyw";
import { CourtOutline } from "./CourtOutline";
import { FiltrSzkla } from "./FiltrSzkla";
import { czytajWidok, ostatniKadr, zapamietajKadr, zapiszWidok } from "@/lib/adres";
import { fetchCheckinyDzisiaj } from "@/lib/checkins";
import { pobierzWydarzenia, type Wydarzenie } from "@/lib/wydarzenia";
import { punktyWKadrze, type PunktOsm } from "@/lib/punkty-osm";
import { MIEJSCA_GRY, NAZWY_GIER, type MiejsceGry, type RodzajGry } from "@/lib/minigra";
import { szwyPilki } from "@/lib/pilka";
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
 * Wartości poniżej to motyw „classic" i zarazem zabezpieczenie: gdyby odczyt zmiennych
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
  ["boiska-klastry", "circle-color", "flame"],
  ["boiska-punkty", "circle-color", "flame"],
];

/** Wyliczona wartość zmiennej z arkusza; puste zwraca wartość zapasową. */
function zeStylu(nazwa: string, awaryjna: string) {
  if (typeof window === "undefined") return awaryjna;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nazwa).trim();
  return v || awaryjna;
}

const POLAND_BOUNDS: [number, number, number, number] = [13.9, 48.9, 24.3, 55.0];

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
 */
const fitPadding = (width: number) =>
  width < 1024
    ? { top: 90, bottom: 200, left: 24, right: 24 }
    : { top: 70, bottom: 70, left: 430, right: 70 };

/** Od tylu boisk mapa przechodzi z pinezek HTML na warstwę GeoJSON z klastrami. */
const CLUSTER_FROM = 300;
/** Od tego przybliżenia zamiast kropek rysujemy pełne pinezki. */
const PIN_ZOOM = 11;

/**
 * Od jakiego przybliżenia widać szare pinezki nieodkrytych boisk.
 *
 * Piętnaście to poziom, na którym widać pojedyncze budynki i podwórka - czyli moment,
 * w którym pytanie „co jest w tej okolicy" zaczyna mieć sens. Na mapie Polski, a nawet
 * na mapie miasta, tych punktów nie ma i to jest zamierzone: siedem tysięcy szarych
 * kropek nad krajem zasłoniłoby prawdziwe boiska i zamieniło mapę w szum.
 *
 * Pinezki wydarzeń mają wyjątek od progów (patrz `syncPins`), te nie mają żadnego -
 * nieodkryte boisko to zaproszenie dla kogoś, kto już jest w okolicy.
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
  zgadywanie - a przy takim oddaleniu i tak wchodzi warstwa klastrów.

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
        "raster-opacity": 0.92,
        "raster-saturation": -0.35,
        "raster-hue-rotate": -12,
        "raster-contrast": 0.08,
        "raster-brightness-max": 0.94,
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
        "line-width": 0.8,
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
        "text-font": ["Noto Sans Regular"],
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Record<string, { marker: Marker; el: HTMLDivElement }>>({});
  const [ready, setReady] = useState(false);
  /**
   * Podkład ma komplet kafelków kadru - dopiero wtedy zdejmujemy zasłonę z konturem boiska.
   * `ready` to za mało: przychodzi z samym stylem, zanim poleci pierwszy kafelek.
   */
  const [odslonieta, setOdslonieta] = useState(false);
  /** zasłona już przeniknęła - zdejmujemy ją z drzewa, żeby nie wisiała niewidzialna */
  const [zaslonaZeszla, setZaslonaZeszla] = useState(false);
  const [diag, setDiag] = useState<MapDiag | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  type Karta = { court: MapCourt; x: number; y: number };
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
    pokazKarte({ court: c, x: p.x, y: p.y });
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
        minZoom: 4.5,
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
    /*
      Podkład to kafelki rastrowe, które przychodzą po kolei - bez zasłony mapa wstawała
      kwadrat po kwadracie. Czekamy na `idle` z kompletem kafelków (samo `load` przychodzi,
      gdy gotowy jest styl, a kafelki dopiero ruszają) i odsłaniamy wszystko naraz.

      Awaryjnie po ośmiu sekundach odsłaniamy i tak: na bardzo wolnym łączu lepiej pokazać
      mapę na raty niż zostawić ekran z samym konturem.
    */
    const odslon = () => {
      clearTimeout(awaryjnie);
      map.off("idle", poGotowosci);
      setOdslonieta(true);
    };
    const poGotowosci = () => {
      if (map.areTilesLoaded()) odslon();
    };
    const awaryjnie = window.setTimeout(odslon, 8000);
    map.on("idle", poGotowosci);

    map.on("move", reposition);
    // dotknięcie samej mapy zamyka wizytówkę boiska (na markerach zatrzymujemy zdarzenie)
    map.on("click", (e) => {
      if (performance.now() - lastPinTapRef.current < 500) return;
      clearCardRef.current();

      /*
        Kliknięcie w puste miejsce wybiera województwo. „Puste" znaczy: poza pinezkami
        i poza klastrami - te mają własne obsługi i prowadzą do boisk, a nie do kadru na
        region. Pinezki HTML zatrzymują zdarzenie na swoim elemencie i tu w ogóle nie
        docierają; warstwy GeoJSON trzeba odsiać ręcznie, bo one żyją na tej samej kanwie.
      */
      const warstwy = ["boiska-klastry", "boiska-punkty", "leads-dots"].filter((w) =>
        map.getLayer(w)
      );
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
      if (!framed) {
        framed = true;
        // z województwem w adresie kadr ustawia dolot do regionu - nie odbieramy mu go
        if (!wojKlikRef.current) {
          map.fitBounds(POLAND_BOUNDS, { padding: fitPadding(width), duration: 0 });
        }
      }
    });
    ro.observe(containerRef.current);

    // Po każdym przesunięciu zapisujemy kadr w dwóch miejscach: w adresie - żeby widok dało
    // się wysłać linkiem i żeby przetrwał odświeżenie - oraz w pamięci sesji, bo z niej
    // odtwarza się powrót na mapę linkiem, który adresu ze sobą nie niesie.
    const zapiszKadr = () => {
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
      clearTimeout(awaryjnie);
      map.off("idle", poGotowosci);
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
    Ile osób wybiera się dziś na które boisko. Trzymamy to w ref, a nie w stanie: dane
    zmieniają pinezki bezpośrednio (klasa i zmienna CSS), więc przerysowywanie całej mapy
    Reactem byłoby zbędne. Odświeżamy co dwie minuty - deklaracja żyje jeden dzień, ale
    ludzie dopisują się w ciągu dnia i pinezka ma to pokazać bez przeładowania strony.
  */
  const checkinyRef = useRef<Record<string, number>>({});

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

  useEffect(() => {
    let aktualne = true;

    const odswiez = async () => {
      const dane = await fetchCheckinyDzisiaj();
      if (!aktualne) return;
      checkinyRef.current = dane;
      for (const [id, { el }] of Object.entries(markersRef.current)) oznaczPinezke(el, id);
    };

    void odswiez();
    const zegar = window.setInterval(() => void odswiez(), 120_000);

    return () => {
      aktualne = false;
      window.clearInterval(zegar);
    };
  }, [oznaczPinezke]);

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

  /* ---- pinezki i klastry ----
     Przy kilkunastu boiskach każde dostaje własną pinezkę HTML - tak jak dotąd.
     Powyżej CLUSTER_FROM wpisów tysiące elementów DOM zabiłyby przeglądarkę, więc punkty
     lecą jako warstwa GeoJSON z klastrowaniem, a ładne pinezki rysujemy tylko dla tego, co
     naprawdę widać na ekranie po przybliżeniu. Wygląd mapy przy dzisiejszej bazie się nie
     zmienia - mechanizm jest gotowy na import boisk z OpenStreetMap. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const clustered = courts.length >= CLUSTER_FROM;
    const byId = new Map(courts.map((c) => [c.id, c]));

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

    /* --- tryb prosty: wszystkie boiska jako pinezki --- */
    if (!clustered) {
      for (const id of ["boiska-liczby", "boiska-klastry", "boiska-punkty"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("boiska")) map.removeSource("boiska");

      pruneMarkers(new Set(courts.map((c) => c.id)));
      for (const court of courts) ensureMarker(court);
      for (const [id, { el }] of Object.entries(markersRef.current)) {
        el.dataset.active = String(id === activeId);
      }
      return;
    }

    /* --- tryb dużej bazy: klastry + pinezki tylko na widocznym fragmencie --- */
    const data = {
      type: "FeatureCollection" as const,
      features: courts.map((c) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
        properties: { id: c.id },
      })),
    };

    /**
     * Dorysowuje pinezki HTML dla punktów widocznych na ekranie po przybliżeniu.
     *
     * Widoczne boiska liczymy z tablicy w pamięci, a nie przez `queryRenderedFeatures`:
     * warstwa kropek jest w trybie pinezek przezroczysta, a przezroczystych elementów to
     * zapytanie nie zwraca - raz ukryte kropki nigdy by się nie odnalazły i pinezki
     * przestawałyby powstawać (sprawdzone na żywej mapie).
     */
    const syncPins = () => {
      if (!map.getLayer("boiska-punkty")) return;

      const pokazKropki = (widoczne: boolean) => {
        map.setPaintProperty("boiska-punkty", "circle-opacity", widoczne ? 1 : 0);
        map.setPaintProperty("boiska-punkty", "circle-stroke-opacity", widoczne ? 1 : 0);
      };

      /*
        WYDARZENIA SĄ WYJĄTKIEM OD OBU PROGÓW NIŻEJ i to jest cała ich sensowność.

        W trybie dużej bazy pinezki HTML pojawiają się dopiero od przybliżenia 11, a przy
        więcej niż 160 punktach w kadrze znikają z powrotem w kropki - i słusznie, bo
        tysiąc pinezek to plama. Ale pinezka wydarzenia ma być widoczna z pierwszego
        spojrzenia na mapę CAŁEJ POLSKI, zanim ktokolwiek zacznie przybliżać. Bez tego
        wyjątku biało-czerwona pochodnia pokazywała się dopiero temu, kto już wiedział,
        gdzie patrzeć - czyli nikomu.

        Kosztu nie ma: wydarzeń jest naraz kilka, nie kilkaset.
      */
      const zWydarzeniem = courts.filter((c) => wydarzeniaRef.current[c.id]);
      const idWydarzen = new Set(zWydarzeniem.map((c) => c.id));

      const tylkoWydarzenia = () => {
        pokazKropki(true);
        pruneMarkers(idWydarzen);
        for (const court of zWydarzeniem) {
          ensureMarker(court).el.dataset.active = String(court.id === activeId);
        }
      };

      if (map.getZoom() < PIN_ZOOM) {
        tylkoWydarzenia();
        return;
      }

      const bounds = map.getBounds();
      const widoczne = courts.filter((c) => bounds.contains([c.lng, c.lat]));

      // przy zbyt wielu punktach na ekranie zostawiamy kropki - pinezki byłyby kaszą
      if (widoczne.length > PIN_LIMIT) {
        tylkoWydarzenia();
        return;
      }

      pokazKropki(false);
      const wybrane = new Set([...widoczne.map((c) => c.id), ...idWydarzen]);
      pruneMarkers(wybrane);
      for (const court of widoczne) {
        ensureMarker(court).el.dataset.active = String(court.id === activeId);
      }
    };

    const attach = () => {
      const source = map.getSource("boiska");
      if (source) {
        (source as unknown as { setData: (d: typeof data) => void }).setData(data);
        syncPins();
        return;
      }

      map.addSource("boiska", {
        type: "geojson",
        data,
        cluster: true,
        clusterMaxZoom: PIN_ZOOM - 1,
        clusterRadius: 55,
      });

      map.addLayer({
        id: "boiska-klastry",
        type: "circle",
        source: "boiska",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": BARWY_MAPY.flame,
          "circle-opacity": 0.9,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 21, 50, 27, 200, 34],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(8,8,11,0.85)",
        },
      });

      map.addLayer({
        id: "boiska-liczby",
        type: "symbol",
        source: "boiska",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          /* w zestawie glifów nie ma odmiany Bold - Medium jest najgrubszą dostępną */
          "text-font": ["Noto Sans Medium"],
          "text-size": 13,
        },
        paint: { "text-color": "#12060a" },
      });

      // Pojedyncze punkty: widoczne, dopóki nie zastąpią ich pinezki HTML. Warstwa zostaje
      // w stylu z zerową przezroczystością, bo właśnie z niej odczytujemy, co jest na ekranie.
      map.addLayer({
        id: "boiska-punkty",
        type: "circle",
        source: "boiska",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": BARWY_MAPY.flame,
          "circle-stroke-width": 1.4,
          "circle-stroke-color": "rgba(8,8,11,0.9)",
        },
      });

      // klik w klaster przybliża do miejsca, w którym się rozsypuje
      map.on("click", "boiska-klastry", (e) => {
        const f = e.features?.[0];
        const clusterId = f?.properties?.cluster_id;
        if (clusterId == null || !f) return;
        const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        const src = map.getSource("boiska") as unknown as {
          getClusterExpansionZoom: (id: number) => Promise<number>;
        };
        void Promise.resolve(src.getClusterExpansionZoom(Number(clusterId)))
          .then((zoom) => map.easeTo({ center: [lng, lat], zoom, duration: 500 }))
          .catch(() => map.easeTo({ center: [lng, lat], zoom: map.getZoom() + 2 }));
      });
      map.on("mouseenter", "boiska-klastry", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "boiska-klastry", () => {
        map.getCanvas().style.cursor = "";
      });

      // pojedyncza kropka (gdy pinezek nie rysujemy) też ma prowadzić do boiska
      map.on("click", "boiska-punkty", (e) => {
        const id = String(e.features?.[0]?.properties?.id ?? "");
        const court = byId.get(id);
        if (court) onSelectCourt(court);
      });

      syncPins();
    };

    if (map.getLayer("carto")) attach();
    else map.once("styledata", attach);

    map.on("moveend", syncPins);
    map.on("idle", syncPins);
    return () => {
      map.off("moveend", syncPins);
      map.off("idle", syncPins);
    };
    /*
      `wydarzenia` w zależnościach: bez tego pinezka wydarzenia nie powstałaby wcale
      w trybie klastrowym. Wydarzenia dociągają się osobnym zapytaniem, już PO pierwszym
      rysowaniu pinezek - a przy niskim przybliżeniu nie ma wtedy żadnego znacznika, na
      którym można by tylko podmienić treść.
    */
  }, [courts, ready, activeId, onHoverCourt, onSelectCourt, reposition, centerPin, coarse, oznaczPinezke, schowajKarte, wydarzenia]);

  /* ---- podświetlenie aktywnej pinezki ---- */
  useEffect(() => {
    for (const [id, { el }] of Object.entries(markersRef.current)) {
      el.dataset.active = String(id === activeId);
    }
  }, [activeId, courts]);

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
      map.setPaintProperty("carto", "raster-brightness-max", jasny ? 1 : 0.94);
      map.setPaintProperty("carto", "raster-hue-rotate", jasny ? 0 : -12);
    }
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

    map.fitBounds(POLAND_BOUNDS, {
      padding: fitPadding(containerRef.current?.clientWidth ?? 1024),
      duration: 900,
      essential: true,
    });
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

  const resetView = () =>
    mapRef.current?.fitBounds(POLAND_BOUNDS, {
      padding: fitPadding(containerRef.current?.clientWidth ?? 1024),
      duration: 900,
    });

  return (
    <div className="map-shell absolute inset-0">
      {/* h-full/w-full, a nie absolute inset-0: maplibre-gl.css wymusza na tym divie
          position:relative, przez co inset-0 nie działa i kontener ma wysokość 0. */}
      <div ref={containerRef} className="h-full w-full" />

      {/*
        Zasłona na czas wczytywania podkładu - ten sam kontur boiska, który stoi, zanim
        dojedzie paczka z MapLibre (szkielet w `Explorer.tsx`), więc przejście między nimi
        jest niewidoczne. Przykrywa też pinezki: bez tego wisiałyby nad pustym tłem, zanim
        pojawi się pod nimi kraj. Panel z filtrami i przyciski zostają nad nią i działają.
      */}
      {!zaslonaZeszla && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[15] grid place-items-center bg-void transition-opacity duration-500 ease-out motion-reduce:duration-200 ${
            odslonieta ? "opacity-0" : ""
          }`}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && odslonieta) setZaslonaZeszla(true);
          }}
        >
          <div className="w-[min(560px,72vw)] opacity-25">
            <CourtOutline uid="mapa-zaslona" />
          </div>
        </div>
      )}

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
          const karta = (hover ?? znika) as { court: MapCourt; x: number; y: number };
          const stan = hover ? "wchodzi" : "znika";
          return coarse ? (
            // dotyk: wizytówka siedzi nad wysuwanym panelem, cała jest linkiem do boiska
            // 266 px zamiast 380 px: karta jest o ~30% mniejsza i nie zjada połowy ekranu
            <div
              ref={cardRef}
              className="pointer-events-auto fixed inset-x-3 bottom-[158px] z-[35] mx-auto max-w-[266px]"
            >
              <Link href={`/boisko/${karta.court.slug}`} className="block">
                <HoverCard court={karta.court} wydarzenie={wydarzenia[karta.court.id]} tapHint stan={stan} />
              </Link>
            </div>
          ) : (
            <div
              className="pointer-events-none absolute z-20"
              style={{ left: karta.x, top: karta.y - 58, transform: "translate(-50%,-100%)" }}
            >
              <HoverCard court={karta.court} wydarzenie={wydarzenia[karta.court.id]} stan={stan} />
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

      <div className="absolute bottom-[168px] right-4 z-20 flex flex-col gap-2 lg:bottom-8 lg:right-6">
        <button
          onClick={() => zoomBy(1)}
          className="glass grid h-11 w-11 place-items-center rounded-2xl text-xl text-ink/80 transition hover:text-ink active:scale-95"
          aria-label="Przybliż"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(-1)}
          className="glass grid h-11 w-11 place-items-center rounded-2xl text-xl text-ink/80 transition hover:text-ink active:scale-95"
          aria-label="Oddal"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="glass grid h-11 w-11 place-items-center rounded-2xl text-ink/70 transition hover:text-ink active:scale-95"
          aria-label="Cała Polska"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
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
 * Kolor jest inny z rozmysłem: pomarańcz to boiska w bazie, fiolet to wyróżnienie Heat,
 * a błękit nie znaczy na tej mapie nic innego - więc od razu widać, że to coś osobnego,
 * i nikt nie pomyśli, że w Kalifornii dodano boisko do polskiej bazy.
 */
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
      style="--cien:29 95 208;filter:drop-shadow(0 6px 14px rgb(0 0 0 / calc(.6 * var(--moc-cienia, 1))))">

    ${wizytowkaGryHtml(g, gra)}

    <span class="pulse-glow absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
      style="width:${size * 1.8}px;height:${size * 1.8}px;pointer-events:none;
      background:radial-gradient(circle,rgba(86,172,255,.55) 0%,rgba(24,92,190,.18) 45%,transparent 70%)"></span>

    <span class="marker-core relative grid place-items-center rounded-full transition-all duration-200"
      style="width:${size}px;height:${size}px;
      background:linear-gradient(135deg,#d7ecff,#56acff 55%,#1d5fd0);
      box-shadow:0 0 0 1.5px rgba(255,255,255,.28) inset, 0 6px 18px -4px rgba(20,80,180,.9)">
      <svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px" fill="none"
        stroke="rgba(10,30,70,.72)" stroke-width=".97" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
    </span>

    <span style="width:2px;height:10px;background:linear-gradient(180deg,#56acff,transparent)"></span>
    <span style="width:7px;height:3px;border-radius:99px;background:rgba(86,172,255,.85)"></span>
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

  // Boiska z wyróżnieniem Heat świecą na fioletowo - mają odróżniać się na pierwszy rzut oka.
  const glow = wydarzenie
    ? "rgba(255,255,255,.62) 0%, rgba(232,17,45,.4) 42%, transparent 72%"
    : court.basketApproved
      ? "rgba(168,85,247,.6) 0%, rgba(109,40,217,.2) 45%, transparent 70%"
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
      ? "linear-gradient(135deg,#e9d5ff,#a855f7 55%,#6d28d9)"
      : "linear-gradient(135deg,var(--color-glow-soft),var(--color-flame) 55%,var(--color-ember))";
  /* łuna pod kulą słabnie w motywach jasnych - na bieli 90% barwy to plama, nie światło */
  const shadow = wydarzenie
    ? "rgb(232 17 45 / calc(.95 * var(--moc-poswiaty, 1)))"
    : court.basketApproved
      ? "rgb(109 40 217 / calc(.9 * var(--moc-poswiaty, 1)))"
      : "rgb(var(--rgb-ember) / calc(.9 * var(--moc-poswiaty, 1)))";
  const seam = wydarzenie
    ? "rgba(150,8,24,.55)"
    : court.basketApproved
      ? "rgba(35,5,60,.7)"
      : "rgba(40,10,0,.72)";
  const stem = wydarzenie ? "#e8112d" : court.basketApproved ? "#a855f7" : "var(--color-flame)";
  const dot = wydarzenie
    ? "rgba(232,17,45,.9)"
    : court.basketApproved
      ? "rgba(168,85,247,.85)"
      : "rgb(var(--rgb-flame) / .85)";

  /*
    Paleta ognia idzie za kolorem pinezki, nie odwrotnie: pomarańczowa pinezka pali się
    pomarańczowo, fioletowa pinezka Heatu - fioletowo. Płomień w obcym kolorze wyglądał
    jak nalepka doklejona za kulą; w kolorze pinezki jest jej przedłużeniem.

    Barwy jako trójki liczb, a nie gotowe kolory, bo w gradientach potrzebny jest ten sam
    odcień z zerową przezroczystością - `rgb(var(--o3) / 0)`. Wygaszanie do `transparent`
    idzie w sRGB przez czerń i zostawiało na końcu języka szary muł.
  */
  const ogien = wydarzenie
    ? { o1: "255 255 255", o2: "255 210 214", o3: "232 17 45", o4: "138 6 20" }
    : court.basketApproved
    ? { o1: "245 235 255", o2: "192 132 252", o3: "139 92 246", o4: "91 33 182" }
    : {
        o1: "var(--rgb-glow-soft)",
        o2: "var(--rgb-glow)",
        o3: "var(--rgb-flame)",
        o4: "var(--rgb-ember-deep)",
      };

  /*
    Kolor poświaty pod kulą przy najechaniu i na pinezce aktywnej. Wcześniej ten cień był
    wpisany na sztywno w arkuszu, na pomarańczowo i z `!important` - fioletowa pinezka
    Heatu dostawała więc pod spodem pomarańczową łunę i wyglądała, jakby ktoś pomylił
    warstwy. Podajemy trójkę RGB, bo arkusz składa z niej kolor z własną przezroczystością.
  */
  const cien = wydarzenie ? "232 17 45" : court.basketApproved ? "139 92 246" : "var(--rgb-ember)";

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
       style="filter: drop-shadow(0 6px 14px rgb(0 0 0 / calc(.6 * var(--moc-cienia, 1))));--kula:${size}px;--cien:${cien};--o1:${ogien.o1};--o2:${ogien.o2};--o3:${ogien.o3};--o4:${ogien.o4}">
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
          style="width:${size}px;height:${size}px;background:${core};box-shadow:0 0 0 1.5px rgba(255,255,255,.28) inset, 0 6px 18px -4px ${shadow}">
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
      <svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px" fill="none" stroke="${seam}" stroke-width=".97" stroke-linecap="round">
        <path d="${szwyPilki(12, 12, 12)}"/>
      </svg>
    </span>
    <span style="width:2px;height:10px;background:linear-gradient(180deg,${stem},transparent)"></span>
    <span style="width:7px;height:3px;border-radius:99px;background:${dot}"></span>
  </div>`;
}
