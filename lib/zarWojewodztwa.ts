import type { Map as MlMap } from "maplibre-gl";

/**
 * Żywe podświetlenie wybranego województwa.
 *
 * MapLibre nie umie wypełnić wielokąta gradientem: `fill-color` to jeden kolor na całą
 * figurę, więc z samych warstw mapy da się zrobić najwyżej pulsowanie jasności - a to
 * wygląda jak mruganie, nie jak żar. Dlatego rysujemy warstwę SVG nad kanwą mapy: kilka
 * miękkich plam światła przyciętych do kształtu województwa, każda w innym tempie i
 * fazie. Wewnątrz obrysu gradient wolno wędruje, poza nim nie ma go wcale.
 *
 * Cała sztuczka z wydajnością polega na tym, że kształt NIE jest przeliczany przy każdej
 * klatce. Współrzędne liczymy raz, w rzutowaniu Mercatora - tym samym, którego używa
 * mapa - i zapisujemy w stałej przestrzeni lokalnej. Przy braku obrotu i pochylenia (a
 * mapa ma je wyłączone) przejście z tej przestrzeni na ekran jest przekształceniem
 * afinicznym: przesunięcie plus skala. Na klatkę przypadają więc dwa rzutowania punktów
 * i jeden zapis atrybutu, a nie osiemset przeliczeń wierzchołków.
 */

/** Skala przestrzeni lokalnej. Polska ma w niej ~1800 jednostek szerokości - dość na detal. */
const K = 65536;

interface Ksztalt {
  d: string;
  /** róg bbox: lewy górny i prawy dolny - z nich liczymy przekształcenie na ekran */
  nw: [number, number];
  se: [number, number];
  lokalneNW: { x: number; y: number };
  lokalneSE: { x: number; y: number };
}

function merkator(lng: number, lat: number) {
  const x = (lng + 180) / 360;
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return { x: x * K, y: y * K };
}

type Pierscien = [number, number][];

function pierscienie(geom: GeoJSON.Geometry): Pierscien[] {
  if (geom.type === "Polygon") return geom.coordinates as Pierscien[];
  if (geom.type === "MultiPolygon") return (geom.coordinates as Pierscien[][]).flat();
  return [];
}

function zbudujKsztalt(geom: GeoJSON.Geometry): Ksztalt | null {
  const rings = pierscienie(geom);
  if (!rings.length) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  const czesci: string[] = [];

  for (const ring of rings) {
    if (ring.length < 3) continue;
    const punkty: string[] = [];
    for (const [lng, lat] of ring) {
      const p = merkator(lng, lat);
      punkty.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    czesci.push(`M${punkty.join("L")}Z`);
  }

  if (!czesci.length) return null;

  return {
    d: czesci.join(""),
    nw: [minLng, maxLat],
    se: [maxLng, minLat],
    lokalneNW: merkator(minLng, maxLat),
    lokalneSE: merkator(maxLng, minLat),
  };
}

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(nazwa: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, nazwa);
}

export interface ZarWojewodztwa {
  ustaw(geom: GeoJSON.Geometry | null): void;
  zniszcz(): void;
}

/**
 * Podpina warstwę do kanwy mapy i oddaje sterowanie nią.
 *
 * Warstwa ląduje tuż ZA kanwą, a przed pinezkami: żar ma leżeć na mapie, ale pod
 * pinezkami - inaczej podbarwiałby je na pomarańczowo i psuł fioletowe wyróżnienie Heatu.
 */
export function stworzZarWojewodztwa(map: MlMap, przyrostek: string): ZarWojewodztwa {
  const kontener = map.getCanvasContainer();
  const kanwa = map.getCanvas();

  const svg = el("svg");
  svg.setAttribute("class", "zar-woj");
  svg.setAttribute("aria-hidden", "true");

  const defs = el("defs");
  const clip = el("clipPath");
  const idClip = `zar-woj-ksztalt-${przyrostek}`;
  clip.setAttribute("id", idClip);
  const sciezka = el("path");
  clip.appendChild(sciezka);
  defs.appendChild(clip);

  /*
    Trzy gradienty w trzech odcieniach ognia: głęboka czerwień u podstawy, pomarańcz w
    środku i jasny żółty jako najmniejsza, najszybsza plama. Rozłożone na trzy warstwy,
    bo jedna plama w jednym kolorze czyta się jak reflektor, a nie jak rozgrzana blacha.
  */
  const barwy: [string, string, number][] = [
    ["zar-a", "255,122,24", 0.34],
    ["zar-b", "255,64,10", 0.3],
    ["zar-c", "255,206,110", 0.34],
  ];
  for (const [nazwa, rgb, alfa] of barwy) {
    const g = el("radialGradient");
    g.setAttribute("id", `${nazwa}-${przyrostek}`);
    const s1 = el("stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", `rgba(${rgb},${alfa})`);
    const s2 = el("stop");
    s2.setAttribute("offset", "62%");
    s2.setAttribute("stop-color", `rgba(${rgb},${(alfa * 0.34).toFixed(3)})`);
    const s3 = el("stop");
    s3.setAttribute("offset", "100%");
    s3.setAttribute("stop-color", `rgba(${rgb},0)`);
    g.append(s1, s2, s3);
    defs.appendChild(g);
  }
  svg.appendChild(defs);

  /** grupa przesuwana i skalowana razem z mapą */
  const scena = el("g");
  const przyciete = el("g");
  przyciete.setAttribute("clip-path", `url(#${idClip})`);
  scena.appendChild(przyciete);
  svg.appendChild(scena);

  const plamy = barwy.map(([nazwa], i) => {
    const e = el("ellipse");
    e.setAttribute("fill", `url(#${nazwa}-${przyrostek})`);
    e.setAttribute("class", `zar-woj-plama zar-woj-plama-${i + 1}`);
    przyciete.appendChild(e);
    return e;
  });

  kontener.insertBefore(svg, kanwa.nextSibling);

  let ksztalt: Ksztalt | null = null;

  const przelicz = () => {
    if (!ksztalt) return;
    const a = map.project(ksztalt.nw);
    const b = map.project(ksztalt.se);
    const rozpietosc = ksztalt.lokalneSE.x - ksztalt.lokalneNW.x;
    if (rozpietosc <= 0) return;
    const skala = (b.x - a.x) / rozpietosc;
    const tx = a.x - skala * ksztalt.lokalneNW.x;
    const ty = a.y - skala * ksztalt.lokalneNW.y;
    scena.setAttribute("transform", `translate(${tx} ${ty}) scale(${skala})`);
  };

  map.on("move", przelicz);
  map.on("zoom", przelicz);
  map.on("resize", przelicz);

  return {
    ustaw(geom) {
      if (!geom) {
        ksztalt = null;
        svg.classList.remove("zar-woj-widoczny");
        return;
      }

      const nowy = zbudujKsztalt(geom);
      if (!nowy) {
        ksztalt = null;
        svg.classList.remove("zar-woj-widoczny");
        return;
      }

      ksztalt = nowy;
      sciezka.setAttribute("d", nowy.d);

      /*
        Plamy dobieramy do rozmiaru województwa, nie do stałej liczby pikseli: mazowieckie
        jest trzy razy większe od opolskiego, a żar ma w obu wyglądać tak samo gęsto.
        Amplituda ruchu też idzie z rozmiaru - stąd zmienne w stylu, z których korzystają
        klatki animacji w globals.css.
      */
      const w = nowy.lokalneSE.x - nowy.lokalneNW.x;
      const h = nowy.lokalneSE.y - nowy.lokalneNW.y;
      const cx = nowy.lokalneNW.x + w / 2;
      const cy = nowy.lokalneNW.y + h / 2;

      const rozmiary = [0.82, 0.58, 0.34];
      plamy.forEach((e, i) => {
        const f = rozmiary[i];
        e.setAttribute("cx", cx.toFixed(2));
        e.setAttribute("cy", cy.toFixed(2));
        e.setAttribute("rx", (w * f).toFixed(2));
        e.setAttribute("ry", (h * f).toFixed(2));
        e.style.setProperty("--dx", `${(w * 0.26).toFixed(2)}px`);
        e.style.setProperty("--dy", `${(h * 0.26).toFixed(2)}px`);
      });

      svg.classList.add("zar-woj-widoczny");
      przelicz();
    },

    zniszcz() {
      map.off("move", przelicz);
      map.off("zoom", przelicz);
      map.off("resize", przelicz);
      svg.remove();
    },
  };
}
