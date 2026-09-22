"use client";

import { useLayoutEffect, useState } from "react";
import type { Wyroznienie } from "@/lib/odznaczenia";

/**
 * Stojak na piłki - wyróżnienia gracza.
 *
 * Zdobyte wyróżnienie to piłka w swojej barwie, pełna i podświetlona; niezdobyte - ta sama
 * piłka wygaszona do grafitu. Widać z odległości metra, ile ktoś ma i ile zostało, bez
 * czytania jednej liczby.
 *
 * Stojak i piłki są ZDJĘCIAMI, nie rysunkiem - i to była świadoma zmiana. Poprzednia wersja
 * rysowała jedno i drugie w SVG; działała, ale szkło złożone z gradientów zawsze wygląda na
 * gradienty, a piłka bez ziarna skóry jest kółkiem w kolorze. Pliki robi
 * `scripts/stojak-wyroznien.mjs` (stojak, z tłem wyciętym do przezroczystości) oraz
 * `scripts/pilki-wyroznien.mjs` (siedemnaście barwnych kul z arkusza dziewięciu szklanych
 * piłek, przestrojonych obrotem odcienia - dzięki temu wszystkie mają to samo światło
 * i wyglądają jak komplet, a nie zbieranina).
 *
 * Liczby niżej są w pikselach pliku stojaka i zamieniają się na PROCENTY, więc całość
 * skaluje się z szerokością kolumny i nie ma tu ani jednego piksela na sztywno.
 */

/*
  WERSJA GRAFIK W ADRESIE. Pliki stojaka i piłek mają stałe nazwy, a Vercel serwuje je
  z nagłówkiem `max-age=14400` - cztery godziny. Przy podmianie zawartości pod tym samym
  adresem przeglądarka przez te cztery godziny nie pyta serwera o nic i dalej rysuje stare
  piłki, choć na serwerze leżą już nowe. Zdarzyło się dokładnie to: wdrożenie było
  poprawne, suma kontrolna pliku na produkcji zgadzała się z nową, a na ekranie nadal
  siedziały poprzednie kule.

  Numer doklejony do adresu zmienia adres, więc pamięć podręczna nie ma czego dopasować.
  PRZY KAŻDYM PRZEGENEROWANIU GRAFIK TRZEBA GO PODNIEŚĆ - inaczej wróci ten sam objaw,
  a jest on mylący: wygląda jak niewdrożona zmiana, a nie jak stara kopia w przeglądarce.
*/
const WERSJA = 3;

/* ————— siatka odniesienia: piksele pliku `stojak.webp` ————— */
const PLIK_SZER = 1236;
const PLIK_WYS = 735;
/*
  GÓRNA KRAWĘDŹ ZESPOŁU PORĘCZY każdej półki - zmierzona w pliku, nie dobrana na oko.

  Każda półka to PARA rur, a nie jedna: piłka leży w korycie między nimi. Wcześniej liczyłem
  pozycję od rury dolnej i dwie górne półki wyszły dobrze, ale najniższa się rozjechała -
  widać ją najbardziej z góry, więc jej rury są rozsunięte o 66 px zamiast o 50, i piłka
  siadała o 19 px za nisko, z poręczą w poprzek środka.

  Górne krawędzie są rozstawione równo (146, 341, 534 - co ~194 px), więc to one są uczciwą
  kotwicą: perspektywa rozsuwa rury w parze, ale nie rusza początku półki.
*/
const KRAWEDZIE = [146, 341, 534];
/** ile piłek na kolejnych półkach, od góry */
const POLKI = [6, 6, 5];
/** wnętrze stojaka, między słupami */
const LEWO = 99;
const PRAWO = 1135;
const SREDNICA = 150;
/** o tyle środek piłki leży nad krawędzią półki, żeby poręcz zasłoniła jej dolną ćwiartkę */
const NAD_KRAWEDZIA = 19.6;

/** Środki piłek w procentach pliku - po kolei, od górnej półki, od lewej. */
function miejscaPilek(ile: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const ostatnia = KRAWEDZIE.length - 1;
  /* Ile piłek faktycznie ląduje na której półce. Nadmiar ponad pojemność dosiada się do
     dolnej - ciaśniej, ale w kadrze; lepsze to niż piłka poza stojakiem. */
  const naPolce = [...POLKI];
  const pojemnosc = POLKI.reduce((a, b) => a + b, 0);
  if (ile > pojemnosc) naPolce[ostatnia] += ile - pojemnosc;

  let zostalo = ile;
  KRAWEDZIE.forEach((krawedz, nr) => {
    const tyle = Math.min(naPolce[nr], zostalo);
    if (tyle <= 0) return;
    zostalo -= tyle;
    const krok = (PRAWO - LEWO) / tyle;
    for (let i = 0; i < tyle; i++) {
      out.push({
        x: ((LEWO + krok * (i + 0.5)) / PLIK_SZER) * 100,
        y: ((krawedz - NAD_KRAWEDZIA) / PLIK_WYS) * 100,
      });
    }
  });

  return out;
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
    const zamknij = () => {
      setPrzypieta(false);
      setNadKtora(null);
    };
    const obok = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".stojak-karta") && !t.closest?.(".stojak-scena")) zamknij();
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij();
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
  const zdobyte = lista.filter((w) => w.zdobyte).length;

  return (
    <div
      className="stojak-scena"
      role="group"
      aria-label={`Stojak z wyróżnieniami: ${zdobyte} z ${lista.length} zdobytych`}
      onMouseLeave={() => {
        if (!przypieta) setNadKtora(null);
      }}
    >
      {/*
        Osobna plansza w środku sceny, bo na telefonie stojak MUSI być szerszy niż ekran.
        Siedemnaście piłek w kolumnie o szerokości 327 px wychodzi po 38 px - za mało,
        żeby w którąkolwiek trafić palcem. Plansza dostaje więc minimalną szerokość i
        przesuwa się w bok, jak prawdziwa półka; scena tylko ją przycina i przewija.
      */}
      <div className="stojak-plansza">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="stojak-mebel"
          src={`/wyroznienia/stojak.webp?v=${WERSJA}`}
          alt=""
          width={PLIK_SZER}
          height={PLIK_WYS}
          aria-hidden
        />

        {lista.map((w, i) => {
          const p = miejsca[i];
          if (!p) return null;
          return (
            <button
              key={w.id}
              type="button"
              className={`stojak-pilka barwa-${w.barwa}${w.zdobyte ? " ma" : ""}${
                nadKtora === i ? " gorace" : ""
              }`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${(SREDNICA / PLIK_SZER) * 100}%`,
              }}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/wyroznienia/pilka-${w.zdobyte ? w.barwa : "zimna"}.webp?v=${WERSJA}`}
                alt=""
                width={320}
                height={320}
                loading="lazy"
                draggable={false}
              />
            </button>
          );
        })}

        {/*
          PIŁKA MA LEŻEĆ W STOJAKU, NIE NA NIM. Sam obrazek stojaka jest jednym plikiem pod
          spodem, więc każda piłka zasłaniała poręcz, o którą powinna się opierać - wyglądało
          to tak, jakby piłki były doklejone do zdjęcia. Tutaj kładziemy stojak DRUGI RAZ,
          przycięty maską do trzech pasów z CAŁYMI zespołami poręczy (zmierzonymi w pliku:
          147-199, 342-387, 535-597) - obie rury pary, nie tylko dolna. Szkło przechodzi
          więc przed dolną częścią piłki i ta wreszcie siedzi na półce.

          Drugi plik nie był potrzebny - ta sama grafika, tylko inaczej przycięta, a wszystko
          poza poręczami jest w niej i tak przezroczyste.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="stojak-przod"
          src={`/wyroznienia/stojak.webp?v=${WERSJA}`}
          alt=""
          width={PLIK_SZER}
          height={PLIK_WYS}
          aria-hidden
        />

        {/*
          A skoro poręcz jest przed piłką, to musi też świecić jej kolorem - inaczej kolorowa
          piłka stoi za bezbarwną szybą i cały efekt się rozjeżdża. Ta warstwa to plamy
          w barwach piłek, przycięte tą samą maską, więc widać je WYŁĄCZNIE na szkle poręczy.
        */}
        <div className="stojak-refleks" aria-hidden>
          {lista.map((w, i) => {
            const p = miejsca[i];
            if (!p || !w.zdobyte) return null;
            return (
              <span
                key={w.id}
                className={`barwa-${w.barwa}${nadKtora === i ? " gorace" : ""}`}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: `${(SREDNICA / PLIK_SZER) * 100}%`,
                }}
              />
            );
          })}
        </div>

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
                    /* Skrajne piłki dosuwają kartę do środka, żeby nie wyszła poza stojak. */
                    left: `${Math.min(Math.max(punkt.x, 17), 83)}%`,
                    bottom: `${100 - punkt.y + (SREDNICA / PLIK_WYS) * 50 + 1}%`,
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
    </div>
  );
}
