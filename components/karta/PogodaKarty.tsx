import { SCENE_LABEL, type WeatherHour, weatherScene, weatherVerdict } from "@/lib/pogoda";
import { IkNiebo } from "./ikony";

/** Wysokość pola wykresu w pikselach - linia temperatury i słupki opadu dzielą je między siebie. */
const H = 72;

/**
 * Godziny do wykresu: bieżąca i kolejne co dwie, zawsze sześć - także nocą i przez północ
 * (prognoza obejmuje dziś i jutro). Wcześniej wykres kończył się na 22:00, więc wieczorem
 * zostawała z niego jedna kropka. `teraz` to „2026-10-23T21” w czasie polskim.
 */
function godzinyWykresu(all: WeatherHour[], teraz: string) {
  const start = all.findIndex((h) => h.czas.slice(0, 13) >= teraz);
  if (start < 0) return [];
  return all.slice(start).filter((_, i) => i % 2 === 0).slice(0, 6);
}

const mm = (n: number) => `${n.toFixed(1).replace(".", ",")} mm`;

/**
 * Pogoda na karcie boiska (prototyp 03): duża temperatura na teraz, zdanie „jadę czy nie
 * jadę" i wykres - linia temperatury z kropkami, pod nią słupki opadu, na dole godziny
 * z ikoną nieba. Rysowane na serwerze, prognoza jest wspólna dla wszystkich.
 */
export function PogodaKarty({ hours, teraz: kluczTeraz }: { hours: WeatherHour[]; teraz: string }) {
  const g = godzinyWykresu(hours, kluczTeraz);
  /* pierwsza godzina następnego dnia dostaje podpis „jutro” - inaczej 00:00 po 22:00 myli */
  const pierwszaJutro = g.findIndex((x) => x.czas.slice(0, 10) !== g[0]?.czas.slice(0, 10));
  if (!g.length) return null;

  const teraz = g[0];
  const scena = weatherScene(teraz.code);
  const tMin = Math.min(...g.map((x) => x.temp));
  const tMax = Math.max(...g.map((x) => x.temp));
  const oMax = Math.max(0.1, ...g.map((x) => x.rain));
  const y = (t: number) => (tMax === tMin ? 30 : 24 + (1 - (t - tMin) / (tMax - tMin)) * 16);

  const szer = g.length * 100;
  const punkty = g.map((x, i) => [i * 100 + 50, y(x.temp)] as const);
  const linia = punkty.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
  const pole = `${linia} L${punkty[punkty.length - 1][0]} ${H} L${punkty[0][0]} ${H} Z`;
  const kolumny = { gridTemplateColumns: `repeat(${g.length}, minmax(0, 1fr))` };

  return (
    <section className="kb-sekcja" aria-labelledby="pogoda-tytul">
      <div className="kb-karta px-5 pb-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="pogoda-tytul" className="kb-tytul">
            Pogoda
          </h2>
          <span className="text-[12px] text-faint">Wiatr do {Math.max(...g.map((x) => x.wind))} km/h</span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <span className="font-display text-[56px] leading-[0.9] tabular-nums">{teraz.temp}°</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <IkNiebo scena={scena} dzien={teraz.day} className="h-4 w-4" />
              {String(teraz.hour).padStart(2, "0")}:00 · {SCENE_LABEL[scena]}
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug">{weatherVerdict(g)}</p>
          </div>
        </div>

        <div className="mt-5" aria-hidden>
          <div className="relative" style={{ height: H }}>
            <svg viewBox={`0 0 ${szer} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id="kb-pogoda-pole" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--color-ink)" stopOpacity="0.1" />
                  <stop offset="1" stopColor="var(--color-ink)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={pole} fill="url(#kb-pogoda-pole)" />
              <path
                d={linia}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="1.8"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="absolute inset-0 grid" style={kolumny}>
              {g.map((x) => (
                <div key={x.czas} className="relative">
                  <span
                    className="kb-opad"
                    style={{ height: x.rain >= 0.1 ? Math.max(4, Math.round((x.rain / oMax) * 26)) : 2 }}
                  />
                  <span
                    className="absolute inset-x-0 text-center text-[12.5px] font-semibold tabular-nums"
                    style={{ top: y(x.temp) - 24 }}
                  >
                    {x.temp}°
                  </span>
                  <span className="kb-kropka" style={{ top: y(x.temp) }} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 grid border-t border-[var(--k-linia)] pt-2" style={kolumny}>
            {g.map((x, i) => (
              <div key={x.czas} className="flex flex-col items-center gap-[3px] text-center">
                <IkNiebo scena={weatherScene(x.code)} dzien={x.day} className="h-4 w-4 text-muted" />
                <span className="text-[12px] font-semibold tabular-nums">{String(x.hour).padStart(2, "0")}:00</span>
                <span className="whitespace-nowrap text-[11px] tabular-nums text-faint">
                  {x.rain >= 0.1 ? mm(x.rain) : "sucho"}
                </span>
                {i === pierwszaJutro && <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">jutro</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
