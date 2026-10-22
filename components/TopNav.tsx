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

  /*
    Na minigrze paska nie ma. Gra zajmuje całe okno i ma w narożnikach dokładnie trzy
    rzeczy: powrót na mapę, licznik serii i ranking. Pasek nawigacji leżałby na planszy
    dokładnie tam, gdzie stoi licznik, a przy rzucie w górę zasłaniałby obręcz.
  */
  if (path.startsWith("/gra/")) return null;

  return (
    /*
      `data-kadr` - od dolnej krawędzi paska mapa na telefonie liczy górny margines kadru.

      Pełne logo (znak, napis, „Powered by Coconaut”) i menu nie mieszczą się obok siebie na
      telefonie, więc poniżej progu `sm` pasek ma dwa rzędy: logo, a pod nim menu na całą
      szerokość. Pasek ma wtedy ok. 121 px wysokości (od `sm` - ok. 105 px) i od tego zależą: górny
      margines podstron (`pt-36 sm:pt-28`), górna krawędź rozwiniętego arkusza filtrów na mapie
      (Sidebar) i przycisk kandydatów OSM (Explorer).
    */
    <div
      data-kadr="gora"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      {/*
        Logo jest wszędzie, także na telefonie na mapie - inaczej nie ma jak wrócić. Wyjątek to
        mapa na komputerze: tam logo stoi w panelu bocznym (Sidebar), a tu zostaje pusty element,
        żeby menu nie uciekło na lewą stronę. `lg:pl-1` jak w panelu - logo nie przeskakuje przy
        przejściu z mapy na podstronę. Na mapie cień trzyma czytelność na tle kafelków.
      */}
      <div
        className="pointer-events-auto shrink-0 lg:pl-1"
        style={path === "/" ? { filter: "drop-shadow(0 6px 20px rgba(0,0,0,.85))" } : undefined}
      >
        <div className={path === "/" ? "lg:hidden" : undefined}>
          <Brand />
        </div>
      </div>

      {/*
        Cztery nazwy plus przycisk i awatar ledwo mieszczą się na wąskim telefonie, dlatego
        na mobile odstępy i światło międzyliterowe są zbite do minimum, a od progu `sm`
        wracają do normy. To była realna kolizja, nie ostrożność: przy poprzednich wartościach
        pasek wychodził poza prawą krawędź ekranu przy 375 pikselach. Na telefonie menu ma
        własny rząd, więc rozciąga się na całą szerokość i rozkłada pozycje równo.
      */}
      <nav className="glass pointer-events-auto flex w-full shrink-0 items-center justify-between gap-0.5 rounded-full p-1 pl-1.5 sm:w-auto sm:justify-start lg:gap-1 lg:p-1.5 lg:pl-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-1 py-2.5 text-[10px] font-medium uppercase tracking-[0.01em] transition lg:px-3.5 lg:py-2 lg:text-[12px] lg:tracking-[0.11em] ${
              isActive(path, l.href) ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}

        <Link
          href="/dodaj"
          className="whitespace-nowrap rounded-full flame-gradient px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.02em] text-black transition hover:brightness-110 active:scale-[0.98] lg:px-5 lg:py-2.5 lg:text-[12px] lg:tracking-[0.12em]"
        >
          <span className="lg:hidden">Dodaj</span>
          <span className="hidden lg:inline">Dodaj boisko</span>
        </Link>

        <span className="h-5 w-px bg-white/12 lg:mx-1 lg:h-6" />
        {sesja === undefined ? (
          <span className="h-9 w-9 rounded-full bg-white/6 lg:w-[104px]" aria-hidden />
        ) : (
          <AuthMenu user={sesja.user} />
        )}
      </nav>
    </div>
  );
}
