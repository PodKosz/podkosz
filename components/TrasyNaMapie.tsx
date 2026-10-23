"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LngLatBounds, Marker, type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import type { MapCourt } from "@/lib/types";
import type { CelMapy } from "@/lib/miejsca";
import type { Wydarzenie } from "@/lib/wydarzenia";
import { punktyWKadrze } from "@/lib/punkty-osm";
import { metryMiedzy, opisTrasy, przytnijLinie, trasaPiesza, type Punkt, type Trasa } from "@/lib/trasy";
import { HoverCard } from "./HoverCard";

/** Ile tras rysujemy z wyszukanego adresu. */
const ILE_TRAS = 3;
/** Boiska dalej niż tyle (w linii prostej) nie są już „najbliższe” - wtedy szukamy punktów z OSM. */
const ZASIEG_BOISK_M = 4000;
const ZASIEG_PUNKTOW_M = 3000;
const POMARANCZ = "#ff7a18";

type Cel =
  | { rodzaj: "boisko"; klucz: string; lat: number; lng: number; court: MapCourt }
  | { rodzaj: "osm"; klucz: string; lat: number; lng: number; osmId: string };

/**
 * `pod` - karta stoi pod punktem, `dx` - przesunięta w bok; jedno i drugie, gdy nad samym
 * punktem zasłoniłaby sąsiednią kartę albo wyszła poza ekran
 */
type Miejsce = { pod: boolean; dx: number };
type Karta = { klucz: string; el: HTMLDivElement; cel: Cel; trasa: Trasa; miejsce: Miejsce };

/** skala wizytówki: trzy naraz muszą być mniejsze od tej po najechaniu */
const skala = (c: Cel, dotyk: boolean) => (c.rodzaj === "boisko" ? (dotyk ? 0.46 : 0.66) : dotyk ? 0.62 : 0.66);

/** przybliżony prostokąt karty na ekranie (przed skalą: wizytówka 300 x 430, zaproszenie OSM mniejsze) */
function rozmiar(c: Cel, dotyk: boolean) {
  const k = skala(c, dotyk);
  if (c.rodzaj === "boisko") return { w: 300 * k, h: 480 * k, odstep: 52 };
  return dotyk ? { w: 210 * k, h: 165 * k, odstep: 14 } : { w: 300 * k, h: 240 * k, odstep: 14 };
}

type Prostokat = { x0: number; y0: number; x1: number; y1: number };

const czescWspolna = (a: Prostokat, b: Prostokat) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/**
 * Gdzie stanie karta. Kolejno od najbliższego celu: najpierw nad pinezką, potem pod nią,
 * potem obie wersje przesunięte w bok. Wygrywa pierwsza, która nie zachodzi na już
 * postawione karty i mieści się na ekranie (pod paskiem nawigacji, nad dolnym panelem).
 * Gdy żadna nie jest czysta, ta z najmniejszą zakładką.
 */
function rozstaw(map: MlMap, cele: Cel[], dotyk: boolean): Miejsce[] {
  const zajete: Prostokat[] = [];
  const { clientWidth: W, clientHeight: H } = map.getContainer();
  const ekran = { x0: 4, x1: W - 4, y0: dotyk ? 120 : 90, y1: H - (dotyk ? 130 : 20) };
  return cele.map((c) => {
    const p = map.project([c.lng, c.lat]);
    const { w, h, odstep } = rozmiar(c, dotyk);
    const warianty: Miejsce[] = [0, w * 0.62, -w * 0.62].flatMap((dx) => [
      { pod: false, dx },
      { pod: true, dx },
    ]);
    const prostokat = (m: Miejsce): Prostokat => {
      const x0 = p.x + m.dx - w / 2;
      return m.pod ? { x0, x1: x0 + w, y0: p.y + 14, y1: p.y + 14 + h } : { x0, x1: x0 + w, y0: p.y - odstep - h, y1: p.y - odstep };
    };
    const kara = (m: Miejsce) => {
      const r = prostokat(m);
      const poza = Math.max(0, ekran.x0 - r.x0) + Math.max(0, r.x1 - ekran.x1) + Math.max(0, ekran.y0 - r.y0) + Math.max(0, r.y1 - ekran.y1);
      return zajete.reduce((s, z) => s + czescWspolna(z, r), 0) + poza * 400;
    };
    let najlepszy = warianty[0];
    let najmniej = Infinity;
    for (const m of warianty) {
      const k = kara(m);
      if (k < najmniej) {
        najmniej = k;
        najlepszy = m;
      }
      if (k === 0) break;
    }
    zajete.push(prostokat(najlepszy));
    return najlepszy;
  });
}

const pusto = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

/** Czekamy, aż kamera skończy lot do wyszukanego punktu - linie mają wyjść z niego na oczach. */
function poLocie(map: MlMap) {
  return new Promise<void>((gotowe) => {
    const juz = () => {
      window.clearTimeout(koniec);
      map.off("moveend", juz);
      gotowe();
    };
    map.on("moveend", juz);
    /* gdy kamera stała już na miejscu, `moveend` nie przyjdzie - nie czekamy w nieskończoność */
    const koniec = window.setTimeout(juz, 4500);
  });
}

/** Do trzech najbliższych boisk; brakujące miejsca dopełniają nieodkryte boiska z OSM. */
async function wybierzCele(start: Punkt, courts: MapCourt[]): Promise<Cel[]> {
  const boiska: Cel[] = courts
    .map((c) => ({ c, m: metryMiedzy(start, c) }))
    .filter((x) => x.m <= ZASIEG_BOISK_M)
    .sort((a, b) => a.m - b.m)
    .slice(0, ILE_TRAS)
    .map(({ c }) => ({ rodzaj: "boisko", klucz: `b-${c.id}`, lat: c.lat, lng: c.lng, court: c }));
  if (boiska.length >= ILE_TRAS) return boiska;

  const dLat = ZASIEG_PUNKTOW_M / 111_000;
  const dLng = dLat / Math.cos((start.lat * Math.PI) / 180);
  const punkty = await punktyWKadrze({
    minLat: start.lat - dLat,
    maxLat: start.lat + dLat,
    minLng: start.lng - dLng,
    maxLng: start.lng + dLng,
  }).catch(() => []);
  const osm: Cel[] = punkty
    .map((p) => ({ p, m: metryMiedzy(start, p) }))
    .filter((x) => x.m <= ZASIEG_PUNKTOW_M)
    .sort((a, b) => a.m - b.m)
    .slice(0, ILE_TRAS - boiska.length)
    .map(({ p }) => ({ rodzaj: "osm", klucz: `o-${p.id}`, lat: p.lat, lng: p.lng, osmId: p.id }));
  return [...boiska, ...osm];
}

/** gładkie wejście i hamowanie - linia „wychodzi” z punktu i dojeżdża do pinezki */
const wygladz = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Trasy z wyszukanego adresu do najbliższych boisk.
 *
 * Po wyborze adresu w wyszukiwarce (albo „Moja lokalizacja") kamera dolatuje do punktu,
 * oddala się tak, żeby objąć trzy najbliższe boiska, i z punktu wychodzą pomarańczowe linie
 * po ulicach (piesza trasa, `lib/trasy.ts`). Gdy linia dojdzie do pinezki, nad nią otwiera się
 * ta sama wizytówka, co po najechaniu - tylko mniejsza, bo stoją trzy naraz - z czasem dojścia.
 * Jeśli w okolicy brakuje dodanych boisk, linie idą do szarych punktów z OpenStreetMap,
 * a nad nimi staje zaproszenie „Dodaj boisko".
 *
 * Linie są warstwą mapy (pod pinezkami), wizytówki - znacznikami MapLibre z treścią
 * wstawioną przez portal Reacta, więc jeżdżą razem z mapą bez liczenia położeń.
 * Wszystko znika razem z celem wyszukiwania (wyczyszczenie pola, wybór boiska z listy).
 */
export function TrasyNaMapie({
  map,
  cel,
  courts,
  wydarzenia,
  checkiny,
  dotyk,
}: {
  map: MlMap | null;
  cel: CelMapy | null;
  courts: MapCourt[];
  wydarzenia: Record<string, Wydarzenie>;
  checkiny: Record<string, number>;
  dotyk: boolean;
}) {
  /* lista boisk zmienia się z filtrami i odświeżeniem - nie może przerywać rysowanej trasy */
  const courtsRef = useRef(courts);
  useEffect(() => {
    courtsRef.current = courts;
  }, [courts]);

  /* karty należą do konkretnego celu - po zmianie celu stare przestają się rysować od razu */
  const [karty, setKarty] = useState<{ cel: CelMapy | null; lista: Karta[] }>({ cel: null, lista: [] });

  useEffect(() => {
    if (!map || !cel?.znacznik) return;
    const start = { lat: cel.lat, lng: cel.lng };
    let zywy = true;
    let klatka = 0;
    const znaczniki: Marker[] = [];

    const zrodlo = () => {
      if (!map.getSource("trasy")) {
        map.addSource("trasy", { type: "geojson", data: pusto, attribution: "Trasy: OSRM · FOSSGIS" });
        map.addSource("trasy-glowy", { type: "geojson", data: pusto });
        map.addSource("trasy-cele", { type: "geojson", data: pusto });
        /* pod białą kropką adresu, żeby linie z niej wychodziły, a nie ją przykrywały */
        const pod = map.getLayer("cel-szukania-halo") ? "cel-szukania-halo" : undefined;
        map.addLayer(
          {
            id: "trasy-poswiata",
            type: "line",
            source: "trasy",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": POMARANCZ, "line-width": 12, "line-blur": 8, "line-opacity": 0.45 },
          },
          pod
        );
        map.addLayer(
          {
            id: "trasy",
            type: "line",
            source: "trasy",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": POMARANCZ, "line-width": 3.5 },
          },
          pod
        );
        /*
          Szare punkty z OSM pojawiają się na mapie dopiero od przybliżenia 15, a kadr na trzy
          trasy bywa dalszy - więc koniec linii przy nieodkrytym boisku zaznaczamy sami.
        */
        map.addLayer(
          {
            id: "trasy-cele",
            type: "circle",
            source: "trasy-cele",
            paint: { "circle-radius": 7, "circle-color": "#2a2a30", "circle-stroke-color": "#c9ccd2", "circle-stroke-width": 2 },
          },
          pod
        );
        map.addLayer(
          {
            id: "trasy-glowy",
            type: "circle",
            source: "trasy-glowy",
            paint: { "circle-radius": 5, "circle-color": "#fff1e0", "circle-stroke-color": POMARANCZ, "circle-stroke-width": 3 },
          },
          pod
        );
      }
      return {
        linie: map.getSource("trasy") as GeoJSONSource,
        glowy: map.getSource("trasy-glowy") as GeoJSONSource,
        punkty: map.getSource("trasy-cele") as GeoJSONSource,
      };
    };

    void (async () => {
      const [cele] = await Promise.all([wybierzCele(start, courtsRef.current), poLocie(map)]);
      if (!zywy || !cele.length) return;
      const trasy = await Promise.all(cele.map((c) => trasaPiesza(start, c)));
      if (!zywy) return;

      /* kadr na wszystkie trasy; u góry miejsce na wizytówki nad pinezkami */
      const ramka = new LngLatBounds([start.lng, start.lat], [start.lng, start.lat]);
      for (const t of trasy) for (const p of t.wspolrzedne) ramka.extend(p);
      map.fitBounds(ramka, {
        /* na komputerze z lewej stoi panel wyszukiwarki z listą najbliższych - karty nie mogą pod nim zniknąć */
        padding: dotyk
          ? { top: 300, bottom: 150, left: 80, right: 80 }
          : { top: 300, bottom: 90, left: window.innerWidth >= 1024 ? 480 : 140, right: 140 },
        maxZoom: Math.max(cel.zoom, 15),
        duration: 900,
        essential: true,
      });
      await poLocie(map);
      if (!zywy) return;

      const { linie, glowy, punkty } = zrodlo();
      punkty.setData({
        type: "FeatureCollection",
        features: cele
          .filter((c) => c.rodzaj === "osm")
          .map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: [c.lng, c.lat] }, properties: {} })),
      });
      /* dłuższa trasa rysuje się dłużej, ale żadna nie każe na siebie czekać */
      const czasy = trasy.map((t) => Math.min(2400, 1100 + t.metry * 0.45));
      const opoznienia = trasy.map((_, i) => i * 180);
      const podSpodem = rozstaw(map, cele, dotyk);
      const dojechane = new Set<number>();
      const t0 = performance.now();

      const rysuj = (teraz: number) => {
        if (!zywy) return;
        const cechy: GeoJSON.Feature[] = [];
        const czola: GeoJSON.Feature[] = [];
        trasy.forEach((t, i) => {
          const postep = Math.min(1, Math.max(0, (teraz - t0 - opoznienia[i]) / czasy[i]));
          const linia = przytnijLinie(t.wspolrzedne, wygladz(postep));
          cechy.push({ type: "Feature", geometry: { type: "LineString", coordinates: linia }, properties: {} });
          if (postep > 0 && postep < 1) {
            czola.push({ type: "Feature", geometry: { type: "Point", coordinates: linia[linia.length - 1] }, properties: {} });
          }
          if (postep >= 1 && !dojechane.has(i)) {
            dojechane.add(i);
            /* linia dotarła - nad pinezką otwiera się wizytówka */
            const el = document.createElement("div");
            el.className = "trasa-karta-kotwica";
            const c = cele[i];
            const miejsce = podSpodem[i];
            const odstep = rozmiar(c, dotyk).odstep;
            znaczniki.push(
              new Marker({ element: el, anchor: miejsce.pod ? "top" : "bottom", offset: [miejsce.dx, miejsce.pod ? 14 : -odstep] })
                .setLngLat([c.lng, c.lat])
                .addTo(map)
            );
            const karta: Karta = { klucz: c.klucz, el, cel: c, trasa: t, miejsce };
            setKarty((k) => ({ cel, lista: [...(k.cel === cel ? k.lista : []), karta] }));
          }
        });
        linie.setData({ type: "FeatureCollection", features: cechy });
        glowy.setData({ type: "FeatureCollection", features: czola });
        if (dojechane.size < trasy.length) klatka = requestAnimationFrame(rysuj);
      };
      klatka = requestAnimationFrame(rysuj);
    })();

    return () => {
      zywy = false;
      cancelAnimationFrame(klatka);
      for (const m of znaczniki) m.remove();
      (map.getSource("trasy") as GeoJSONSource | undefined)?.setData(pusto);
      (map.getSource("trasy-glowy") as GeoJSONSource | undefined)?.setData(pusto);
      (map.getSource("trasy-cele") as GeoJSONSource | undefined)?.setData(pusto);
    };
  }, [map, cel, dotyk]);

  const lista = karty.cel === cel ? karty.lista : [];
  return (
    <>
      {lista.map((k) =>
        createPortal(
          <div
            className={`trasa-karta ${k.miejsce.pod ? "trasa-karta-pod" : ""}`}
            style={{ ["--trasa-skala" as string]: skala(k.cel, dotyk) }}
            /* klik w kartę nie może wybrać województwa pod spodem */
            onClick={(e) => e.stopPropagation()}
          >
            <span className="trasa-czas glass">{opisTrasy(k.trasa)}</span>
            {k.cel.rodzaj === "boisko" ? (
              <Link href={`/boisko/${k.cel.court.slug}`} className="trasa-karta-wizytowka">
                <HoverCard court={k.cel.court} wydarzenie={wydarzenia[k.cel.court.id]} osobyDzis={checkiny[k.cel.court.id] ?? 0} />
              </Link>
            ) : (
              <KartaNieodkrytego osmId={k.cel.osmId} kompakt={dotyk} />
            )}
          </div>,
          k.el,
          k.klucz
        )
      )}
    </>
  );
}

/** Zaproszenie nad szarym punktem z OSM - tu stoi kosz, którego jeszcze nie ma na mapie. */
function KartaNieodkrytego({ osmId, kompakt }: { osmId: string; kompakt: boolean }) {
  /* na telefonie samo „Nieodkryte boisko" i przycisk - pełne zaproszenie zasłoniłoby pół mapy */
  return (
    <span className={`trasa-osm glass ${kompakt ? "trasa-osm-kompakt" : ""}`}>
      <span className="trasa-osm-nadtytul">Nieodkryte boisko</span>
      {!kompakt && <span className="trasa-osm-tytul">Tu stoi kosz, którego nie ma jeszcze na mapie</span>}
      <span className="trasa-osm-przyciski">
        <Link href="/dodaj" className="trasa-osm-dodaj">
          Dodaj boisko
        </Link>
        {!kompakt && (
          <Link href={`/nieodkryte/${osmId}`} className="trasa-osm-wiecej">
            Szczegóły
          </Link>
        )}
      </span>
    </span>
  );
}
