"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VOIVODESHIPS } from "@/lib/types";
import { linkNaMape } from "@/lib/site";

/**
 * Stopka z dokumentami i odnośnikami do podstron województw. Na stronie głównej jej nie ma,
 * bo mapa zajmuje dokładnie wysokość okna i stopka zrobiłaby z niej przewijaną stronę.
 *
 * Odnośniki do województw prowadzą na mapę, nie na podstronę regionalną. Człowiek, który
 * klika „Mazowieckie" pod nagłówkiem „Boiska po województwach", chce zobaczyć te boiska -
 * a mapa z dolotem do regionu i podświetlonym obrysem odpowiada na to lepiej niż lista.
 * Podstrony `/wojewodztwo/...` zostają dla wyszukiwarek: są w `sitemap.ts` i linkują się
 * wzajemnie, więc nie tracą ścieżki indeksowania.
 */
export function SiteFooter() {
  const path = usePathname();
  if (path === "/" || path.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-hairline px-6 pb-10 pt-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Boiska po województwach</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {/*
            Zwykłe `<a>`, nie `<Link>`, i to nie z przeoczenia.

            Przy przejściu w obrębie aplikacji router podmienia adres dopiero po złożeniu
            nowej strony. Mapa czyta filtry z adresu przy montowaniu, więc dostawała jeszcze
            adres poprzedniej strony - startowała bez województwa i własnym zapisem stanu
            kasowała `woj` z paska adresu. Pełne wczytanie strony daje mapie właściwy adres
            od pierwszego renderu.

            Koszt jest niewielki: mapa i tak ściąga wtedy MapLibre, czyli najcięższą paczkę
            w serwisie, więc nie ma tu przejścia „bez przeładowania", które dałoby się
            uratować.
          */}
          {VOIVODESHIPS.map((v) => (
            <a
              key={v}
              href={linkNaMape(v)}
              className="text-[13px] text-muted transition hover:text-flame"
            >
              {v}
            </a>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-6 text-[13px] text-muted">
          <Link href="/" className="transition hover:text-flame">
            mapa
          </Link>
          <Link href="/ranking" className="transition hover:text-flame">
            ranking boisk
          </Link>
          <Link href="/gracze" className="transition hover:text-flame">
            ranking graczy
          </Link>
          <Link href="/dodaj" className="transition hover:text-flame">
            dodaj boisko
          </Link>
          <Link href="/o-nas" className="transition hover:text-flame">
            o nas
          </Link>
          <Link href="/prywatnosc" className="transition hover:text-flame">
            prywatność
          </Link>
          <Link href="/regulamin" className="transition hover:text-flame">
            regulamin
          </Link>
          <span className="ml-auto text-faint">© 2026 PODKOSZ.PL</span>
        </div>
      </div>
    </footer>
  );
}
