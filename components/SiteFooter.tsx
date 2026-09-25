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
  /* mapa i minigra zajmują dokładnie wysokość okna - stopka zrobiłaby z nich stronę do przewijania */
  if (path === "/" || path.startsWith("/admin") || path.startsWith("/gra/")) return null;

  return (
    <footer className="border-t border-hairline px-6 pb-10 pt-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Boiska po województwach</p>
        {/* odstęp w pionie siedzi w samych linkach (py-1): ten sam rytm, a pole pod palec
            ma 28 px zamiast 20 */}
        <div className="mt-2 flex flex-wrap gap-x-4">
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
              className="py-1 text-[13px] text-muted transition hover:text-flame"
            >
              {v}
            </a>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 border-t border-hairline pt-5 text-[13px] text-muted">
          <Link href="/" className="py-1 transition hover:text-flame">
            mapa
          </Link>
          <Link href="/ranking" className="py-1 transition hover:text-flame">
            ranking boisk
          </Link>
          <Link href="/gracze" className="py-1 transition hover:text-flame">
            ranking graczy
          </Link>
          <Link href="/dodaj" className="py-1 transition hover:text-flame">
            dodaj boisko
          </Link>
          <Link href="/o-nas" className="py-1 transition hover:text-flame">
            o nas
          </Link>
          <Link href="/prywatnosc" className="py-1 transition hover:text-flame">
            prywatność
          </Link>
          <Link href="/regulamin" className="py-1 transition hover:text-flame">
            regulamin
          </Link>
          <span className="ml-auto text-faint">© 2026 PODKOSZ.PL</span>
        </div>
      </div>
    </footer>
  );
}
