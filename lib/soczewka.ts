"use client";

import { useEffect, type RefObject } from "react";

/**
 * Soczewka z płynnego szkła - tło pod taflą zagina się przy krawędziach jak w iOS 26.
 *
 * `.szklo-plynne` (patrz FiltrSzkla) faluje tło szumem: dobre na dużych kartach nad mapą,
 * ale na małej szybie leżącej na zdjęciu szum czyta się jak zmarszczki, a nie jak szkło.
 * Prawdziwa soczewka jest gładka w środku i załamuje światło dopiero na rancie - dlatego
 * tu mapa przesunięć jest liczona z kształtu samej tafli: zero w środku, a przy krawędzi
 * piksele ciągnięte do wewnątrz, coraz mocniej im bliżej brzegu.
 *
 * Mapa zależy od rozmiaru tafli, więc liczymy ją na żywo (płótno → obrazek w `feImage`)
 * i pamiętamy po rozmiarze - wizytówki mają kilka stałych wymiarów, więc po pierwszym
 * najechaniu każda następna dostaje gotowy filtr.
 *
 * Filtr w `backdrop-filter: url(...)` rozumieją tylko silniki Chromium. Gdzie go nie ma
 * (Safari), zostaje samo rozmycie z arkusza - tak samo jak w `.szklo-plynne`.
 */

const NS = "http://www.w3.org/2000/svg";
const gotowe = new Map<string, string>();
let defs: SVGDefsElement | null = null;

function miejsceNaFiltry() {
  if (defs?.isConnected) return defs;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  defs = document.createElementNS(NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

/** Kanał R to przesunięcie w poziomie, G w pionie; 128 znaczy „bez ruchu". */
function mapaPrzesuniec(w: number, h: number, r: number, pas: number) {
  const plotno = document.createElement("canvas");
  plotno.width = w;
  plotno.height = h;
  const g = plotno.getContext("2d");
  if (!g) return null;
  const obraz = g.createImageData(w, h);
  const d = obraz.data;
  const pw = w / 2;
  const ph = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x + 0.5 - pw;
      const py = y + 0.5 - ph;
      // odległość od brzegu zaokrąglonego prostokąta (ujemna w środku)
      const qx = Math.abs(px) - (pw - r);
      const qy = Math.abs(py) - (ph - r);
      const zew = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const odl = Math.min(Math.max(qx, qy), 0) + zew - r;
      const t = Math.max(0, Math.min(1, 1 + odl / pas));
      let dx = 0;
      let dy = 0;
      if (t > 0) {
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          nx = qx / zew;
          ny = qy / zew;
        } else if (qx > qy) {
          nx = 1;
          ny = 0;
        } else {
          nx = 0;
          ny = 1;
        }
        nx *= Math.sign(px) || 1;
        ny *= Math.sign(py) || 1;
        // przy samym rancie najmocniej, w głąb szybko gaśnie - jak w grubym szkle
        const s = Math.pow(t, 2.4);
        dx = -nx * s;
        dy = -ny * s;
      }
      d[i] = 128 + dx * 127;
      d[i + 1] = 128 + dy * 127;
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  g.putImageData(obraz, 0, 0);
  return plotno.toDataURL();
}

/** Id filtra soczewki dla tafli `w`×`h` o zaokrągleniu `r` albo `null`, gdy silnik go nie obsłuży. */
export function filtrSoczewki(w: number, h: number, r: number, moc = 1): string | null {
  if (typeof window === "undefined" || !w || !h) return null;
  if (!CSS.supports("backdrop-filter", "url(#a)")) return null;
  const klucz = `${w}x${h}x${r}x${moc}`;
  const jest = gotowe.get(klucz);
  if (jest && document.getElementById(jest)) return jest;

  const mapa = mapaPrzesuniec(w, h, r, Math.min(r, 26) * (0.9 + 0.3 * moc));
  if (!mapa) return null;
  const id = `soczewka-${klucz}`.replace(/\./g, "-");
  const f = document.createElementNS(NS, "filter");
  f.setAttribute("id", id);
  f.setAttribute("x", "0");
  f.setAttribute("y", "0");
  f.setAttribute("width", String(w));
  f.setAttribute("height", String(h));
  f.setAttribute("filterUnits", "userSpaceOnUse");
  f.setAttribute("color-interpolation-filters", "sRGB");
  const obraz = document.createElementNS(NS, "feImage");
  obraz.setAttribute("href", mapa);
  obraz.setAttribute("x", "0");
  obraz.setAttribute("y", "0");
  obraz.setAttribute("width", String(w));
  obraz.setAttribute("height", String(h));
  obraz.setAttribute("preserveAspectRatio", "none");
  obraz.setAttribute("result", "mapa");
  const zgiecie = document.createElementNS(NS, "feDisplacementMap");
  zgiecie.setAttribute("in", "SourceGraphic");
  zgiecie.setAttribute("in2", "mapa");
  zgiecie.setAttribute("scale", String(Math.round(64 * moc)));
  zgiecie.setAttribute("xChannelSelector", "R");
  zgiecie.setAttribute("yChannelSelector", "G");
  f.append(obraz, zgiecie);
  miejsceNaFiltry().appendChild(f);
  gotowe.set(klucz, id);
  return id;
}

/**
 * Zakłada soczewkę na element i pilnuje jej przy zmianie rozmiaru (np. nazwa boiska
 * złamana na dwie linie robi taflę wyższą). Rozmycie i jasność są te same co w arkuszu,
 * dokładamy tylko zagięcie przed nimi.
 */
export function useSoczewka(
  ref: RefObject<HTMLElement | null>,
  r: number,
  { moc = 1, rozmycie = 9, jasnosc = 0.82 }: { moc?: number; rozmycie?: number; jasnosc?: number } = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ustaw = () => {
      const id = filtrSoczewki(Math.round(el.offsetWidth), Math.round(el.offsetHeight), r, moc);
      if (id) el.style.backdropFilter = `url(#${id}) blur(${rozmycie}px) saturate(1.7) brightness(${jasnosc})`;
    };
    ustaw();
    const obserwator = new ResizeObserver(ustaw);
    obserwator.observe(el);
    return () => obserwator.disconnect();
  }, [ref, r, moc, rozmycie, jasnosc]);
}
