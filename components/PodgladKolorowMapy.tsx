"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSesja } from "@/lib/sesja";

/*
  TYMCZASOWE (23.10.2026) - podgląd 10 wariantów koloru mapy Polski na prawdziwej stronie
  głównej. Lokalnie mapa nie ma klucza CARTO i stoi na zapasowym podkładzie Esri, więc podgląd
  z `next dev` wyglądał inaczej niż strona - stąd ten panel na produkcji.

  Widać go tylko pod adresem `/?kolory-mapy` i tylko po zalogowaniu na konto administratora;
  nic nie zapisuje, przemalowuje wyłącznie mapę w tej jednej karcie przeglądarki. Po wyborze
  wariantu: wpisać go na stałe w MapView.tsx, a ten plik usunąć razem z uchwytem `__map`.
*/

type Wariant = {
  id: string;
  nazwa: string;
  opis: string;
  wypelnienie: [string, number];
  aktywne: [string, number];
  linia: [string, number, number, number?];
  podklad: [number, number];
  zar: string;
};

const WARIANTY: Wariant[] = [
  { id: "00", nazwa: "Obecny", opis: "dzisiejsza mapa - pomarańczowy odcień, do porównania", wypelnienie: ["#ff7a18", 0.06], aktywne: ["#ff7a18", 0.05], linia: ["#ffb25c", 0.35, 0.35], podklad: [-0.35, -12], zar: "" },
  { id: "01", nazwa: "Mgła", opis: "ledwo widoczna biel, cienkie białe granice, podkład bez koloru", wypelnienie: ["#ffffff", 0.04], aktywne: ["#ffffff", 0.06], linia: ["#ffffff", 0.22, 0.35], podklad: [-0.6, 0], zar: "255 255 255" },
  { id: "02", nazwa: "Szron", opis: "wyraźniejsze białe wypełnienie i granice", wypelnienie: ["#ffffff", 0.07], aktywne: ["#ffffff", 0.1], linia: ["#ffffff", 0.42, 0.5], podklad: [-0.5, 0], zar: "255 255 255" },
  { id: "03", nazwa: "Kreda", opis: "bez wypełnienia - same białe linie województw jak kredą", wypelnienie: ["#ffffff", 0], aktywne: ["#ffffff", 0.07], linia: ["#ffffff", 0.65, 0.7], podklad: [-0.7, 0], zar: "255 255 255" },
  { id: "04", nazwa: "Perła", opis: "chłodna perłowa szarość wypełnienia, delikatne granice", wypelnienie: ["#ececf2", 0.1], aktywne: ["#ffffff", 0.12], linia: ["#ffffff", 0.3, 0.4], podklad: [-0.45, 0], zar: "236 236 242" },
  { id: "05", nazwa: "Lód", opis: "biel z nutą błękitu, chłodny podkład", wypelnienie: ["#dce8ff", 0.07], aktywne: ["#e6efff", 0.1], linia: ["#cfe0ff", 0.45, 0.5], podklad: [-0.55, 12], zar: "207 224 255" },
  { id: "06", nazwa: "Grafit", opis: "podkład całkiem bez koloru, Polska w czystej bieli", wypelnienie: ["#ffffff", 0.05], aktywne: ["#ffffff", 0.08], linia: ["#ffffff", 0.3, 0.4], podklad: [-1, 0], zar: "255 255 255" },
  { id: "07", nazwa: "Neon bieli", opis: "bez wypełnienia, granice świecą jasną poświatą", wypelnienie: ["#ffffff", 0], aktywne: ["#ffffff", 0.06], linia: ["#ffffff", 0.9, 1, 1.5], podklad: [-0.6, 0], zar: "255 255 255" },
  { id: "08", nazwa: "Jasna Polska", opis: "kraj wyraźnie jaśniejszy od sąsiadów, granice prawie znikają", wypelnienie: ["#ffffff", 0.14], aktywne: ["#ffffff", 0.18], linia: ["#ffffff", 0.15, 0.35], podklad: [-0.6, 0], zar: "255 255 255" },
  { id: "09", nazwa: "Kość słoniowa", opis: "ciepła biel jak papier, lekko ocieplony podkład", wypelnienie: ["#f5efe3", 0.07], aktywne: ["#f5efe3", 0.1], linia: ["#f5efe3", 0.38, 0.45], podklad: [-0.4, -8], zar: "245 239 227" },
  { id: "10", nazwa: "Czysta biel", opis: "mocna biel wypełnienia i granic, podkład prawie szary", wypelnienie: ["#ffffff", 0.1], aktywne: ["#ffffff", 0.16], linia: ["#ffffff", 0.55, 0.6], podklad: [-0.8, 0], zar: "255 255 255" },
];

type Mapa = { getLayer(id: string): unknown; setPaintProperty(id: string, wl: string, w: unknown): void };

function zastosuj(w: Wariant): boolean {
  const m = (window as unknown as { __map?: Mapa }).__map;
  let styl = document.getElementById("podglad-kolorow-zar");
  if (!styl) {
    styl = document.createElement("style");
    styl.id = "podglad-kolorow-zar";
    document.head.appendChild(styl);
  }
  styl.textContent = w.zar ? `svg.zar-woj { --rgb-flame: ${w.zar}; --rgb-ember: ${w.zar}; --rgb-glow: ${w.zar}; }` : "";
  if (!m || !m.getLayer("woj-fill")) return false;
  m.setPaintProperty("woj-fill", "fill-color", w.wypelnienie[0]);
  m.setPaintProperty("woj-fill", "fill-opacity", w.wypelnienie[1]);
  m.setPaintProperty("woj-active", "fill-color", w.aktywne[0]);
  m.setPaintProperty("woj-active", "fill-opacity", w.aktywne[1]);
  m.setPaintProperty("woj-line", "line-color", w.linia[0]);
  m.setPaintProperty("woj-line", "line-opacity", w.linia[1]);
  m.setPaintProperty("woj-line", "line-width", w.linia[2]);
  m.setPaintProperty("woj-line", "line-blur", w.linia[3] ?? 0);
  if (m.getLayer("carto")) {
    m.setPaintProperty("carto", "raster-saturation", w.podklad[0]);
    m.setPaintProperty("carto", "raster-hue-rotate", w.podklad[1]);
  }
  return true;
}

const zAdresu = () => new URLSearchParams(window.location.search).has("kolory-mapy");
const subskrybuj = () => () => {};

export function PodgladKolorowMapy() {
  const sesja = useSesja();
  const wlaczony = useSyncExternalStore(subskrybuj, zAdresu, () => false);
  const [i, setI] = useState(1);

  /* mapa wstaje po chwili, a motyw potrafi przemalować warstwy - ponawiamy co dwie sekundy */
  useEffect(() => {
    if (!wlaczony || !sesja?.user?.isAdmin) return;
    zastosuj(WARIANTY[i]);
    const t = window.setInterval(() => zastosuj(WARIANTY[i]), 2000);
    return () => window.clearInterval(t);
  }, [wlaczony, sesja, i]);

  useEffect(() => {
    if (!wlaczony) return;
    const klawisz = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "ArrowRight") setI((n) => (n + 1) % WARIANTY.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + WARIANTY.length) % WARIANTY.length);
    };
    addEventListener("keydown", klawisz);
    return () => removeEventListener("keydown", klawisz);
  }, [wlaczony]);

  if (!wlaczony || !sesja?.user?.isAdmin) return null;
  const w = WARIANTY[i];

  return (
    <div
      style={{
        position: "fixed", zIndex: 90, right: 24, bottom: 24, width: "min(460px, calc(100vw - 32px))", padding: 12, borderRadius: 22,
        display: "grid", gap: 10, fontSize: 13, color: "#f4f4f6", background: "rgba(18,18,20,.86)", border: "1px solid rgba(255,255,255,.12)",
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: "0 18px 50px rgba(0,0,0,.55)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b76" }}>
        Kolor mapy Polski · ← → przełącza · widzisz tylko Ty
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {w.id} {w.nazwa}
        </div>
        <div style={{ color: "#a1a1aa", fontSize: 12 }}>{w.opis}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {WARIANTY.map((x, k) => (
          <button
            key={x.id}
            type="button"
            title={x.nazwa}
            onClick={() => setI(k)}
            style={{
              height: 30, minWidth: 38, padding: "0 10px", borderRadius: 9, fontSize: 12, fontWeight: 600,
              color: k === i ? "#0b0b0d" : "#a1a1aa", background: k === i ? "#f2f2f7" : "rgba(255,255,255,.05)",
            }}
          >
            {x.id}
          </button>
        ))}
      </div>
    </div>
  );
}
