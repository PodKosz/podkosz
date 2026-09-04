import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EkranGry, type WpisRankingu } from "@/components/gra/EkranGry";
import { MIEJSCA_GRY, NAZWY_GIER, miejsceZeSlugu } from "@/lib/minigra";
import { SITE_NAME } from "@/lib/site";
import { supabasePublic } from "@/lib/supabase/publiczny";

/**
 * Podstrona minigry - jedna na każde miejsce z mapy.
 *
 * Strona nie ma tu nic poza grą: żadnego nagłówka, żadnego akapitu z instrukcją, żadnej
 * kolumny z rankingiem. Wszystko, co trzeba wiedzieć, mówi ekran tytułowy i sam podgląd
 * toru rzutu - a pasek nawigacji i stopkę wyłączamy dla całej ścieżki `/gra` (patrz
 * `TopNav` i `SiteFooter`), bo gra zajmuje całe okno.
 *
 * Ranking pobieramy na serwerze, żeby tablica wyników była gotowa, zanim ktoś jej otworzy.
 * Świadomie krótkie `revalidate`: to jedyna rzecz na stronie, która zmienia się co kilka
 * minut, gdy ktoś gra.
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

  const title = `${NAZWY_GIER[m.rodzaj].nazwa} - ${m.nazwa}`;
  return {
    title,
    description: `Minigra ukryta na mapie PodKosza (${m.nazwa}, ${m.miasto}). ${NAZWY_GIER[m.rodzaj].jak}`,
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
  const drugie = MIEJSCA_GRY.find((x) => x.id !== m.id) ?? null;

  return <EkranGry miejsce={m} ranking={ranking} drugie={drugie} />;
}
