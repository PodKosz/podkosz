"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Losowanie boiska z kostką na środku ekranu.
 *
 * Wcześniej „losowe boisko" było zwykłym odnośnikiem do trasy, która odbijała na kartę
 * wylosowanego boiska. Działało, ale wyglądało jak zacięcie: klikasz i przez chwilę nic
 * się nie dzieje, bo losowanie i tak wymaga rundy do serwera. Ta chwila jest nie do
 * uniknięcia - można ją tylko opowiedzieć. Stąd kostka: to samo oczekiwanie, tylko
 * z widoczną przyczyną.
 *
 * Choreografia ma trzy takty:
 *   1. tło się rozmywa, obrys kostki rysuje się linia po linii,
 *   2. oczka zmieniają się co ósmą sekundy - to trwa dopóty, dopóki serwer nie odpowie,
 *      ale nie krócej niż `MIN_CZAS` (inaczej przy szybkim łączu kostka mrugnęłaby raz
 *      i zniknęła, co wygląda na usterkę, nie na losowanie),
 *   3. kostka zatrzymuje się na wylosowanej ściance, całość gaśnie i wchodzi karta boiska.
 *
 * Adres docelowy bierzemy z istniejącej trasy `/losowe`, tyle że przez `fetch`: trasa
 * odbija przekierowaniem, a `res.url` po podążeniu za nim jest gotowym adresem karty.
 * Dzięki temu losowanie zostaje w jednym miejscu na serwerze i nie ma drugiej kopii
 * reguł „nie powtarzaj boiska, które właśnie widzisz".
 */

/** Najkrótszy czas pokazywania kostki - poniżej tego przestaje wyglądać jak losowanie. */
const MIN_CZAS = 900;
/** Ile kostka stoi na wyniku, zanim strona się zmieni. */
const CZAS_WYNIKU = 420;
/** Jak długo gaśnie nakładka - musi zgadzać się z `.losowanie-znika` w globals.css. */
const CZAS_ZNIKANIA = 320;

/** Które oczka świecą na której ściance. Numery gniazd jak w `GNIAZDA` niżej. */
const SCIANKI: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Dziewięć pozycji w siatce 3×3 - z nich składa się każda ścianka. */
const GNIAZDA = [
  [34, 34],
  [50, 34],
  [66, 34],
  [34, 50],
  [50, 50],
  [66, 50],
  [34, 66],
  [50, 66],
  [66, 66],
];

type Faza = "losuje" | "wynik" | "znika";

export function useLosowanie() {
  const router = useRouter();
  const [faza, setFaza] = useState<Faza | null>(null);
  const [scianka, setScianka] = useState(5);
  const zegary = useRef<number[]>([]);

  useEffect(
    () => () => {
      zegary.current.forEach((z) => window.clearTimeout(z));
    },
    []
  );

  const losuj = useCallback(
    (adres: string) => {
      /*
        Przy wyłączonych animacjach w systemie nie zatrzymujemy nikogo kostką - to
        ozdoba, a nie treść, więc idziemy prosto na kartę boiska.
      */
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(adres);
        return;
      }

      setFaza("losuje");
      const start = performance.now();

      void (async () => {
        let cel = adres;
        try {
          /* trasa odbija przekierowaniem - po podążeniu za nim `res.url` to karta boiska */
          const res = await fetch(adres, { redirect: "follow" });
          if (res.ok || res.redirected) cel = new URL(res.url).pathname + new URL(res.url).search;
        } catch {
          /* brak sieci - i tak spróbujemy przejść, przeglądarka pokaże swój błąd */
        }

        const zostalo = Math.max(0, MIN_CZAS - (performance.now() - start));

        zegary.current.push(
          window.setTimeout(() => {
            setScianka(1 + Math.floor(Math.random() * 6));
            setFaza("wynik");

            zegary.current.push(
              window.setTimeout(() => {
                setFaza("znika");
                router.push(cel);
                zegary.current.push(
                  window.setTimeout(() => setFaza(null), CZAS_ZNIKANIA)
                );
              }, CZAS_WYNIKU)
            );
          }, zostalo)
        );
      })();
    },
    [router]
  );

  return { losuj, nakladka: faza ? <Kostka faza={faza} scianka={scianka} /> : null };
}

function Kostka({ faza, scianka }: { faza: Faza; scianka: number }) {
  /* w trakcie losowania oczka zmieniają się same; po wyniku stoją na wylosowanej ściance */
  const [migotanie, setMigotanie] = useState(5);

  useEffect(() => {
    if (faza !== "losuje") return;
    const zegar = window.setInterval(
      () => setMigotanie(1 + Math.floor(Math.random() * 6)),
      125
    );
    return () => window.clearInterval(zegar);
  }, [faza]);

  const widoczne = faza === "losuje" ? migotanie : scianka;
  const oczka = SCIANKI[widoczne] ?? SCIANKI[5];

  return (
    <div
      className={`losowanie ${faza === "znika" ? "losowanie-znika" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Losujemy boisko"
    >
      <div className={`losowanie-kostka ${faza === "wynik" ? "losowanie-kostka-stoi" : ""}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" aria-hidden>
          <defs>
            {/*
              Ten sam zabieg co w pozostałych obrysach na stronie: gradient liczony
              względem pudełka elementu, więc każda linia gaśnie na swoich końcach,
              zamiast urywać się przy krawędzi kadru.
            */}
            <linearGradient id="losowanie-linia" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,122,24,0.25)" />
              <stop offset="0.35" stopColor="rgba(255,178,92,0.95)" />
              <stop offset="0.7" stopColor="rgba(255,150,60,0.8)" />
              <stop offset="1" stopColor="rgba(255,122,24,0.25)" />
            </linearGradient>
            <radialGradient id="losowanie-oczko">
              <stop offset="0" stopColor="rgba(255,214,150,1)" />
              <stop offset="1" stopColor="rgba(255,122,24,0.85)" />
            </radialGradient>
          </defs>

          <rect
            className="losowanie-obrys"
            pathLength={1}
            x="14"
            y="14"
            width="72"
            height="72"
            rx="16"
            stroke="url(#losowanie-linia)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {GNIAZDA.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="4.6"
              fill="url(#losowanie-oczko)"
              className="losowanie-oczko"
              style={{ opacity: oczka.includes(i) ? 1 : 0 }}
            />
          ))}
        </svg>
      </div>

      <p className="losowanie-podpis">
        {faza === "losuje" ? "losujemy boisko" : "mamy je"}
      </p>
    </div>
  );
}
