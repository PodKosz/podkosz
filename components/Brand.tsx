"use client";

import { useId } from "react";
import Link from "next/link";
import { ZNAK } from "@/lib/znak";

/**
 * Logo: znak (tablica z obręczą i plecionką) i napis PODKOSZ.
 * Znak jest w gradiencie marki ze zmiennych motywu, więc w każdym motywie ma jego barwy.
 * Gradient i maska przerw mają identyfikatory z useId - dwa loga na stronie (nawigacja + panel) miały
 * wcześniej ten sam `id`, a `url(#…)` trafiał do tego ukrytego i ikona znikała.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const maskaId = `brand-znak-${id}`;
  const gradientId = `brand-gradient-${id}`;
  const wysokosc = compact ? 36 : 52;
  const [x, y, w, h] = ZNAK.viewBox.split(" ").map(Number);
  const g = ZNAK.grubosc;

  return (
    <Link
      href="/"
      aria-label="PodKosz - mapa boisk"
      className="flex items-center gap-3 transition hover:opacity-90"
    >
      <span
        className="grid place-items-center"
        style={{ filter: "drop-shadow(0 4px 14px rgb(var(--rgb-ember) / .35))" }}
      >
        <svg
          viewBox={ZNAK.viewBox}
          style={{ height: wysokosc, width: Math.round(wysokosc * ZNAK.proporcja) }}
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* gradient marki po przekątnej całego znaku - jeden dla wszystkich kresek, więc płynie przez nie ciągle */}
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + w} y2={y + h}>
              <stop offset="0" stopColor="var(--color-glow-soft)" />
              <stop offset="0.5" stopColor="var(--color-flame)" />
              <stop offset="1" stopColor="var(--color-ember-deep)" />
            </linearGradient>
            {/* obręcz i siatka wycinają przerwy w liniach tablicy tam, gdzie przechodzą przed nią */}
            <mask id={maskaId} maskUnits="userSpaceOnUse" x={x - 20} y={y - 20} width={w + 40} height={h + 40}>
              <rect x={x - 20} y={y - 20} width={w + 40} height={h + 40} fill="#fff" />
              <path d={ZNAK.siatka} fill="none" stroke="#000" strokeWidth={g.siatka + 2 * ZNAK.przerwa}
                    strokeLinecap="round" strokeLinejoin="round" />
              <path d={ZNAK.obrecz} fill="#000" stroke="#000" strokeWidth={g.obrecz + 2 * ZNAK.przerwa} />
            </mask>
          </defs>
          <g stroke={`url(#${gradientId})`} strokeLinecap="round" strokeLinejoin="round">
            <g mask={`url(#${maskaId})`}>
              <path d={ZNAK.tablica} strokeWidth={g.tablica} />
              <path d={ZNAK.kwadrat} strokeWidth={g.kwadrat} />
            </g>
            <path d={ZNAK.siatka} strokeWidth={g.siatka} />
            <path d={ZNAK.obrecz} strokeWidth={g.obrecz} />
          </g>
        </svg>
      </span>

      {/* na wąskich ekranach zostaje sam znak - inaczej pasek nawigacji nie mieści się w szerokości */}
      <span
        className={`font-bold leading-none tracking-tight ${
          compact ? "hidden text-[19px] sm:inline" : "text-[28px]"
        }`}
      >
        POD<span className="flame-text">KOSZ</span>
      </span>
    </Link>
  );
}
