"use client";

import { useId } from "react";
import Link from "next/link";
import { Logotyp } from "./Logotyp";

/**
 * Logo w nawigacji i na mapie - zawsze pełny zestaw (`Logotyp`): znak, napis PODKOSZ i pod nim
 * „Powered by” z logo Coconaut. Od 22.10.2026 nie ma już odmiany bez napisu i podpisu - cały
 * komplet stoi na każdej podstronie i na telefonie.
 *
 * Na telefonie zestaw jest mniejszy (litery 16,7 px, znak 44 px), od progu `sm` taki jak na
 * mapie (20,5 px i 54 px).
 *
 * Identyfikator z useId - dwa loga na stronie (nawigacja + panel) miały kiedyś ten sam `id`,
 * a `url(#…)` trafiał do tego ukrytego i ikona znikała.
 */
export function Brand() {
  const id = useId().replace(/:/g, "");

  return (
    <Link href="/" aria-label="PodKosz - mapa boisk" className="flex w-fit transition hover:opacity-90">
      <Logotyp uid={`brand-${id}`} className="text-[16.7px] sm:text-[20.5px]" />
    </Link>
  );
}
