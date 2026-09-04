"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Map as MlMap, Marker, StyleSpecification, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapCourt } from "@/lib/types";
import { CITIES_GEOJSON } from "@/lib/cities";
import type { LeadPoint } from "@/lib/leads";
import { HoverCard } from "./HoverCard";
import { podkladMapy } from "@/lib/podklad";
import { ZarWojewodztwa, bboxWojewodztwa, stworzZarWojewodztwa } from "@/lib/zarWojewodztwa";
import { useMotyw } from "@/lib/motyw";
import { FiltrSzkla } from "./FiltrSzkla";
import { czytajWidok, zapiszWidok } from "@/lib/adres";
import { fetchCheckinyDzisiaj } from "@/lib/checkins";
import { MIEJSCA_GRY } from "@/lib/minigra";

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
const BARWY_MAPY = { flame: "#ff7a18", glow: "#ffb25c" };

/** Warstwy mapy, które biorą barwę z motywu: identyfikator i malowana właściwość. */
const WARSTWY_MOTYWU: [string, "fill-color" | "line-color" | "circle-color", keyof typeof BARWY_MAPY][] = [
  ["woj-fill", "fill-color", "flame"],
  ["woj-active", "fill-color", "flame"],
  ["woj-line", "line-color", "glow"],
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
 * Zapas na panel: na komputerze stoi po lewej, na telefonie wysuwa się od dołu,
 * więc kadr Polski musi omijać raz bok, a raz dolną krawędź.
 */
const fitPadding = (width: number) =>
  width < 768
    ? { top: 90, bottom: 200, left: 24, right: 24 }
    : { top: 70, bottom: 70, left: 430, right: 70 };

/** Od tylu boisk mapa przechodzi z pinezek HTML na warstwę GeoJSON z klastrami. */
const CLUSTER_FROM = 300;
/** Od tego przybliżenia zamiast kropek rysujemy pełne pinezki. */
const PIN_ZOOM = 11;
/** Górny limit pinezek HTML naraz - powyżej i tak zlewałyby się w plamę. */
const PIN_LIMIT = 160;
/** Ile trwa gaśnięcie wizytówki - musi być zgodne z `.karta-mapy-znika` w globals.css. */
const CZAS_ZNIKANIA = 180;
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

    // Widok zapisany w adresie (m=lat,lng,zoom) ma pierwszeństwo nad kadrem na Polskę:
    // dzięki temu link do konkretnego miejsca otwiera się tam, gdzie był wysłany.
    const zAdresu = czytajWidok();

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
      el.title = `${g.nazwa}, ${g.miasto}`;
      el.setAttribute("aria-label", `Minigra: ${g.nazwa}`);
      el.innerHTML = markerGryHtml();
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

    // po każdym przesunięciu zapisujemy kadr w adresie - widok da się wysłać linkiem
    // i przetrwa odświeżenie strony
    const zapiszKadr = () => {
      const c = map.getCenter();
      zapiszWidok({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on("moveend", zapiszKadr);

    if (typeof window !== "undefined") {
      (window as unknown as { __mapDiag: MapDiag }).__mapDiag = diag;
      // uchwyt do mapy przydatny przy diagnostyce w konsoli - tylko w dev
      if (process.env.NODE_ENV !== "production")
        (window as unknown as { __map: MlMap }).__map = map;
    }

    return () => {
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

  const oznaczPinezke = useCallback((el: HTMLElement, id: string) => {
    const osoby = checkinyRef.current[id] ?? 0;
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
      el.innerHTML = markerHtml(court);
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

      if (map.getZoom() < PIN_ZOOM) {
        pokazKropki(true);
        pruneMarkers(new Set());
        return;
      }

      const bounds = map.getBounds();
      const widoczne = courts.filter((c) => bounds.contains([c.lng, c.lat]));

      // przy zbyt wielu punktach na ekranie zostawiamy kropki - pinezki byłyby kaszą
      if (widoczne.length > PIN_LIMIT) {
        pokazKropki(true);
        pruneMarkers(new Set());
        return;
      }

      pokazKropki(false);
      const wybrane = new Set(widoczne.map((c) => c.id));
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
  }, [courts, ready, activeId, onHoverCourt, onSelectCourt, reposition, centerPin, coarse, oznaczPinezke, schowajKarte]);

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
    };

    for (const [warstwa, wlasciwosc, barwa] of WARSTWY_MOTYWU) {
      if (map.getLayer(warstwa)) map.setPaintProperty(warstwa, wlasciwosc, barwy[barwa]);
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
                <HoverCard court={karta.court} tapHint stan={stan} />
              </Link>
            </div>
          ) : (
            <div
              className="pointer-events-none absolute z-20"
              style={{ left: karta.x, top: karta.y - 58, transform: "translate(-50%,-100%)" }}
            >
              <HoverCard court={karta.court} stan={stan} />
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

      <div className="absolute bottom-[168px] right-4 z-20 flex flex-col gap-2 md:bottom-8 md:right-6">
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
function markerGryHtml() {
  const size = 38;

  return `<span style="position:relative;display:block;width:${size}px;height:${size + 10}px">
    <span style="position:absolute;left:50%;top:50%;width:${size * 2.1}px;height:${size * 2.1}px;
      translate:-50% -52%;border-radius:999px;pointer-events:none;
      background:radial-gradient(circle,rgba(86,172,255,.55) 0%,rgba(24,92,190,.18) 45%,transparent 70%)"></span>

    <span style="position:absolute;inset:0;border-radius:999px;
      background:linear-gradient(135deg,#d7ecff,#56acff 55%,#1d5fd0);
      box-shadow:0 6px 14px -6px rgba(20,80,180,.9), inset 0 1px 0 rgba(255,255,255,.55)">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
        stroke="rgba(10,30,70,.72)" stroke-width=".95" stroke-linecap="round">
        <circle cx="12" cy="12" r="7.2"/>
        <path d="M4.8 12h14.4M12 4.8v14.4"/>
        <path d="M7 6.4c2.6 3.2 2.6 8 0 11.2M17 6.4c-2.6 3.2-2.6 8 0 11.2"/>
      </svg>
    </span>

    <span style="position:absolute;left:50%;bottom:0;width:3px;height:11px;translate:-50% 0;
      border-radius:2px;background:#56acff"></span>
    <span style="position:absolute;left:50%;bottom:-3px;width:7px;height:4px;translate:-50% 0;
      border-radius:999px;background:rgba(0,0,0,.45);filter:blur(1px)"></span>
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

function markerHtml(court: MapCourt) {
  const big = court.likes >= 200;
  const size = big ? 46 : 38;

  // Boiska z wyróżnieniem Heat świecą na fioletowo - mają odróżniać się na pierwszy rzut oka.
  const glow = court.basketApproved
    ? "rgba(168,85,247,.6) 0%, rgba(109,40,217,.2) 45%, transparent 70%"
    : "rgb(var(--rgb-flame) / .55) 0%, rgb(var(--rgb-ember) / .18) 45%, transparent 70%";
  const core = court.basketApproved
    ? "linear-gradient(135deg,#e9d5ff,#a855f7 55%,#6d28d9)"
    : "linear-gradient(135deg,var(--color-glow-soft),var(--color-flame) 55%,var(--color-ember))";
  const shadow = court.basketApproved ? "rgba(109,40,217,.9)" : "rgb(var(--rgb-ember) / .9)";
  const seam = court.basketApproved ? "rgba(35,5,60,.7)" : "rgba(40,10,0,.72)";
  const stem = court.basketApproved ? "#a855f7" : "var(--color-flame)";
  const dot = court.basketApproved ? "rgba(168,85,247,.85)" : "rgb(var(--rgb-flame) / .85)";

  /*
    Paleta ognia idzie za kolorem pinezki, nie odwrotnie: pomarańczowa pinezka pali się
    pomarańczowo, fioletowa pinezka Heatu - fioletowo. Płomień w obcym kolorze wyglądał
    jak nalepka doklejona za kulą; w kolorze pinezki jest jej przedłużeniem.

    Barwy jako trójki liczb, a nie gotowe kolory, bo w gradientach potrzebny jest ten sam
    odcień z zerową przezroczystością - `rgb(var(--o3) / 0)`. Wygaszanie do `transparent`
    idzie w sRGB przez czerń i zostawiało na końcu języka szary muł.
  */
  const ogien = court.basketApproved
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
  const cien = court.basketApproved ? "139 92 246" : "var(--rgb-ember)";

  return `
  <div class="pinezka-korpus relative flex flex-col items-center transition-transform duration-200 ease-out"
       style="filter: drop-shadow(0 6px 14px rgba(0,0,0,.6));--kula:${size}px;--cien:${cien};--o1:${ogien.o1};--o2:${ogien.o2};--o3:${ogien.o3};--o4:${ogien.o4}">
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
      <svg viewBox="0 0 24 24" style="width:${size * 0.62}px;height:${size * 0.62}px" fill="none" stroke="${seam}" stroke-width=".95" stroke-linecap="round">
        <circle cx="12" cy="12" r="9.2"/><path d="M12 2.8v18.4M2.8 12h18.4"/>
        <path d="M5.4 5.4c3.9 3.9 3.9 9.3 0 13.2M18.6 5.4c-3.9 3.9-3.9 9.3 0 13.2"/>
      </svg>
    </span>
    <span style="width:2px;height:10px;background:linear-gradient(180deg,${stem},transparent)"></span>
    <span style="width:7px;height:3px;border-radius:99px;background:${dot}"></span>
  </div>`;
}
