import type { Metadata } from "next";
import { listContributors, listCourts } from "@/lib/repo";
import { RankingTabs } from "@/components/RankingTabs";

export const metadata: Metadata = {
  title: "Ranking - PodKosz",
  description:
    "Najpopularniejsze boiska do koszykówki w Polsce według liczby lajków oraz ranking osób, które dodały ich najwięcej.",
};

export const revalidate = 0;

export default async function RankingPage() {
  const [courts, authors] = await Promise.all([listCourts(), listContributors()]);
  const sorted = [...courts].sort((a, b) => b.likes - a.likes);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pb-24 pt-28">
      <header className="mb-10">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Ranking</p>
        <h1 className="mt-2 text-[clamp(32px,5vw,52px)] font-semibold leading-tight tracking-[-0.02em]">
          Najgorętsze boiska w Polsce
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-muted">
          Kolejność wyznaczają płonące piłki od społeczności. Podpalaj boiska, na których dobrze się
          gra - i dodawaj własne, żeby wejść do rankingu odkrywców.
        </p>
      </header>

      {sorted.length ? (
        <RankingTabs courts={sorted} authors={authors} />
      ) : (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Baza jest jeszcze pusta - dodaj pierwsze boisko.
        </p>
      )}
    </main>
  );
}
