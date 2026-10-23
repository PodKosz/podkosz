import type { Metadata } from "next";
import Link from "next/link";
import { topBoiska } from "@/lib/repo";
import { RankingBoisk, RANKING_DO, RANKING_OD_OPINII } from "@/components/ranking/RankingBoisk";

export const metadata: Metadata = {
  title: "Ranking boisk - PodKosz",
  description:
    "Najlepiej oceniane boiska do koszykówki w Polsce. Kolejność wyznaczają oceny graczy - średnia ważona liczbą opinii, od dziesięciu opinii w górę.",
};

/* Kolejność zmieniają nowe opinie - pięć minut opóźnienia rankingu nikomu nie szkodzi. */
export const revalidate = 300;

/**
 * Strona rankingu w języku nowej karty boiska: ciemne tło bez plam światła, nagłówek,
 * podium, tabela z filtrem województw i przyklejony na dole przycisk „Oceń boisko”, tak jak
 * „Idę zagrać” na karcie. Ranking rośnie wyłącznie z opinii, więc to jedyne wezwanie na stronie.
 */
export default async function RankingPage() {
  const boiska = await topBoiska(RANKING_DO);

  return (
    <main className="rk-strona">
      <header className="rk-glowa">
        <p className="rk-nad">Ranking</p>
        <h1>Najlepiej oceniane boiska w Polsce</h1>
        <p className="rk-zasada">
          Średnia ocen ważona liczbą opinii - trzy piątki nie przeskoczą 4,5 od tysiąca osób. Do rankingu
          wchodzi boisko z co najmniej {RANKING_OD_OPINII} opiniami.
        </p>
        <Link href="/gracze" className="rk-gracze">
          Zobacz ranking graczy <span aria-hidden>→</span>
        </Link>
      </header>

      <RankingBoisk courts={boiska} />

      {/*
        Ocenić można tylko konkretne boisko, a w rankingu są te już ocenione - przycisk prowadzi
        więc na mapę, gdzie wybiera się swoje. Wygląd 1:1 z „Idę zagrać” (`.kb-dok-cta`).
      */}
      <div className="kb-dok">
        <div className="kb-dok-karta">
          <Link href="/" className="kb-dok-cta">
            <b>Oceń boisko</b>
            <small>ranking rośnie z Twoich opinii</small>
          </Link>
        </div>
      </div>
    </main>
  );
}
