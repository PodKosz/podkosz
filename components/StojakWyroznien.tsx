"use client";

import { useLayoutEffect, useState } from "react";
import type { Wyroznienie } from "@/lib/odznaczenia";

/**
 * Stojak na piłki - wyróżnienia gracza.
 *
 * Zamiast siatki kafelków: szklany stojak, na którym leżą piłki do koszykówki. Zdobyte
 * wyróżnienie to piłka w swojej barwie, pełna i podświetlona; niezdobyte - ta sama piłka
 * wygaszona do grafitu. Dzięki temu widać z odległości metra, ile ktoś ma, a ile zostało,
 * i nie trzeba do tego ani jednej liczby.
 *
 * Wszystko jest rysowane, nie wgrane. Siedemnaście zdjęć piłek w ośmiu barwach ważyłoby
 * kilka megabajtów, nie dałoby się ich przemalować razem ze skórką serwisu i każda zmiana
 * liczby wyróżnień wymagałaby nowej grafiki. Tu wystarczy dopisać wiersz do listy.
 */

/* ————— geometria stojaka —————
   Wszystko w jednostkach rysunku; SVG skaluje się do szerokości kolumny, więc te liczby
   są proporcjami, a nie pikselami. */
const SZER = 1000;
const WYS = 560;
const PROMIEN = 46;
/** ile piłek w kolejnych półkach, od góry */
const POLKI = [6, 6, 5];
/** wysokość blatu każdej półki */
const POZIOMY = [200, 340, 480];
/** piłka leży na półce: środek tyle nad blatem, żeby przednia poręcz zasłoniła jej spód */
const NAD_BLATEM = 34;
const LEWY_SLUP = 60;
const PRAWY_SLUP = 940;
/** obszar, po którym rozkładają się piłki */
const OD = 110;
const DO = 890;

/** Środki piłek, po kolei - najpierw górna półka, od lewej. */
function miejscaPilek(ile: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let zostalo = ile;

  POLKI.forEach((wRzedzie, nr) => {
    const tyle = Math.min(wRzedzie, zostalo);
    if (tyle <= 0) return;
    zostalo -= tyle;
    const krok = (DO - OD) / tyle;
    for (let i = 0; i < tyle; i++) {
      out.push({ x: OD + krok * (i + 0.5), y: POZIOMY[nr] - NAD_BLATEM });
    }
  });

  /* Gdyby wyróżnień przybyło ponad pojemność półek, reszta dołącza do ostatniego rzędu -
     lepiej ciaśniej niż niewidocznie. */
  while (zostalo > 0) {
    const krok = (DO - OD) / (POLKI[POLKI.length - 1] + zostalo);
    out.push({
      x: OD + krok * (POLKI[POLKI.length - 1] + zostalo - 0.5),
      y: POZIOMY[POZIOMY.length - 1] - NAD_BLATEM,
    });
    zostalo--;
  }

  return out;
}

/** Szklana rura - pozioma poręcz albo pionowy słup. */
function Rura({
  x,
  y,
  w,
  h,
  rx,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}) {
  const r = rx ?? Math.min(w, h) / 2;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#stojak-szklo)" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke="url(#stojak-krawedz)"
        strokeWidth="1.2"
      />
      {/* wąski połysk tuż pod górną krawędzią - to on robi ze zwykłego prostokąta szkło */}
      <rect
        x={x + r * 0.5}
        y={y + Math.min(h * 0.16, 3)}
        width={Math.max(w - r, 0)}
        height={Math.max(Math.min(h * 0.22, 3), 1)}
        rx={1.5}
        fill="rgba(255,255,255,.5)"
      />
    </>
  );
}

export function StojakWyroznien({ lista }: { lista: Wyroznienie[] }) {
  const miejsca = miejscaPilek(lista.length);

  const [nadKtora, setNadKtora] = useState<number | null>(null);
  const [przypieta, setPrzypieta] = useState(false);
  const [szuflada, setSzuflada] = useState(false);

  /* Poniżej 640 px karta nie ma gdzie stanąć nad piłką - siada jako szuflada na dole. */
  useLayoutEffect(() => {
    const pytanie = window.matchMedia("(max-width: 640px)");
    const ustaw = () => setSzuflada(pytanie.matches);
    ustaw();
    pytanie.addEventListener("change", ustaw);
    return () => pytanie.removeEventListener("change", ustaw);
  }, []);

  useLayoutEffect(() => {
    if (!przypieta) return;
    const obok = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".stojak-karta") && !t.closest?.(".stojak")) {
        setPrzypieta(false);
        setNadKtora(null);
      }
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPrzypieta(false);
        setNadKtora(null);
      }
    };
    document.addEventListener("click", obok);
    document.addEventListener("keydown", klawisz);
    return () => {
      document.removeEventListener("click", obok);
      document.removeEventListener("keydown", klawisz);
    };
  }, [przypieta]);

  const wybrana = nadKtora !== null ? lista[nadKtora] : null;
  const punkt = nadKtora !== null ? miejsca[nadKtora] : null;

  return (
    <div className="stojak-scena">
      <svg
        className="stojak"
        viewBox={`0 0 ${SZER} ${WYS}`}
        role="group"
        aria-label={`Stojak z wyróżnieniami: ${lista.filter((w) => w.zdobyte).length} z ${
          lista.length
        } zdobytych`}
        onMouseLeave={() => {
          if (!przypieta) setNadKtora(null);
        }}
      >
        <defs>
          {/* szkło rury: jasno u góry, ciemniej w środku, odbicie od spodu */}
          <linearGradient id="stojak-szklo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--rgb-szyba) / .26)" />
            <stop offset=".38" stopColor="rgb(var(--rgb-szyba) / .07)" />
            <stop offset=".72" stopColor="rgb(var(--rgb-szyba) / .04)" />
            <stop offset="1" stopColor="rgb(var(--rgb-szyba) / .16)" />
          </linearGradient>
          <linearGradient id="stojak-krawedz" x1="0" y1="0" x2=".4" y2="1">
            <stop offset="0" stopColor="rgb(var(--rgb-szyba) / .55)" />
            <stop offset=".5" stopColor="rgb(var(--rgb-szyba) / .1)" />
            <stop offset="1" stopColor="rgb(var(--rgb-szyba) / .3)" />
          </linearGradient>

          {/* poświata pod zdobytą piłką - barwę podaje każda piłka osobno przez `--b` */}
          <filter id="stojak-luna" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          {/*
            BARWA PIŁKI IDZIE WPROST NA KSZTAŁT, a nie przez gradient, i to nie jest
            drobiazg. Zmienne CSS dziedziczą po drzewie dokumentu, więc przystanki
            gradientu siedzącego w `<defs>` widzą `--b` ustawione na `<svg>`, a NIE na
            elemencie, który ten gradient wskazuje. Osiem barw wyróżnień znaczyłoby osiem
            gradientów z wpisanymi na sztywno wartościami - czyli paletę w dwóch miejscach.

            Zamiast tego piłka to krążek w płaskiej barwie, a objętość robią dwie warstwy
            BEZBARWNE: światło z góry z lewej i cień od dołu z prawej. Obie działają na
            każdym kolorze, więc paleta zostaje tam, gdzie była - w `.barwa-*` w arkuszu.
          */}
          <radialGradient id="stojak-swiatlo" cx="34%" cy="26%" r="72%">
            <stop offset="0" stopColor="#fff" stopOpacity=".3" />
            <stop offset=".4" stopColor="#fff" stopOpacity=".05" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="stojak-cien-pilki" cx="66%" cy="84%" r="66%">
            <stop offset="0" stopColor="#000" stopOpacity=".62" />
            <stop offset=".54" stopColor="#000" stopOpacity=".22" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ————— słupy boczne z wygiętą górą ————— */}
        {[LEWY_SLUP, PRAWY_SLUP].map((x, i) => {
          const zewn = i === 0 ? x - 8 : x + 8;
          const wewn = i === 0 ? x + 46 : x - 46;
          return (
            <g key={x}>
              <path
                d={`M${zewn} ${WYS - 46} V132 Q${zewn} 78 ${(zewn + wewn) / 2} 78 Q${wewn} 78 ${wewn} 132 V${POZIOMY[0] - 6}`}
                fill="none"
                stroke="url(#stojak-krawedz)"
                strokeWidth="13"
                strokeLinecap="round"
                opacity=".9"
              />
              <path
                d={`M${zewn} ${WYS - 46} V132 Q${zewn} 78 ${(zewn + wewn) / 2} 78 Q${wewn} 78 ${wewn} 132 V${POZIOMY[0] - 6}`}
                fill="none"
                stroke="rgba(255,255,255,.38)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* stopka */}
              <Rura x={zewn - 11} y={WYS - 50} w={22} h={22} rx={7} />
            </g>
          );
        })}

        {/* ————— półki: tylna poręcz, piłki, przednia poręcz ————— */}
        {POZIOMY.map((blat) => (
          <g key={blat}>
            {/*
              Tylna krawędź półki: cieńsza i ciut wyżej od przedniej, przez co czyta się
              jako dalsza. Wcześniej stała 64 jednostki wyżej i przecinała piłki w jednej
              trzeciej wysokości - wyglądała jak pręt wbity w piłkę, a nie jak tył półki.
            */}
            <Rura x={LEWY_SLUP + 4} y={blat - 13} w={PRAWY_SLUP - LEWY_SLUP - 8} h={8} />
            {/* ukośne wsporniki przy słupach */}
            <path
              d={`M${LEWY_SLUP + 6} ${blat + 6} L${LEWY_SLUP + 54} ${blat - 52}`}
              stroke="url(#stojak-krawedz)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M${PRAWY_SLUP - 6} ${blat + 6} L${PRAWY_SLUP - 54} ${blat - 52}`}
              stroke="url(#stojak-krawedz)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            {/* przednia poręcz idzie PO piłkach - jest dorysowana niżej, za ich pętlą */}
          </g>
        ))}

        {/* ————— piłki ————— */}
        {lista.map((w, i) => {
          const p = miejsca[i];
          if (!p) return null;
          const aktywna = nadKtora === i;
          return (
            <g
              key={w.id}
              className={`stojak-pilka barwa-${w.barwa}${w.zdobyte ? " ma" : ""}${
                aktywna ? " gorace" : ""
              }`}
              tabIndex={0}
              role="button"
              aria-label={`${w.nazwa} - ${w.zdobyte ? "zdobyte" : "jeszcze nie zdobyte"}`}
              onMouseEnter={() => {
                if (!przypieta) setNadKtora(i);
              }}
              onFocus={() => setNadKtora(i)}
              onClick={(e) => {
                e.stopPropagation();
                if (przypieta && nadKtora === i) {
                  setPrzypieta(false);
                  setNadKtora(null);
                  return;
                }
                setNadKtora(i);
                setPrzypieta(true);
              }}
            >
              {w.zdobyte && (
                <circle
                  className="stojak-luna"
                  cx={p.x}
                  cy={p.y}
                  r={PROMIEN * 1.06}
                  fill="rgb(var(--b) / .5)"
                  filter="url(#stojak-luna)"
                />
              )}

              <circle
                cx={p.x}
                cy={p.y}
                r={PROMIEN}
                fill={w.zdobyte ? "rgb(var(--b))" : "#252A33"}
              />
              <circle cx={p.x} cy={p.y} r={PROMIEN} fill="url(#stojak-cien-pilki)" />
              <circle cx={p.x} cy={p.y} r={PROMIEN} fill="url(#stojak-swiatlo)" />

              {/* szwy: pion, poziom i dwa łuki wciśnięte do środka na równiku */}
              <g
                className="stojak-szwy"
                fill="none"
                stroke="#0B0D11"
                strokeOpacity={w.zdobyte ? 0.72 : 0.55}
                strokeWidth="2.6"
                strokeLinecap="round"
              >
                <path d={`M${p.x} ${p.y - PROMIEN} V${p.y + PROMIEN}`} />
                <path d={`M${p.x - PROMIEN} ${p.y} H${p.x + PROMIEN}`} />
                <path
                  d={`M${p.x - PROMIEN * 0.7} ${p.y - PROMIEN * 0.71} Q${p.x - PROMIEN * 0.12} ${p.y} ${p.x - PROMIEN * 0.7} ${p.y + PROMIEN * 0.71}`}
                />
                <path
                  d={`M${p.x + PROMIEN * 0.7} ${p.y - PROMIEN * 0.71} Q${p.x + PROMIEN * 0.12} ${p.y} ${p.x + PROMIEN * 0.7} ${p.y + PROMIEN * 0.71}`}
                />
              </g>

              {/* refleks - mały, bo duży zamienia skórę w plastik */}
              <ellipse
                cx={p.x - PROMIEN * 0.34}
                cy={p.y - PROMIEN * 0.42}
                rx={PROMIEN * 0.3}
                ry={PROMIEN * 0.2}
                fill="rgba(255,255,255,.2)"
                transform={`rotate(-28 ${p.x - PROMIEN * 0.34} ${p.y - PROMIEN * 0.42})`}
              />
            </g>
          );
        })}

        {/* ————— przednie poręcze, już PO piłkach ————— */}
        {POZIOMY.map((blat) => (
          <g key={`przod-${blat}`}>
            <Rura x={LEWY_SLUP + 2} y={blat} w={PRAWY_SLUP - LEWY_SLUP - 4} h={15} />
          </g>
        ))}
      </svg>

      {wybrana && punkt && (
        <div
          className={`stojak-karta widac barwa-${wybrana.barwa}${
            przypieta ? " przypieta" : ""
          }`}
          role="dialog"
          aria-label={wybrana.nazwa}
          style={
            szuflada
              ? undefined
              : {
                  /* Procenty, nie piksele: rysunek skaluje się do szerokości kolumny,
                     więc tylko udział w niej jest niezmienny. Skrajne piłki dosuwają
                     kartę do środka, żeby nie wyszła poza kolumnę. */
                  left: `${Math.min(Math.max((punkt.x / SZER) * 100, 17), 83)}%`,
                  bottom: `${((WYS - (punkt.y - PROMIEN)) / WYS) * 100 + 2}%`,
                }
          }
        >
          <div className="stojak-karta-gora">
            <span className="stojak-karta-kropka" />
            <div>
              <h3>{wybrana.nazwa}</h3>
              <p className="stojak-karta-stan">
                {wybrana.zdobyte ? "Zdobyte" : "Jeszcze nie zdobyte"}
              </p>
            </div>
          </div>
          <p className="stojak-karta-opis">
            {wybrana.zdobyte ? wybrana.opis : wybrana.warunek}
          </p>
        </div>
      )}
    </div>
  );
}
