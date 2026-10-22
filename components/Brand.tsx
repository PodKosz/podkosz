"use client";

import { useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { Znak } from "./Znak";
import { NapisPodkosz } from "./NapisPodkosz";

/**
 * Logo: znak (pinezka z piłką) i napis PODKOSZ - od 22.10.2026 znak słowny narysowany od zera
 * (`NapisPodkosz`), a nie tekst pisany czcionką. Oba w barwach ze zmiennych motywu.
 * Identyfikator z useId - dwa loga na stronie (nawigacja + panel) miały kiedyś ten sam `id`,
 * a `url(#…)` trafiał do tego ukrytego i ikona znikała.
 *
 * `powered` - pod napisem „Powered by” i logo Coconaut (tylko na mapie, w lewym górnym rogu).
 * Rząd ma szerokość napisu, a logo kończy się dokładnie na prawej krawędzi litery Z.
 */
export function Brand({ compact = false, powered = false }: { compact?: boolean; powered?: boolean }) {
  const id = useId().replace(/:/g, "");
  const wysokosc = compact ? 38 : 54;
  /* wysokość liter napisu: ok. 0,38 wysokości znaku - tyle co dawny napis 28 / 19 px */
  const litery = compact ? 14 : 20.5;

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
      <span className={`flex-col items-stretch text-ink ${compact ? "hidden sm:flex" : "flex"}`}>
        <NapisPodkosz uid={`brand-${id}`} wysokosc={litery} />
        {powered && (
          <span className="mt-[6px] flex items-center justify-end gap-[7px]">
            <span className="text-[7.5px] font-semibold uppercase leading-none tracking-[0.2em]">
              Powered by
            </span>
            {/* plik przycięty do krawędzi liter - inaczej pusty margines odsuwał logo od linii Z */}
            <Image
              src="/partnerzy/coconaut-logo-ciete.png"
              alt="Coconaut"
              width={52}
              height={10}
              className="h-[10px] w-auto"
            />
          </span>
        )}
      </span>
    </Link>
  );
}
