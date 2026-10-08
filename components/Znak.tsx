import { ZNAK } from "@/lib/znak";

/**
 * Znak PodKosza (pinezka z piłką do koszykówki) jako SVG w Reakcie - bez hooków, więc działa i na
 * serwerze (zasłona), i w komponentach klienta (`Brand` podaje `uid` z useId).
 *
 * Gradient bierze barwy z motywu (`--color-*`), jak dawne logo: w motywie klasycznym daje dokładnie
 * pomarańcz wybranej wersji, w „polska" i „coconaut" przechodzi w ich kolory. Pierwszy przystanek
 * to barwa blasku rozjaśniona bielą - kremowy początek z wersji wybranej na ikonę.
 *
 * `uid` musi być unikalny na stronie: gradient i przycięcie są odwołaniami `url(#…)`, a dwa znaki
 * z tym samym id sięgałyby po definicje pierwszego z nich.
 */
export function Znak({
  uid,
  wysokosc,
  rozmiar = "maly",
  className,
  style,
}: {
  uid: string;
  /** bez wysokości rozmiar ustalają klasy (`className`), np. responsywnie */
  wysokosc?: number;
  rozmiar?: "duzy" | "maly";
  className?: string;
  style?: React.CSSProperties;
}) {
  const g = ZNAK.grubosc[rozmiar];
  const gr = ZNAK.gradient;
  const stopy: [number, string][] = [
    [0, "color-mix(in srgb, var(--color-glow-soft) 40%, #fff)"],
    [0.2, "var(--color-glow-soft)"],
    [0.48, "var(--color-flame)"],
    [0.76, "var(--color-ember)"],
    [1, "var(--color-ember-deep)"],
  ];
  const gradient = `znak-g-${uid}`;
  const klip = `znak-c-${uid}`;

  return (
    <svg
      viewBox={ZNAK.viewBox}
      style={wysokosc ? { height: wysokosc, width: Math.round(wysokosc * ZNAK.proporcja), ...style } : style}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={gr.x1} y1={gr.y1} x2={gr.x2} y2={gr.y2}>
          {stopy.map(([o, c]) => (
            <stop key={o} offset={o} style={{ stopColor: c }} />
          ))}
        </linearGradient>
        <clipPath id={klip}>
          <path d={ZNAK.rama} />
        </clipPath>
      </defs>
      <g stroke={`url(#${gradient})`} strokeLinecap="round" strokeLinejoin="round">
        {/* szwy piłki przycięte do wnętrza pinezki - końce chowają się pod jej obrysem */}
        <g clipPath={`url(#${klip})`}>
          {ZNAK.szwy.map((d) => (
            <path key={d} d={d} strokeWidth={g.szwy} />
          ))}
        </g>
        <path d={ZNAK.rama} strokeWidth={g.rama} />
      </g>
    </svg>
  );
}
