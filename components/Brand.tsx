"use client";

import { useId } from "react";
import Link from "next/link";
import { ZNAK } from "@/lib/znak";

/**
 * Logo: znak (tablica z obręczą i plecionką) i napis PODKOSZ.
 * Znak ma kolor tekstu, jak „POD" - w motywie ciemnym jest biały, w jasnych ciemny.
 * Maska przerw ma identyfikator z useId - dwa loga na stronie (nawigacja + panel) miały
 * wcześniej ten sam `id`, a `url(#…)` trafiał do tego ukrytego i ikona znikała.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  const maskaId = `brand-znak-${useId()}`;
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
            {/* obręcz i siatka wycinają przerwy w liniach tablicy tam, gdzie przechodzą przed nią */}
            <mask id={maskaId} maskUnits="userSpaceOnUse" x={x - 20} y={y - 20} width={w + 40} height={h + 40}>
              <rect x={x - 20} y={y - 20} width={w + 40} height={h + 40} fill="#fff" />
              <path d={ZNAK.siatka} fill="none" stroke="#000" strokeWidth={g.siatka + 2 * ZNAK.przerwa}
                    strokeLinecap="round" strokeLinejoin="round" />
              <path d={ZNAK.obrecz} fill="#000" stroke="#000" strokeWidth={g.obrecz + 2 * ZNAK.przerwa} />
            </mask>
          </defs>
          <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
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
