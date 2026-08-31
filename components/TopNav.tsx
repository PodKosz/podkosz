"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSesja } from "@/lib/sesja";
import { Brand } from "./Brand";
import { AuthMenu } from "./AuthMenu";

/*
  Rankingi są dwa i mieszkają pod osobnymi adresami: „Ranking" to boiska, „Gracze" to
  ludzie, którzy je dodali. Wcześniej siedziały pod jednym adresem i przełączały się
  zakładką w treści - żadnego nie dało się podlinkować osobno ani opisać własnym tytułem
  dla wyszukiwarki.
*/
const LINKS = [
  { href: "/", label: "Mapa" },
  { href: "/ranking", label: "Ranking" },
  { href: "/gracze", label: "Gracze" },
  { href: "/o-nas", label: "O nas" },
];

/*
  Dopasowanie po przedrostku, ale z jednym wyjątkiem: profil pojedynczej osoby stoi pod
  `/gracz/<nick>`, a zakładka rankingu pod `/gracze`. Bez tego wejście na czyjś profil
  podświetlałoby zakładkę, która o nim nie jest - i odwrotnie przy `startsWith` w drugą
  stronę.
*/
const isActive = (path: string, href: string) => {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
};

/**
 * Górny pasek. Kto jest zalogowany, dociągamy z `/api/sesja` już w przeglądarce (wspólnie
 * z przyciskami podpalenia i ulubionych), a nie z układu strony: odczyt ciasteczek na serwerze
 * wymuszałby renderowanie każdej podstrony na żądanie. Dopóki odpowiedź nie wróci, w miejscu
 * przycisku stoi placeholder tej samej wielkości, żeby pasek nie podskakiwał.
 */
export function TopNav() {
  const path = usePathname();
  const sesja = useSesja();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-3 sm:p-5">
      {/* na telefonie logo jest zawsze, także na mapie - inaczej nie ma jak wrócić */}
      <div className="pointer-events-auto shrink-0">
        <span className="md:hidden">
          <Brand compact />
        </span>
        <span className="hidden md:block">{path !== "/" && <Brand compact />}</span>
      </div>

      {/*
        Cztery nazwy plus przycisk i awatar ledwo mieszczą się na wąskim telefonie, dlatego
        na mobile odstępy i światło międzyliterowe są zbite do minimum, a od progu `sm`
        wracają do normy. To była realna kolizja, nie ostrożność: przy poprzednich wartościach
        pasek wychodził poza prawą krawędź ekranu przy 375 pikselach.
      */}
      <nav className="glass pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full p-1 pl-1.5 sm:gap-1 sm:p-1.5 sm:pl-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-1 py-1.5 text-[10px] font-medium uppercase tracking-[0.01em] transition sm:px-3.5 sm:py-2 sm:text-[12px] sm:tracking-[0.11em] ${
              isActive(path, l.href) ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}

        <Link
          href="/dodaj"
          className="whitespace-nowrap rounded-full flame-gradient px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.02em] text-black transition hover:brightness-110 active:scale-[0.98] sm:px-5 sm:py-2.5 sm:text-[12px] sm:tracking-[0.12em]"
        >
          <span className="sm:hidden">Dodaj</span>
          <span className="hidden sm:inline">Dodaj boisko</span>
        </Link>

        <span className="h-5 w-px bg-white/12 sm:mx-1 sm:h-6" />
        {sesja === undefined ? (
          <span className="h-9 w-9 rounded-full bg-white/6 sm:w-[104px]" aria-hidden />
        ) : (
          <AuthMenu user={sesja.user} />
        )}
      </nav>
    </div>
  );
}
