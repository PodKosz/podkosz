"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VOIVODESHIPS } from "@/lib/types";
import { slugifyPlace } from "@/lib/site";

/**
 * Stopka z dokumentami i odnośnikami do podstron województw. Na stronie głównej jej nie ma,
 * bo mapa zajmuje dokładnie wysokość okna i stopka zrobiłaby z niej przewijaną stronę.
 *
 * Odnośniki do województw pełnią dwie funkcje: nawigacja dla ludzi i stała ścieżka dla
 * wyszukiwarek do wszystkich podstron regionalnych.
 */
export function SiteFooter() {
  const path = usePathname();
  if (path === "/" || path.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-hairline px-6 pb-10 pt-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Boiska po województwach</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {VOIVODESHIPS.map((v) => (
            <Link
              key={v}
              href={`/wojewodztwo/${slugifyPlace(v)}`}
              className="text-[13px] text-muted transition hover:text-flame"
            >
              {v}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-6 text-[13px] text-muted">
          <Link href="/" className="transition hover:text-flame">
            mapa
          </Link>
          <Link href="/ranking" className="transition hover:text-flame">
            ranking
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
