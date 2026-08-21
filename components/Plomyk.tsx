import type { IdPoziomu } from "@/lib/odznaczenia";

/**
 * Płomyk na medalu odznaczenia - wspólny dla siatki na profilu i dla plakietek
 * w rankingu, żeby stopień wyglądał wszędzie tak samo.
 *
 * Kolory idą temperaturą: od przygaszonej iskry do bieli rozgrzanego metalu. Stopień
 * niezdobyty dostaje szarość, a nie przezroczystość - inaczej pusty medal wyglądałby
 * jak dziura w układzie.
 */
export const PLOMYK: Record<IdPoziomu, [string, string, string]> = {
  iskra: ["#6d3612", "#b06a38", "#dda877"],
  zar: ["#a81c03", "#f0400e", "#ff8a5c"],
  plomien: ["#e07f05", "#ffbe2a", "#fff0b8"],
  /*
    Najwyższy stopień idzie w niebieskie: przy naprawdę wysokiej temperaturze płomień
    przestaje być pomarańczowy i przechodzi w błękit, a rozgrzany do bieli metal świeci
    chłodnym światłem. Dzięki temu szczyt nie jest „jeszcze jaśniejszym pomarańczem",
    ale wyraźnie inną ligą.
  */
  "bialy-zar": ["#2f6bff", "#9dc3ff", "#ffffff"],
};

export function Plomyk({ poziom, uid }: { poziom: IdPoziomu | null; uid: string }) {
  const stops = poziom ? PLOMYK[poziom] : ["#3a3a42", "#4c4c56", "#6a6a76"];
  const id = `plomyk-${uid}`;

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0.35" y2="0">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.55" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <path
        d="M12 1.4c.5 2.2-.4 3.6-1.7 4.8-1.6 1.5-2.4 2.6-2.2 4.1.1.8.5 1.4.5 1.4s-1.4-.2-2-1.4c-1.3 1.6-1.7 3.2-1.7 4.6C4.9 19.6 8.1 22.6 12 22.6s7.1-3 7.1-7.7c0-4.6-3.2-6.6-4.4-9.1-.7-1.5-.9-3.1-2.7-4.4Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}
