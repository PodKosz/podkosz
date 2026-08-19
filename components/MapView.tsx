"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Map as MlMap, Marker, StyleSpecification, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapCourt } from "@/lib/types";
import { CITIES_GEOJSON } from "@/lib/cities";
import type { LeadPoint } from "@/lib/leads";
import { HoverCard } from "./HoverCard";
import { czytajWidok, zapiszWidok } from "@/lib/adres";

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

// Worker MapLibre serwujemy z /public - patrz scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE: StyleSpecification = {
  version: 8,
  // fonts.openmaptiles.org oddaje HTML zamiast pliku .pbf - Protomaps serwuje poprawne glify
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      // bez podpisów - kafelki CARTO mają nazwy po angielsku, dokładamy własne
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
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
      paint: { "fill-color": "#ff7a18", "fill-opacity": 0.06 },
    },
    {
      id: "woj-active",
      type: "fill",
      source: "woj",
      filter: ["==", ["get", "nazwa"], "__none__"],
      paint: { "fill-color": "#ff7a18", "fill-opacity": 0.16 },
    },
    {
      id: "woj-line",
      type: "line",
      source: "woj",
      paint: {
        "line-color": "#ff9a45",
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
  focusId,
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
  focusId: string | null;
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
  const [hover, setHover] = useState<{ court: MapCourt; x: number; y: number } | null>(null);
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
  /** znacznik czasu dotknięcia pinezki - chroni wizytówkę przed klikiem mapy z tego samego dotknięcia */
  const lastPinTapRef = useRef(0);
  /** wizytówka na dotyku - z jej położenia liczymy, gdzie ma wylądować pinezka */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onSelectLeadRef = useRef(onSelectLead);
  useEffect(() => {
    onSelectLeadRef.current = onSelectLead;
  }, [onSelectLead]);

  const clearCard = useCallback(() => {
    hoverRef.current = null;
    setHover(null);
    onHoverCourt(null);
  }, [onHoverCourt]);

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
    setHover({ court: c, x: p.x, y: p.y });
  }, []);

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
    map.on("click", () => {
      if (performance.now() - lastPinTapRef.current < 500) return;
      clearCardRef.current();
    });
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
        map.fitBounds(POLAND_BOUNDS, { padding: fitPadding(width), duration: 0 });
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
          setHover(null);
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
          "circle-color": "#ff7a18",
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
          "text-font": ["Noto Sans Bold"],
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
          "circle-color": "#ff7a18",
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
  }, [courts, ready, activeId, onHoverCourt, onSelectCourt, reposition, centerPin, coarse]);

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

  /* ---- podświetlenie województwa ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("woj-active", [
      "==",
      ["get", "nazwa"],
      highlightVoivodeship || "__none__",
    ]);
  }, [highlightVoivodeship, ready]);

  /* ---- lot do wybranego boiska ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusId) return;
    const court = courts.find((c) => c.id === focusId);
    if (!court) return;
    map.flyTo({
      center: [court.lng, court.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      offset: (containerRef.current?.clientWidth ?? 1024) < 768 ? [0, -70] : [180, 0],
      speed: 1.1,
      curve: 1.5,
    });
  }, [focusId, courts, ready]);

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

      {hover &&
        !sheetOpen &&
        (coarse ? (
          // dotyk: wizytówka siedzi nad wysuwanym panelem, cała jest linkiem do boiska
          // 266 px zamiast 380 px: karta jest o ~30% mniejsza i nie zjada połowy ekranu
          <div
            ref={cardRef}
            className="pointer-events-auto fixed inset-x-3 bottom-[158px] z-[35] mx-auto max-w-[266px] rise"
          >
            <Link href={`/boisko/${hover.court.slug}`} className="block">
              <HoverCard court={hover.court} tapHint />
            </Link>
          </div>
        ) : (
          <div
            className="pointer-events-none absolute z-20"
            style={{ left: hover.x, top: hover.y - 58, transform: "translate(-50%,-100%)" }}
          >
            <HoverCard court={hover.court} />
          </div>
        ))}

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

function markerHtml(court: MapCourt) {
  const big = court.likes >= 200;
  const size = big ? 46 : 38;
  // Boiska z wyróżnieniem Heat świecą na fioletowo - mają odróżniać się na pierwszy rzut oka.
  const glow = court.basketApproved
    ? "rgba(168,85,247,.6) 0%, rgba(109,40,217,.2) 45%, transparent 70%"
    : "rgba(255,122,24,.55) 0%, rgba(255,77,10,.18) 45%, transparent 70%";
  const core = court.basketApproved
    ? "linear-gradient(135deg,#e9d5ff,#a855f7 55%,#6d28d9)"
    : "linear-gradient(135deg,#ffc27a,#ff7a18 55%,#ff4106)";
  const shadow = court.basketApproved ? "rgba(109,40,217,.9)" : "rgba(255,77,10,.9)";
  const seam = court.basketApproved ? "rgba(35,5,60,.75)" : "rgba(40,10,0,.8)";
  const stem = court.basketApproved ? "#a855f7" : "#ff7a18";
  const dot = court.basketApproved ? "rgba(168,85,247,.85)" : "rgba(255,122,24,.85)";

  return `
  <div class="relative flex flex-col items-center transition-transform duration-200 ease-out"
       style="filter: drop-shadow(0 6px 14px rgba(0,0,0,.6))">
    <span class="pulse-glow absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
          style="width:${size * 1.8}px;height:${size * 1.8}px;background:radial-gradient(circle, ${glow})"></span>
    <span class="marker-core relative grid place-items-center rounded-full transition-all duration-200"
          style="width:${size}px;height:${size}px;background:${core};box-shadow:0 0 0 1.5px rgba(255,255,255,.28) inset, 0 6px 18px -4px ${shadow}">
      <svg viewBox="0 0 24 24" style="width:${size * 0.62}px;height:${size * 0.62}px" fill="none" stroke="${seam}" stroke-width="1.5">
        <circle cx="12" cy="12" r="9.2"/><path d="M12 2.8v18.4M2.8 12h18.4"/>
        <path d="M5.4 5.4c3.9 3.9 3.9 9.3 0 13.2M18.6 5.4c-3.9 3.9-3.9 9.3 0 13.2"/>
      </svg>
    </span>
    <span style="width:2px;height:10px;background:linear-gradient(180deg,${stem},transparent)"></span>
    <span style="width:7px;height:3px;border-radius:99px;background:${dot}"></span>
  </div>`;
}
