import Link from "next/link";
import { Znak } from "./Znak";

/**
 * Klocki stron z dokumentami - polityki prywatności i regulaminu.
 *
 * Każdy z tych dokumentów ma dwie wersje:
 *
 *  - „po" otwarciu, pełną, opisującą cały serwis: `app/(strona)/prywatnosc`
 *    i `app/(strona)/regulamin`;
 *  - „przed" otwarciem, która nie mówi, czym jest serwis: `app/(zaslona)/wkrotce/prywatnosc`
 *    i `app/(zaslona)/wkrotce/regulamin`. Proxy podstawia ją pod te same adresy każdemu,
 *    kogo zasłona nie wpuszcza (patrz `WERSJE_PRZED` w `proxy.ts`).
 *
 * Wspólne klocki pilnują, żeby obie wersje wyglądały tak samo.
 */

/** Adres do spraw danych i regulaminu - ten sam w obu wersjach. */
export const KONTAKT = "podkoszpl@gmail.com";

export function Mail() {
  return (
    <a className="text-flame" href={`mailto:${KONTAKT}`}>
      {KONTAKT}
    </a>
  );
}

export function TytulDokumentu({ tytul, aktualizacja }: { tytul: string; aktualizacja: string }) {
  return (
    <>
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Dokumenty</p>
      <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
        {tytul}
      </h1>
      <p className="mt-3 text-[14px] text-faint">Ostatnia aktualizacja: {aktualizacja}</p>
    </>
  );
}

export function Sekcja({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export function Lista({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-3">
      {items.map(([name, desc]) => (
        <li key={name} className="border-l-2 border-flame/40 pl-4">
          <span className="font-semibold">{name}</span> - <span className="text-muted">{desc}</span>
        </li>
      ))}
    </ul>
  );
}

export function Punkt({
  nr,
  title,
  children,
}: {
  nr: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        {nr}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

/**
 * Rama dokumentu w wersji „przed": bez paska nawigacji i stopki serwisu - ich odnośniki
 * mówiłyby, co jest za zasłoną. Zostaje sam znak z nazwą, prowadzący z powrotem na stronę
 * zapowiedzi.
 *
 * Nie używa `Brand` z nawigacji, bo ten w opisie dla czytników ekranu nazywa serwis
 * mapą boisk.
 */
export function RamaPrzed({ uid, children }: { uid: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-8 sm:pt-10">
      <Link
        href="/"
        aria-label="PodKosz - strona główna"
        className="inline-flex items-center gap-3 transition hover:opacity-90"
      >
        <span style={{ filter: "drop-shadow(0 4px 14px rgb(var(--rgb-ember) / .35))" }}>
          <Znak uid={uid} wysokosc={38} />
        </span>
        <span className="text-[19px] font-bold leading-none tracking-tight">
          POD<span className="flame-text pr-[0.04em]">KOSZ</span>
        </span>
      </Link>

      <div className="mt-14 sm:mt-16">{children}</div>
    </main>
  );
}
