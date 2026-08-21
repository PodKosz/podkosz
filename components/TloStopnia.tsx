import type { IdPoziomu } from "@/lib/odznaczenia";

/**
 * Motyw stopnia w tle medalu, pod ikoną odznaczenia.
 *
 * Sama barwa płytki mówi o poziomie, ale przy mniejszych rozmiarach kolory zaczynają się
 * zlewać. Dlatego każdy stopień dostaje jeszcze własny znak: iskry, rozżarzone kamyczki,
 * płomień i - na szczycie - błękitne płomienie. Znak jest przygaszony i leży pod ikoną,
 * więc nie walczy z nią o uwagę, ale rozpoznaje się go kątem oka.
 */

const ISKRA = (
  <g fill="currentColor">
    {/* trzy iskierki i dwa pyłki - najlichszy stopień ma być ledwo ciepły */}
    <path d="M6.4 5.2l.62 1.5 1.5.62-1.5.62-.62 1.5-.62-1.5-1.5-.62 1.5-.62z" />
    <path d="M17.2 8.4l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" />
    <path d="M11.4 17.6l.44 1.05 1.05.44-1.05.44-.44 1.05-.44-1.05-1.05-.44 1.05-.44z" />
    <circle cx="8.8" cy="13.4" r=".62" />
    <circle cx="15.4" cy="16.2" r=".5" />
  </g>
);

const ZAR = (
  <g fill="currentColor">
    {/* kamyczki żaru leżą na dnie i tam się rozgrzewają */}
    <ellipse cx="7.6" cy="17.8" rx="3.1" ry="2.1" />
    <ellipse cx="13.2" cy="19" rx="2.5" ry="1.7" />
    <ellipse cx="17.4" cy="17" rx="2.1" ry="1.5" />
    <ellipse cx="10.6" cy="14.8" rx="1.7" ry="1.2" />
  </g>
);

/** Płomień - ten sam kształt, którym rysujemy ogień w całym serwisie. */
const KSZTALT_PLOMIENIA =
  "M12 2.4c.66 2.4-.55 3.85-1.98 5.17-1.87 1.76-2.86 3.19-2.64 5.06.11.99.66 1.76.66 1.76s-1.65-.33-2.42-1.76C4.28 14.3 3.84 16.06 3.84 17.6c0 3.08 3.74 5.39 8.36 5.39s8.36-2.31 8.36-5.39c0-5.06-3.74-7.26-5.17-10.01C14.62 5.94 14.29 4.07 12 2.4Z";

const PLOMIEN = <path d={KSZTALT_PLOMIENIA} fill="currentColor" />;

const BIALY_ZAR = (
  <g fill="currentColor">
    {/* dwa smukłe płomienie - szczyt pali się na zimno, więc i ogień jest inny */}
    <path d={KSZTALT_PLOMIENIA} transform="translate(3.4 5.6) scale(0.52)" />
    <path d={KSZTALT_PLOMIENIA} transform="translate(11 3.6) scale(0.62)" />
  </g>
);

const MOTYWY: Record<IdPoziomu, React.ReactNode> = {
  iskra: ISKRA,
  zar: ZAR,
  plomien: PLOMIEN,
  "bialy-zar": BIALY_ZAR,
};

export function TloStopnia({ poziom }: { poziom: IdPoziomu | null }) {
  if (!poziom) return null;

  return (
    <svg viewBox="0 0 24 24" className="medal-tlo" aria-hidden>
      {MOTYWY[poziom]}
    </svg>
  );
}
