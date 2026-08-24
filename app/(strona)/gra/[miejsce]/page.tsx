import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelGry, type WpisRankingu } from "@/components/gra/PanelGry";
import { ArrowLeftIcon } from "@/components/icons";
import { MIEJSCA_GRY, POZIOMY_GRY, miejsceZeSlugu } from "@/lib/minigra";
import { SITE_NAME } from "@/lib/site";
import { supabasePublic } from "@/lib/supabase/publiczny";

/**
 * Podstrona minigry - jedna na każde miejsce z mapy.
 *
 * Ranking pobieramy na serwerze, żeby tablica wyników była widoczna od pierwszej klatki,
 * a nie doskakiwała po wczytaniu skryptów. Świadomie krótkie `revalidate`: to jedyna
 * rzecz na stronie, która zmienia się co kilka minut, gdy ktoś gra.
 */
export const revalidate = 60;

export function generateStaticParams() {
  return MIEJSCA_GRY.map((m) => ({ miejsce: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ miejsce: string }>;
}): Promise<Metadata> {
  const { miejsce } = await params;
  const m = miejsceZeSlugu(miejsce);
  if (!m) return { title: SITE_NAME };

  const title = `Rzut do kosza - ${m.nazwa}`;
  return {
    title,
    description: `Minigra ukryta na mapie PodKosza: rzucaj do kosza na ${m.nazwa} i wbij się na tablicę najdłuższych serii.`,
    alternates: { canonical: `/gra/${m.slug}` },
    /* easter egg nie ma po co siedzieć w wynikach wyszukiwania */
    robots: { index: false, follow: true },
  };
}

async function pobierzRanking(id: string): Promise<WpisRankingu[]> {
  const supabase = supabasePublic();
  if (!supabase) return [];

  const { data } = await supabase.rpc("minigra_ranking", { p_miejsce: id, p_ile: 20 });
  return Array.isArray(data) ? (data as WpisRankingu[]) : [];
}

export default async function GraPage({
  params,
}: {
  params: Promise<{ miejsce: string }>;
}) {
  const { miejsce } = await params;
  const m = miejsceZeSlugu(miejsce);
  if (!m) notFound();

  const ranking = await pobierzRanking(m.id);
  const drugie = MIEJSCA_GRY.find((x) => x.id !== m.id);

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <Link
        href="/"
        className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> wróć na mapę
      </Link>

      <header className="mt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">
          {m.miasto} &middot; easter egg
        </p>
        <h1 className="mt-2 flame-text pb-1 text-[clamp(32px,6vw,54px)] font-semibold tracking-[-0.03em]">
          Rzut do kosza
        </h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-muted">
          {m.opis} Przeciągnij palcem albo myszką od piłki w stronę obręczy i puść. Liczy
          się seria trafień pod rząd - jedno pudło i zaczynasz od zera.
        </p>
      </header>

      <div className="mt-8">
        <PanelGry miejsce={m} ranking={ranking} />
      </div>

      {/* co się dzieje wyżej - żeby nie było zaskoczeniem, że kosz nagle ucieka */}
      <section className="mt-10">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Jak się zaostrza</h2>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["do 20", "Kosz stoi. Sama technika."],
            ["od 20", "Obręcz jedzie w bok."],
            ["od 30", "Obręcz jedzie w górę i w dół."],
            ["od 40", "Obie osie naraz, potem szybciej."],
          ].map(([od, opis]) => (
            <div key={od} className="kafel p-5">
              <p className="text-[12px] uppercase tracking-[0.14em] text-flame">{od}</p>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">{opis}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[12.5px] text-faint">
          Piłka zmienia się razem z serią: {POZIOMY_GRY.map((p) => p.nazwa).filter((n, i, a) => a.indexOf(n) === i).join(" → ")}.
          To te same piłki, co stopnie odznaczeń na profilu.
        </p>
      </section>

      {drugie && (
        <section className="mt-10">
          <Link
            href={`/gra/${drugie.slug}`}
            className="szklo-pro inline-flex items-center gap-3 rounded-full px-5 py-3 text-[13px] text-muted transition hover:text-ink"
          >
            Drugie boisko: {drugie.nazwa}, {drugie.miasto} &middot; osobna tablica wyników
          </Link>
        </section>
      )}
    </main>
  );
}
