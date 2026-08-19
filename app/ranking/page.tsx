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
    <main className="relative mx-auto min-h-dvh max-w-5xl px-6 pb-24 pt-28">
      {/*
        Płynne plamy gradientu za nagłówkiem. Siedzą w warstwie na całą szerokość okna, a nie
        w kolumnie tekstu: przycięte do kolumny kończyły się widoczną, twardą krawędzią.
        Same plamy wygasają do przezroczystości długo przed swoim brzegiem, więc światło
        rozpływa się w tle bez żadnej linii.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span
          className="liquid-blob left-[4vw] top-[-6rem] h-[520px] w-[680px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.20) 0%, rgba(255,77,10,.07) 46%, rgba(255,77,10,.02) 66%, transparent 80%)",
          }}
        />
        <span
          className="liquid-blob right-[2vw] top-[8vh] h-[460px] w-[560px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,178,92,.13) 0%, rgba(255,178,92,.04) 48%, transparent 78%)",
          }}
        />
      </div>

      <header className="relative mb-10">
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
