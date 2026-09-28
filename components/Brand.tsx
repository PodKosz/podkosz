"use client";

import { useId } from "react";
import Link from "next/link";
import { Znak } from "./Znak";

/**
 * Logo: znak (pinezka z planem połowy boiska) i napis PODKOSZ.
 * Znak jest w gradiencie ze zmiennych motywu, więc w każdym motywie ma jego barwy.
 * Identyfikator z useId - dwa loga na stronie (nawigacja + panel) miały kiedyś ten sam `id`,
 * a `url(#…)` trafiał do tego ukrytego i ikona znikała.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  const wysokosc = compact ? 38 : 54;

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
        <Znak uid={`brand-${id}`} wysokosc={wysokosc} rozmiar="maly" />
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
