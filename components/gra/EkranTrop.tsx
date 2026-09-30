"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Map as MlMap, Marker, type StyleSpecification, setWorkerUrl, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TROP, type MiejsceGry } from "@/lib/minigra";
import { photoUrl } from "@/lib/supabase/config";
import { adresMiniatury } from "@/lib/obrazy";
import { useSesja } from "@/lib/sesja";
import { slugifyPlace } from "@/lib/site";
import {
  nastepnaRunda,
  opisOdleglosci,
  rankingTropu,
  startTropu,
  wiecejZdjec,
  zgadnij,
  type RundaTropu,
  type WpisTropu,
  type WynikRundy,
  type ZdjecieTropu,
} from "@/lib/gra/trop";
import { ArrowLeftIcon } from "@/components/icons";
import { PrzyciskLogowania } from "@/components/PrzyciskLogowania";
import { CourtOutline } from "@/components/CourtOutline";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/**
 * Minigra Trop - zgadywanie, gdzie stoi boisko (jak GeoGuessr, tylko na boiskach z PodKosza).
 *
 * Pięć rund. W każdej jedno zdjęcie boiska i minimapa w prawym dolnym rogu, na której stawia
 * się pinezkę. Kto zgadnie po JEDNYM zdjęciu, dostaje +10% - reszta zdjęć jest pod przyciskiem,
 * który ten bonus zabiera. Punkty, czas i bonus liczy baza (patrz `lib/gra/trop.ts`), tu jest
 * tylko to, co się widzi.
 *
 * Mapa jest JEDNA na całą grę. W rundzie siedzi w rogu (średnia albo duża), po strzale
 * rozkłada się na cały ekran i pokazuje strzał, boisko i linię między nimi. Jedna instancja,
 * bo przełączanie dwóch map to dwa razy ładowane kafelki i skok kadru przy każdej rundzie.
 */

const BLEKIT = "#56acff";
const ZLOTO = { jasne: "#ffe9a8", srodek: "#f0b53c", ciemne: "#8a6410" };
const POLSKA: [number, number, number, number] = [13.9, 48.9, 24.3, 55.0];

/*
  Podkład WEKTOROWY, nie z gotowych obrazków jak na mapie głównej. W ciemnym stylu CARTO ulice
  są ledwie jaśniejsze od tła, a rozjaśnienie obrazka rozjaśniało razem z nimi wodę i tło - do
  zgadywania trzeba widzieć drogi i nazwy, więc tu rysujemy je sami: ulice białą kreską
  z grubością według rangi drogi, miasta tłustym pismem z obwódką, nazwy po polsku.
  Kafelki OpenFreeMap (OpenMapTiles, bez klucza), pismo z naszych glifów (`public/mapa/fonts`).
*/
const NAZWA = ["coalesce", ["get", "name:pl"], ["get", "name:latin"], ["get", "name"]];
const klasa = (lista: string[]) => ["match", ["get", "class"], lista, true, false];
const STYL = {
  version: 8,
  glyphs: "/mapa/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
    linia: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  },
  layers: [
    { id: "tlo", type: "background", paint: { "background-color": "#0d0c0f" } },
    { id: "zabudowa", type: "fill", source: "omt", "source-layer": "landuse", filter: klasa(["residential", "suburb", "neighbourhood"]), paint: { "fill-color": "#16151a" } },
    { id: "zielen", type: "fill", source: "omt", "source-layer": "landcover", filter: klasa(["wood", "grass", "forest"]), paint: { "fill-color": "#0f1511", "fill-opacity": 0.8 } },
    { id: "woda", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#0c1a28" } },
    { id: "rzeki", type: "line", source: "omt", "source-layer": "waterway", minzoom: 8, paint: { "line-color": "#15314d", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 2.5] } },
    { id: "budynki", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": "#1f1e24" } },
    {
      id: "granice-wojewodztw", type: "line", source: "omt", "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 4],
      paint: { "line-color": "#6c6576", "line-width": 0.9, "line-dasharray": [3, 2] },
    },
    {
      id: "granice-panstw", type: "line", source: "omt", "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": "#b9b4c2", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 10, 2] },
    },
    {
      id: "kolej", type: "line", source: "omt", "source-layer": "transportation", minzoom: 10,
      filter: klasa(["rail"]),
      paint: { "line-color": "#8d8a96", "line-width": 1, "line-dasharray": [2, 2] },
    },
    {
      id: "drogi-drobne", type: "line", source: "omt", "source-layer": "transportation", minzoom: 11,
      filter: klasa(["minor", "service", "track"]),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.35, 14, 0.8],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 11, 0.5, 14, 1.6, 17, 6, 19, 14],
      },
    },
    {
      id: "drogi-srednie", type: "line", source: "omt", "source-layer": "transportation", minzoom: 7,
      filter: klasa(["secondary", "tertiary"]),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.45, 11, 0.95],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 7, 0.5, 11, 1.4, 14, 3, 17, 9, 19, 18],
      },
    },
    {
      id: "drogi-glowne", type: "line", source: "omt", "source-layer": "transportation", minzoom: 4,
      filter: klasa(["motorway", "trunk", "primary"]),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 8, 1],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 4, 0.5, 8, 1.2, 12, 2.6, 15, 6, 18, 16],
      },
    },
    {
      id: "nazwy-ulic", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14,
      layout: { "symbol-placement": "line", "text-field": NAZWA, "text-font": ["Noto Sans Regular"], "text-size": 11.5 },
      paint: { "text-color": "#f1eff4", "text-halo-color": "#0d0c0f", "text-halo-width": 1.6 },
    },
    {
      id: "wsie", type: "symbol", source: "omt", "source-layer": "place", minzoom: 10,
      filter: klasa(["village", "hamlet", "suburb", "neighbourhood", "quarter"]),
      layout: { "text-field": NAZWA, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 14, 14] },
      paint: { "text-color": "#e6e3ea", "text-halo-color": "#0d0c0f", "text-halo-width": 1.8 },
    },
    {
      id: "miasteczka", type: "symbol", source: "omt", "source-layer": "place", minzoom: 7,
      filter: klasa(["town"]),
      layout: { "text-field": NAZWA, "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11.5, 11, 15, 14, 18] },
      paint: { "text-color": "#f6f4f8", "text-halo-color": "#0d0c0f", "text-halo-width": 2 },
    },
    {
      id: "miasta", type: "symbol", source: "omt", "source-layer": "place", minzoom: 4,
      filter: klasa(["city"]),
      layout: {
        "text-field": NAZWA, "text-font": ["Noto Sans Medium"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12, 7, 15, 11, 21, 14, 24],
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "#0d0c0f", "text-halo-width": 2.4 },
    },
    {
      id: "kraje", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 7,
      /* bez napisu „Polska" - gra i tak dzieje się w Polsce, a napis wypierał z mapy Warszawę */
      filter: ["all", klasa(["country"]), ["!=", ["get", "name"], "Polska"]],
      layout: { "text-field": NAZWA, "text-font": ["Noto Sans Medium"], "text-size": 13, "text-transform": "uppercase", "text-letter-spacing": 0.25 },
      paint: { "text-color": "#a9a4b3", "text-halo-color": "#0d0c0f", "text-halo-width": 1.5 },
    },
    {
      id: "linia", type: "line", source: "linia", layout: { "line-cap": "round" },
      paint: { "line-color": "#ffb25c", "line-width": 3, "line-dasharray": [1.2, 1.6] },
    },
  ],
} as unknown as StyleSpecification;

type Faza = "tytul" | "ladowanie" | "runda" | "wynik" | "koniec";
/** minimapa: 0 - średnia w rogu, 1 - duża, prawie na cały ekran */
type Rozmiar = 0 | 1;

interface Zapis extends WynikRundy {
  strzal: { lat: number; lng: number } | null;
}

/* ---------------------------------------------------------------- znaczniki mapy */
function elementStrzalu() {
  const el = document.createElement("div");
  el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 6px 12px rgba(0,0,0,.55))">
    <div style="width:26px;height:26px;border-radius:99px;background:linear-gradient(135deg,#d7ecff,${BLEKIT} 55%,#1d5fd0);box-shadow:0 0 0 3px rgba(255,255,255,.9)"></div>
    <div style="width:2px;height:9px;background:#fff"></div></div>`;
  return el;
}
function elementBoiska() {
  const el = document.createElement("div");
  el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 8px 16px rgba(0,0,0,.6))">
    <div style="width:34px;height:34px;border-radius:99px;display:grid;place-items:center;background:linear-gradient(135deg,#fff3d1,#ff8420 50%,#e12a00);box-shadow:0 0 0 3px rgba(255,255,255,.95),0 0 30px 6px rgba(255,110,20,.55)">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(40,10,0,.8)" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.6 3.6 3.6 9.2 0 12.8M18.4 5.6c-3.6 3.6-3.6 9.2 0 12.8"/></svg>
    </div><div style="width:2px;height:10px;background:#fff"></div></div>`;
  return el;
}

/* ---------------------------------------------------------------- liczba, która dobiega */
function useDobieg(cel: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const od = performance.now();
    const krok = (t: number) => {
      const p = Math.min(1, (t - od) / ms);
      setV(Math.round(cel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(krok);
    };
    raf = requestAnimationFrame(krok);
    return () => cancelAnimationFrame(raf);
  }, [cel, ms]);
  return v;
}

const liczba = (n: number) => n.toLocaleString("pl-PL");
const zegarTekst = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

/* ================================================================ ekran */
export function EkranTrop({ miejsce, ranking }: { miejsce: MiejsceGry; ranking: WpisTropu[] }) {
  const [faza, setFaza] = useState<Faza>("tytul");
  const [blad, setBlad] = useState<string | null>(null);
  const [runda, setRunda] = useState<RundaTropu | null>(null);
  const [zdjecia, setZdjecia] = useState<ZdjecieTropu[]>([]);
  const [ktore, setKtore] = useState(0);
  const [odkryte, setOdkryte] = useState(false);
  const [punkt, setPunkt] = useState<{ lat: number; lng: number } | null>(null);
  const [rozmiar, setRozmiar] = useState<Rozmiar>(0);
  /* duża mapa przypięta przyciskiem - nie zwija się po zjechaniu kursorem */
  const [przypieta, setPrzypieta] = useState(false);
  const zwin = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zostalo, setZostalo] = useState<number>(TROP.sekund);
  const [wysylam, setWysylam] = useState(false);
  const [historia, setHistoria] = useState<Zapis[]>([]);
  const [lista, setLista] = useState(ranking);

  const sesja = useSesja();
  const zalogowany = Boolean(sesja?.user);
  const mojNick = sesja?.user?.name ?? null;

  const mapaEl = useRef<HTMLDivElement>(null);
  const mapa = useRef<MlMap | null>(null);
  const strzal = useRef<Marker | null>(null);
  const boisko = useRef<Marker | null>(null);
  /* znaczniki wszystkich rund - tylko na mapie pod podsumowaniem */
  const wszystkie = useRef<Marker[]>([]);
  const fazaRef = useRef(faza);
  const punktRef = useRef(punkt);
  const koniecRundy = useRef(0);
  useEffect(() => { fazaRef.current = faza; }, [faza]);
  useEffect(() => { punktRef.current = punkt; }, [punkt]);

  const ostatni = historia[historia.length - 1] ?? null;
  const suma = ostatni?.suma ?? 0;

  /* ------------------------------------------------ mapa: jedna na całą grę */
  const zbudujMape = useCallback(() => {
    if (mapa.current || !mapaEl.current) return;
    const m = new MlMap({
      container: mapaEl.current,
      style: STYL,
      bounds: POLSKA,
      fitBoundsOptions: { padding: 12 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on("click", (e) => {
      if (fazaRef.current !== "runda") return;
      const p = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPunkt(p);
      if (!strzal.current) strzal.current = new Marker({ element: elementStrzalu(), anchor: "bottom" });
      strzal.current.setLngLat([p.lng, p.lat]).addTo(m);
    });
    /* rozmiar kontenera zmienia się przejściem CSS - mapa musi przeliczyć się razem z nim */
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(mapaEl.current);
    m.once("remove", () => ro.disconnect());
    mapa.current = m;
  }, []);

  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);

  const wyczyscMape = useCallback(() => {
    const m = mapa.current;
    strzal.current?.remove();
    boisko.current?.remove();
    boisko.current = null;
    wszystkie.current.forEach((z) => z.remove());
    wszystkie.current = [];
    if (!m) return;
    const zr = m.getSource("linia") as { setData?: (d: unknown) => void } | undefined;
    zr?.setData?.({ type: "FeatureCollection", features: [] });
    m.fitBounds(POLSKA, { padding: 12, duration: 0 });
  }, []);

  /* ------------------------------------------------ przebieg gry */
  const wejdzWRunde = useCallback((r: RundaTropu) => {
    setRunda(r);
    setZdjecia(r.zdjecie ? [r.zdjecie] : []);
    setKtore(0);
    setOdkryte(false);
    setPunkt(null);
    /* każda runda zaczyna się od średniej mapy - duża zasłaniałaby nowe zdjęcie */
    setRozmiar(0);
    setPrzypieta(false);
    setZostalo(TROP.sekund);
    koniecRundy.current = performance.now() + TROP.sekund * 1000;
    /* kadr całej Polski dopiero po zwinięciu mapy do średniej - ustawiony wcześniej, w dużym
       kontenerze, zostawał po zmniejszeniu jako przybliżony środek kraju */
    setTimeout(() => {
      const m = mapa.current;
      if (!m) return;
      m.resize();
      m.fitBounds(POLSKA, { padding: 12, duration: 0 });
    }, 380);
    setFaza("runda");
  }, []);

  const graj = useCallback(async () => {
    setBlad(null);
    setFaza("ladowanie");
    setHistoria([]);
    try {
      const r = await startTropu();
      zbudujMape();
      wyczyscMape();
      wejdzWRunde(r);
    } catch (e) {
      setBlad((e as Error).message);
      setFaza("tytul");
    }
  }, [wejdzWRunde, zbudujMape, wyczyscMape]);

  const pokazWynik = useCallback((w: WynikRundy, p: { lat: number; lng: number } | null) => {
    setHistoria((h) => [...h, { ...w, strzal: p }]);
    /* także po ostatniej rundzie najpierw jej wynik na mapie - podsumowanie dopiero „dalej" */
    setFaza("wynik");
    const m = mapa.current;
    if (!m) return;
    boisko.current = new Marker({ element: elementBoiska(), anchor: "bottom" })
      .setLngLat([w.boisko.lng, w.boisko.lat])
      .addTo(m);
    const zr = m.getSource("linia") as { setData?: (d: unknown) => void } | undefined;
    if (p) {
      zr?.setData?.({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[p.lng, p.lat], [w.boisko.lng, w.boisko.lat]] } }],
      });
    }
    /* kadr po rozłożeniu mapy na cały ekran - czekamy klatkę, aż kontener urośnie */
    setTimeout(() => {
      m.resize();
      if (p) {
        const b = new LngLatBounds([p.lng, p.lat], [p.lng, p.lat]).extend([w.boisko.lng, w.boisko.lat]);
        m.fitBounds(b, { padding: { top: 170, bottom: 330, left: 110, right: 110 }, maxZoom: 15, duration: 900 });
      } else {
        m.flyTo({ center: [w.boisko.lng, w.boisko.lat], zoom: 11, duration: 900 });
      }
    }, 380);
    if (w.koniec) void rankingTropu(20).then(setLista).catch(() => {});
  }, []);

  /* pod podsumowaniem: pięć strzałów, pięć boisk i linie między nimi na jednym kadrze */
  const pokazWszystkie = useCallback((h: Zapis[]) => {
    const m = mapa.current;
    if (!m) return;
    strzal.current?.remove();
    boisko.current?.remove();
    const b = new LngLatBounds();
    const linie: unknown[] = [];
    for (const z of h) {
      wszystkie.current.push(new Marker({ element: elementBoiska(), anchor: "bottom" }).setLngLat([z.boisko.lng, z.boisko.lat]).addTo(m));
      b.extend([z.boisko.lng, z.boisko.lat]);
      if (z.strzal) {
        wszystkie.current.push(new Marker({ element: elementStrzalu(), anchor: "bottom" }).setLngLat([z.strzal.lng, z.strzal.lat]).addTo(m));
        b.extend([z.strzal.lng, z.strzal.lat]);
        linie.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[z.strzal.lng, z.strzal.lat], [z.boisko.lng, z.boisko.lat]] } });
      }
    }
    const zr = m.getSource("linia") as { setData?: (d: unknown) => void } | undefined;
    zr?.setData?.({ type: "FeatureCollection", features: linie });
    if (!b.isEmpty()) m.fitBounds(b, { padding: 90, maxZoom: 11, duration: 1200 });
  }, []);

  const wyslij = useCallback(async (p: { lat: number; lng: number } | null) => {
    if (!runda || wysylam || fazaRef.current !== "runda") return;
    setWysylam(true);
    try {
      pokazWynik(await zgadnij(runda.gra, p), p);
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setWysylam(false);
    }
  }, [runda, wysylam, pokazWynik]);

  const dalej = useCallback(async () => {
    if (!runda) return;
    if (historia[historia.length - 1]?.koniec) {
      pokazWszystkie(historia);
      setFaza("koniec");
      return;
    }
    setFaza("ladowanie");
    try {
      const r = await nastepnaRunda(runda.gra);
      wyczyscMape();
      wejdzWRunde(r);
    } catch (e) {
      setBlad((e as Error).message);
      setFaza("wynik");
    }
  }, [runda, historia, wejdzWRunde, wyczyscMape, pokazWszystkie]);

  const odkryj = useCallback(async () => {
    if (!runda || odkryte) return;
    try {
      const wszystkie = await wiecejZdjec(runda.gra);
      setOdkryte(true);
      if (wszystkie.length) setZdjecia(wszystkie);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [runda, odkryte]);

  /* ------------------------------------------------ zegar: 3 minuty, na koniec strzał sam */
  useEffect(() => {
    if (faza !== "runda") return;
    const id = setInterval(() => {
      const s = Math.max(0, (koniecRundy.current - performance.now()) / 1000);
      setZostalo(s);
      if (s <= 0) {
        clearInterval(id);
        void wyslij(punktRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  }, [faza, wyslij]);

  /* ------------------------------------------------ klawiatura */
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea")) return;
      const k = e.key;
      if (faza === "tytul" && (k === "Enter" || k === " ")) { e.preventDefault(); void graj(); }
      else if (faza === "runda") {
        if ((k === "Enter" || k === " ") && punkt) { e.preventDefault(); void wyslij(punkt); }
        else if (k === "ArrowRight" && zdjecia.length > 1) setKtore((i) => (i + 1) % zdjecia.length);
        else if (k === "ArrowLeft" && zdjecia.length > 1) setKtore((i) => (i - 1 + zdjecia.length) % zdjecia.length);
        else if (k === "+" || k === "=") { setRozmiar(1); setPrzypieta(true); }
        else if (k === "-") { setRozmiar(0); setPrzypieta(false); }
        else if (k === "m" || k === "M") { const duza = rozmiar === 0; setRozmiar(duza ? 1 : 0); setPrzypieta(duza); }
      } else if (faza === "wynik" && (k === "Enter" || k === " ")) { e.preventDefault(); void dalej(); }
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [faza, punkt, zdjecia.length, rozmiar, graj, wyslij, dalej]);

  /*
    Rozwijanie jak w GeoGuessr: na komputerze mapa rośnie, gdy najedzie się na nią kursorem,
    i wraca, gdy się z niej zjedzie (z chwilą zwłoki, żeby nie skakała przy przejechaniu obok).
    Przycisk „Powiększ" przypina ją w dużym rozmiarze - na telefonie to jedyna droga, bo
    ekran dotykowy nie ma najechania.
  */
  const najazd = useCallback(() => {
    if (fazaRef.current !== "runda" || !window.matchMedia("(hover: hover)").matches) return;
    if (zwin.current) clearTimeout(zwin.current);
    zwin.current = setTimeout(() => setRozmiar(1), 90);
  }, []);
  const zjazd = useCallback((e: React.PointerEvent) => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (zwin.current) clearTimeout(zwin.current);
    if (przypieta || e.buttons !== 0) return;
    zwin.current = setTimeout(() => setRozmiar(0), 450);
  }, [przypieta]);
  useEffect(() => () => { if (zwin.current) clearTimeout(zwin.current); }, []);


  /* ------------------------------------------------ układ mapy */
  const naEkran = faza === "wynik" || faza === "koniec";
  const ukryta = faza === "tytul" || (faza === "ladowanie" && !runda);
  const klasaMapy = naEkran ? "trop-mapa-pelna" : rozmiar === 1 ? "trop-mapa-1" : "trop-mapa-0";

  const zdjecie = zdjecia[ktore] ?? null;
  const adres = zdjecie ? photoUrl(zdjecie.sciezka) : "";

  return (
    <main className="fixed inset-0 overflow-hidden bg-void text-ink">
      {/* ---------------------------------------------------------- zdjęcie rundy */}
      {(faza === "runda" || (faza === "ladowanie" && runda)) && adres && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={adresMiniatury(adres, 96)} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={adres} src={adresMiniatury(adres, 2000)} alt="Zdjęcie boiska do odgadnięcia" className="trop-zdjecie absolute inset-0 h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_55%,rgba(0,0,0,.55))]" />
        </div>
      )}

      {/* ---------------------------------------------------------- mapa (jedna na grę) */}
      <div
        onPointerEnter={najazd}
        onPointerLeave={zjazd}
        className={`trop-mapa absolute z-20 overflow-hidden ${klasaMapy} ${ukryta ? "pointer-events-none opacity-0" : "opacity-100"} ${
          faza === "runda" ? "cursor-crosshair" : ""
        }`}
      >
        <div ref={mapaEl} className="h-full w-full" />

        {faza === "runda" && (
          <button
            type="button"
            onClick={() => {
              const duza = !(rozmiar === 1 && przypieta);
              setRozmiar(duza ? 1 : 0);
              setPrzypieta(duza);
            }}
            aria-pressed={rozmiar === 1 && przypieta}
            className="trop-guzik-mapy absolute left-2.5 top-2.5 z-10"
          >
            {rozmiar === 1 && przypieta ? (
              <>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 8l5-5M17 8h-5V3M8 12l-5 5M3 12h5v5" /></svg>
                Zmniejsz
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3h5v5M17 3l-5 5M8 17H3v-5M3 17l5-5" /></svg>
                {rozmiar === 1 ? "Zostaw dużą" : "Powiększ"}
              </>
            )}
          </button>
        )}
      </div>

      {/* przycisk strzału pod minimapą - w tym samym narożniku, żeby ręka nie wędrowała */}
      {faza === "runda" && (
        <button
          type="button"
          onClick={() => void wyslij(punkt)}
          disabled={!punkt || wysylam}
          className={`trop-strzal absolute z-20 ${rozmiar === 1 ? "trop-strzal-1" : "trop-strzal-0"}`}
        >
          {wysylam ? "Sprawdzam…" : punkt ? "Zgadnij" : (
            <>
              <span className="sm:hidden">Postaw pinezkę</span>
              <span className="hidden sm:inline">Postaw pinezkę na mapie</span>
            </>
          )}
        </button>
      )}

      {/* ---------------------------------------------------------- górny pasek rundy */}
      {(faza === "runda" || faza === "wynik") && runda && (
        <>
          <div className="absolute left-4 top-4 z-30 flex flex-col items-start gap-2 sm:left-5 sm:top-5">
            <Link href="/" className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink">
              <ArrowLeftIcon className="h-4 w-4" /> mapa
            </Link>
            <div className="szklo-pro flex items-center gap-4 rounded-2xl px-4 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-faint">runda</p>
                <p className="text-[17px] font-semibold tabular-nums leading-tight">{runda.runda}<span className="text-faint"> / {runda.rund}</span></p>
              </div>
              <span className="h-7 w-px bg-hairline" />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-faint">punkty</p>
                <p className="text-[17px] font-semibold tabular-nums leading-tight">{liczba(suma)}</p>
              </div>
            </div>
          </div>

          {faza === "runda" && (
            <>
              {/* na telefonie zegar w prawym rogu (środek zajmują plakietki), od sm na środku */}
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-end pr-4 sm:top-4 sm:justify-center sm:pr-0">
                <span className={`zegar-gry trop-zegar ${zostalo <= 20 ? "zegar-gry-alarm" : ""}`}>{zegarTekst(zostalo)}</span>
              </div>

              <div className="absolute right-4 top-[84px] z-30 sm:right-5 sm:top-5">
                {odkryte ? (
                  <span className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <span className="line-through decoration-1">+10%</span><span className="hidden sm:inline">stracony</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#241800]"
                    style={{ background: `linear-gradient(135deg, ${ZLOTO.jasne}, ${ZLOTO.srodek} 60%, #d9982a)`, boxShadow: `0 10px 26px -10px ${ZLOTO.srodek}` }}
                  >
                    ★ <span className="sm:hidden">+10%</span><span className="hidden sm:inline">bonus +10% aktywny</span>
                  </span>
                )}
              </div>

              {/* zdjęcia: przycisk odkrycia albo pasek miniatur */}
              <div className={`trop-zdjecia-panel absolute left-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 transition-opacity sm:left-5 ${rozmiar === 1 ? "pointer-events-none opacity-0" : ""}`}>
                {!odkryte && runda.ile_zdjec > 1 && (
                  <button type="button" onClick={() => void odkryj()} className="szklo-pro rounded-2xl px-4 py-3 text-left transition hover:bg-white/10">
                    <span className="block text-[13px] font-semibold">Pokaż wszystkie zdjęcia ({runda.ile_zdjec})</span>
                    <span className="block text-[11px] text-faint">tracisz bonus +10% w tej rundzie</span>
                  </button>
                )}
                {odkryte && zdjecia.length > 1 && (
                  <div className="szklo-pro flex max-w-full gap-1.5 overflow-x-auto rounded-2xl p-1.5">
                    {zdjecia.map((z, i) => (
                      <button
                        key={z.sciezka}
                        type="button"
                        onClick={() => setKtore(i)}
                        aria-label={`Zdjęcie ${i + 1}`}
                        className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl transition ${i === ktore ? "ring-2 ring-[var(--color-flame)]" : "opacity-60 hover:opacity-100"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={adresMiniatury(photoUrl(z.sciezka), 200)} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- wynik rundy */}
      {faza === "wynik" && ostatni && <PanelRundy w={ostatni} onDalej={() => void dalej()} />}

      {/* ---------------------------------------------------------- koniec gry */}
      {faza === "koniec" && (
        <Podsumowanie
          historia={historia}
          lista={lista}
          mojNick={mojNick}
          zalogowany={zalogowany}
          onJeszcze={() => void graj()}
        />
      )}

      {/* ---------------------------------------------------------- ekran tytułowy */}
      {faza === "tytul" && <Tytul miejsce={miejsce} lista={lista} mojNick={mojNick} zalogowany={zalogowany} onGraj={() => void graj()} blad={blad} />}

      {faza === "ladowanie" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-void/40 backdrop-blur-sm">
          <span className="trop-ladowanie" aria-label="Ładowanie" />
        </div>
      )}

      {blad && faza !== "tytul" && (
        <div className="absolute inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <button type="button" onClick={() => setBlad(null)} className="szklo-pro rounded-full px-5 py-3 text-[13px] text-ink">
            {blad} · zamknij
          </button>
        </div>
      )}
    </main>
  );
}

/* ================================================================ wynik rundy */
function PanelRundy({ w, onDalej }: { w: Zapis; onDalej: () => void }) {
  const pkt = useDobieg(w.punkty);
  const pasek = Math.min(1, w.punkty / (TROP.maksRundy * (1 + TROP.bonus)));
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 sm:pb-8">
      <div className="szklo-pro trop-wejscie w-full max-w-[620px] rounded-[28px] px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: BLEKIT }}>runda {w.runda} z {w.rund}</p>
            <p className="trop-punkty mt-1">{liczba(pkt)}<span className="trop-punkty-jedn">pkt</span></p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-semibold tabular-nums">{w.spoznione ? "Czas minął" : opisOdleglosci(w.odleglosc)}</p>
            <p className="text-[12px] text-muted">{w.odleglosc === null ? "nie postawiono pinezki" : "od boiska"}</p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="trop-pasek h-full rounded-full" style={{ width: `${pasek * 100}%` }} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{w.boisko.nazwa}</p>
            <p className="text-[12px] text-muted">
              {w.boisko.miasto} ·{" "}
              <Link href={`/boisko/${w.boisko.slug}`} target="_blank" className="text-flame hover:underline">zobacz boisko</Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {w.bonus && (
              <span className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#241800]" style={{ background: `linear-gradient(135deg, ${ZLOTO.jasne}, ${ZLOTO.srodek})` }}>
                +10% bonus
              </span>
            )}
            <button type="button" onClick={onDalej} className="trop-dalej">
              {w.runda < w.rund ? "Następna runda" : "Wynik gry"} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ ranking */
function Ranking({ lista, mojNick, ile = 10 }: { lista: WpisTropu[]; mojNick: string | null; ile?: number }) {
  const [a, b, c] = lista;
  const podium = [b, a, c];
  const barwy = [
    { r: "linear-gradient(135deg,#f4f6fb,#b9c1cf 60%,#7c8494)", t: "#dfe4ee", h: 64 },
    { r: `linear-gradient(135deg,${ZLOTO.jasne},${ZLOTO.srodek} 55%,${ZLOTO.ciemne})`, t: ZLOTO.jasne, h: 86 },
    { r: "linear-gradient(135deg,#ffd2a6,#d0833f 55%,#7b3d10)", t: "#f2b27a", h: 50 },
  ];
  if (!lista.length) {
    return <p className="rounded-2xl border border-hairline px-5 py-8 text-center text-[13px] text-muted">Nikt jeszcze nie zagrał. Pierwsze miejsce jest do wzięcia.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-3 items-end gap-2">
        {podium.map((w, i) => {
          const miejsce = i === 1 ? 1 : i === 0 ? 2 : 3;
          const k = barwy[i];
          if (!w) return <div key={i} />;
          return (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="rounded-full p-[2.5px]" style={{ background: k.r }}>
                {w.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.avatar} alt="" className={`${miejsce === 1 ? "h-16 w-16" : "h-12 w-12"} rounded-full object-cover`} />
                ) : (
                  <span className={`${miejsce === 1 ? "h-16 w-16 text-[20px]" : "h-12 w-12 text-[15px]"} grid place-items-center rounded-full bg-void font-semibold`} style={{ color: k.t }}>
                    {w.nick.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <Link href={`/gracz/${slugifyPlace(w.nick)}`} className="mt-2 max-w-full truncate text-[13px] font-semibold hover:text-flame">{w.nick}</Link>
              <p className="text-[15px] font-bold tabular-nums" style={{ color: k.t }}>{liczba(w.wynik)}</p>
              <div className="mt-2 grid w-full place-items-center rounded-t-2xl text-[22px] font-black" style={{ height: k.h, background: k.r, color: "rgba(20,12,4,.72)" }}>
                {miejsce}
              </div>
            </div>
          );
        })}
      </div>
      {lista.length > 3 && (
        <ol className="mt-3 space-y-1" start={4}>
          {lista.slice(3, ile).map((w, i) => {
            const ja = mojNick !== null && w.nick === mojNick;
            return (
              <li key={`${w.nick}-${i}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${ja ? "bg-white/[0.08]" : ""}`}>
                <span className="w-6 text-right text-[13px] font-semibold tabular-nums text-faint">{i + 4}</span>
                {w.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] text-muted">{w.nick.slice(0, 1).toUpperCase()}</span>
                )}
                <Link href={`/gracz/${slugifyPlace(w.nick)}`} className="min-w-0 flex-1 truncate text-[14px] hover:text-flame">{w.nick}</Link>
                <span className="text-[14px] font-semibold tabular-nums">{liczba(w.wynik)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ================================================================ ekran tytułowy */
function Tytul({
  miejsce,
  lista,
  mojNick,
  zalogowany,
  onGraj,
  blad,
}: {
  miejsce: MiejsceGry;
  lista: WpisTropu[];
  mojNick: string | null;
  zalogowany: boolean;
  onGraj: () => void;
  blad: string | null;
}) {
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-45">
        <CourtOutline uid="trop" szkic />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_20%_20%,rgba(255,122,24,.20),transparent_70%),radial-gradient(50%_45%_at_85%_80%,rgba(86,172,255,.14),transparent_70%)]" />

      <Link href="/" className="szklo-pro absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" /> wróć na mapę
      </Link>

      <div className="relative mx-auto grid min-h-full max-w-6xl items-center gap-10 px-6 pb-12 pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <p className="text-[11px] uppercase tracking-[0.42em]" style={{ color: BLEKIT }}>{miejsce.miasto} · minigra</p>
          <h1 className="trop-tytul mt-4">Trop</h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted">
            Zdjęcie boiska z mapy PodKosza i mapa Polski. Postaw pinezkę tam, gdzie Twoim zdaniem ono stoi -
            im bliżej, tym więcej punktów.
          </p>

          <ul className="mt-7 grid max-w-[520px] grid-cols-2 gap-2.5">
            {[
              ["5 rund", "losowe boiska z całej bazy"],
              ["3:00", "na każdą rundę"],
              ["1000 pkt", "za trafienie co do 10 m"],
              ["+10%", "za zgadnięcie po jednym zdjęciu"],
            ].map(([a, b]) => (
              <li key={a} className="szklo-pro rounded-2xl px-4 py-3">
                <p className="trop-zasada">{a}</p>
                <p className="text-[12px] leading-snug text-muted">{b}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[520px] text-[12px] leading-relaxed text-faint">
            Trafione miasto to zawsze co najmniej 500 punktów. Dalej punkty szybko spadają - kilkaset kilometrów obok to już prawie zero.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="button" onClick={onGraj} className="trop-graj">Zagraj</button>
            <span className="text-[12px] uppercase tracking-[0.2em] text-faint">albo Enter</span>
          </div>
          {!zalogowany && (
            <p className="mt-4 text-[13px] text-muted">Grasz bez konta - wynik nie wejdzie do rankingu. <span className="text-faint">Zaloguj się, żeby walczyć o podium.</span></p>
          )}
          {blad && <p className="mt-4 text-[13px] text-ember">{blad}</p>}
        </div>

        <section className="szklo-pro rounded-[30px] px-5 pb-5 pt-6 sm:px-7" aria-labelledby="trop-ranking">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="trop-ranking" className="text-[20px] font-semibold tracking-[-0.02em]">Ranking</h2>
            <p className="text-[11px] uppercase tracking-[0.16em] text-faint">najlepsza gra · max {liczba(TROP.maksGry)}</p>
          </div>
          <Ranking lista={lista} mojNick={mojNick} />
        </section>
      </div>
    </div>
  );
}

/* ================================================================ koniec gry */
function Podsumowanie({
  historia,
  lista,
  mojNick,
  zalogowany,
  onJeszcze,
}: {
  historia: Zapis[];
  lista: WpisTropu[];
  mojNick: string | null;
  zalogowany: boolean;
  onJeszcze: () => void;
}) {
  const ost = historia[historia.length - 1];
  const suma = useDobieg(ost?.suma ?? 0, 1400);
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-void/35 backdrop-blur-[2px]">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-6 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* gęstsze tło niż zwykła szyba - pod spodem są pinezki wszystkich rund i nie mogą przebijać przez tekst */}
        <section className="szklo-pro trop-wejscie rounded-[30px] px-6 py-7 sm:px-8" style={{ background: "rgba(16, 12, 11, 0.9)" }}>
          <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: BLEKIT }}>koniec gry</p>
          <p className="trop-suma mt-2">{liczba(suma)}</p>
          <p className="text-[13px] uppercase tracking-[0.2em] text-faint">z {liczba(TROP.maksGry)} punktów</p>

          {ost?.nowy_rekord && (
            <p className="mt-4 inline-flex rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#241800]" style={{ background: `linear-gradient(135deg, ${ZLOTO.jasne}, ${ZLOTO.srodek})` }}>
              ★ nowy rekord
            </p>
          )}
          {zalogowany && ost?.pozycja && (
            <p className="mt-3 text-[14px] text-muted">
              Twoje miejsce w rankingu: <b className="text-ink">{ost.pozycja}</b> · rekord {liczba(ost.rekord ?? 0)} pkt
            </p>
          )}

          <ol className="mt-6 space-y-1.5">
            {historia.map((h) => (
              <li key={h.runda} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                <span className="w-5 text-[12px] font-semibold tabular-nums text-faint">{h.runda}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/boisko/${h.boisko.slug}`} target="_blank" className="block truncate text-[14px] font-semibold hover:text-flame">{h.boisko.nazwa}</Link>
                  <p className="text-[12px] text-muted">{h.boisko.miasto} · {h.spoznione ? "czas minął" : opisOdleglosci(h.odleglosc)}</p>
                </div>
                {h.bonus && <span className="text-[12px]" style={{ color: ZLOTO.srodek }} title="bonus za jedno zdjęcie">★</span>}
                <span className="text-[15px] font-semibold tabular-nums">{liczba(h.punkty)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onJeszcze} className="trop-graj">Zagraj jeszcze raz</button>
            <Link href="/" className="rounded-full px-5 py-3 text-[13px] text-muted transition hover:text-ink">Wróć na mapę</Link>
          </div>
          {!zalogowany && (
            <div className="mt-6 rounded-2xl border border-hairline px-5 py-4">
              <p className="text-[13px] leading-relaxed text-muted">Ten wynik nie wszedł do rankingu, bo grasz bez konta. Zaloguj się i zagraj jeszcze raz - boiska wylosują się od nowa.</p>
              <div className="mt-3"><PrzyciskLogowania etykieta="Zaloguj się i zagraj" /></div>
            </div>
          )}
        </section>

        <section className="szklo-pro rounded-[30px] px-5 pb-5 pt-6 sm:px-7" style={{ background: "rgba(16, 12, 11, 0.9)" }} aria-labelledby="trop-ranking-koniec">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="trop-ranking-koniec" className="text-[20px] font-semibold tracking-[-0.02em]">Ranking</h2>
            <p className="text-[11px] uppercase tracking-[0.16em] text-faint">najlepsza gra</p>
          </div>
          <Ranking lista={lista} mojNick={mojNick} />
        </section>
      </div>
    </div>
  );
}
