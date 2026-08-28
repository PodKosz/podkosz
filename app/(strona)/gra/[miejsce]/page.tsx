import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelGry, type WpisRankingu } from "@/components/gra/PanelGry";
import { TloBoiska } from "@/components/gra/TlaBoisk";
import { ArrowLeftIcon } from "@/components/icons";
import { MIEJSCA_GRY, miejsceZeSlugu } from "@/lib/minigra";
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
      {/*
        Rysunek miasta idzie pod całą stronę, nie pod samą planszę. Gra ma być miejscem,
        w którym się jest, a nie obrazkiem w ramce - a przy okazji plansza może być
        przezroczysta i nic nie wycina konturu w połowie kamienicy.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <TloBoiska miejsce={m.id} />

        {/*
          Przyciemnienie u góry. Kontur miasta przechodził przez nagłówek i akapit, przez
          co tekst robił się nieczytelny - a rysunek ma być tłem, nie treścią. Niżej,
          tam gdzie leci piłka, wygasa do zera.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,#07070a 0%,rgba(7,7,10,.9) 16%,rgba(7,7,10,.55) 30%,rgba(7,7,10,.12) 46%,transparent 62%)",
          }}
        />
      </div>

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
          {m.opis} Machnij palcem albo myszką w stronę kosza - liczy się szybkość ruchu,
          nie długość. Seria trafień pod rząd kończy się na pierwszym pudle, a kosz
          zaczyna uciekać po dwudziestym trafieniu.
        </p>
      </header>

      <div className="mt-8">
        <PanelGry miejsce={m} ranking={ranking} />
      </div>

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
