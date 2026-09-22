"use client";

import { useEffect, useRef } from "react";
import { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { POLAND_BOUNDS, STYLE, fitPadding, pomalujWgMotywu } from "./MapView";

/**
 * Mapa pod zrzut kadru startowego (patrz `scripts/kadr-startowy.mjs`).
 *
 * Rysuje TEN SAM styl co mapa główna, pomalowany tą samą funkcją, ale bez niczego, co
 * nie skaluje się razem z geografią: bez pinezek i bez podpisów miast. Obrazek z tej strony
 * jest potem rozciągany do rozmiaru ekranu - tekst o stałej wielkości urósłby albo zmalał
 * razem z nim i przy podmianie na żywą mapę widać byłoby skok pisma. Podpisy wchodzą więc
 * razem z żywą mapą, a obrazek niesie tylko to, co leży na ziemi.
 *
 * Parametry w adresie:
 *   motyw  - classic | polska | coconaut
 *   w, h   - rozmiar płótna w pikselach CSS (większy niż ekran, z zapasem na inne proporcje)
 *   rw, rh - ekran wzorcowy danej klasy urządzeń; z niego liczymy przybliżenie tak, żeby
 *            na tym ekranie obrazek wszedł w skali 1:1
 *
 * Gdy wszystko się narysuje, na `window.__zrzut` ląduje geometria: szerokość i wysokość
 * granic Polski na płótnie. Z nich arkusz wylicza, jak rozciągnąć obrazek na dowolnym
 * ekranie, żeby Polska stała dokładnie tam, gdzie postawi ją `fitBounds`.
 */
export function ZrzutMapy() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const motyw = p.get("motyw") ?? "classic";
    const w = Number(p.get("w") ?? 1200);
    const h = Number(p.get("h") ?? 900);
    const rw = Number(p.get("rw") ?? w);
    const rh = Number(p.get("rh") ?? h);

    if (motyw !== "classic") document.documentElement.dataset.motyw = motyw;
    const el = ref.current;
    if (!el) return;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    // worker ustawia już import `./MapView` - ten sam, co dla mapy głównej
    const map = new MlMap({
      container: el,
      style: STYLE,
      center: [19, 52],
      zoom: 5,
      interactive: false,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      fadeDuration: 0,
    });

    /* granice Polski w pikselach płótna przy bieżącym przybliżeniu */
    const granice = () => {
      const [zach, pld, wsch, pln] = POLAND_BOUNDS;
      const a = map.project([zach, pld]);
      const b = map.project([wsch, pln]);
      return { bw: b.x - a.x, bh: a.y - b.y };
    };

    map.once("load", () => {
      for (const w of ["miasta-kropka", "miasta-nazwa"]) {
        if (map.getLayer(w)) map.setLayoutProperty(w, "visibility", "none");
      }
      pomalujWgMotywu(map);

      /*
        Środek kadru to środek granic w rzucie mapy - tak samo liczy go `fitBounds`, który
        potem ustawia żywą mapę. Przybliżenie: takie, przy którym na ekranie wzorcowym
        granice wypełniają obszar między marginesami, czyli dokładnie to, co zrobi mapa.
      */
      const kamera = map.cameraForBounds(POLAND_BOUNDS, { padding: 0 });
      const { bw, bh } = granice();
      const pad = fitPadding(rw);
      const skala = Math.min(
        (rw - pad.left - pad.right) / bw,
        (rh - pad.top - pad.bottom) / bh
      );
      map.jumpTo({ center: kamera?.center, zoom: map.getZoom() + Math.log2(skala) });

      const gotowe = () => {
        if (!map.areTilesLoaded()) return;
        map.off("idle", gotowe);
        const zrodlo = map.getSource("carto") as { tiles?: string[] } | undefined;
        (window as unknown as { __zrzut: object }).__zrzut = {
          ...granice(),
          w,
          h,
          zoom: map.getZoom(),
          // skrypt sprawdza, czy to ten sam podkład co na produkcji (CARTO, nie zapasowe Esri)
          podklad: new URL(zrodlo?.tiles?.[0] ?? "http://brak").hostname,
        };
      };
      map.on("idle", gotowe);
    });

    return () => map.remove();
  }, []);

  return <div ref={ref} id="zrzut" style={{ position: "absolute", left: 0, top: 0 }} />;
}
