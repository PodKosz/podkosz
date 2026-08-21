import type { Metadata } from "next";
import { listCourts, listRankingOdkrywcow } from "@/lib/repo";
import { RankingTabs } from "@/components/RankingTabs";
import { HoopOutline } from "@/components/HoopOutline";

export const metadata: Metadata = {
  title: "Ranking - PodKosz",
  description:
    "Najpopularniejsze boiska do koszykówki w Polsce według liczby lajków oraz ranking osób, które dodały ich najwięcej.",
};

/* Kolejność zmienia podpalanie, a to unieważnia znacznik boisk - pięć minut wystarczy. */
export const revalidate = 300;

export default async function RankingPage() {
  const [courts, odkrywcy] = await Promise.all([listCourts(), listRankingOdkrywcow()]);
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

      {/*
        Zarys kosza od przodu pod całą stroną - ta sama kreska co kontur boiska na „O nas",
        tylko widok z drugiej strony: tablica, obręcz i siatka. Warstwa jest przyklejona do
        okna i nieklikalna, a rysunek trzyma własne proporcje (`meet` w SVG), bo rozciągnięty
        kosz od razu wygląda jak błąd.
      */}
      <div
        className="pointer-events-none fixed left-1/2 top-[-6vh] -z-10 aspect-[480/440] w-[min(1150px,160vw)] opacity-[0.42] sm:w-[min(1040px,94vw)]"
        style={{ translate: "-50% 0", rotate: "-3deg" }}
        aria-hidden
      >
        <HoopOutline uid="ranking" />
      </div>

      {odkrywcy.length || sorted.length ? (
        <RankingTabs courts={sorted} odkrywcy={odkrywcy} />
      ) : (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Baza jest jeszcze pusta - dodaj pierwsze boisko.
        </p>
      )}
    </main>
  );
}
