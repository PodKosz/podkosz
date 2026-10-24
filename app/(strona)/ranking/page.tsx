import type { Metadata } from "next";
import Link from "next/link";
import { sredniaOpiniiSerwisu, topBoiska } from "@/lib/repo";
import { RankingBoisk, RANKING_DO, RANKING_OD_OPINII } from "@/components/ranking/RankingBoisk";
import { JakDzialaRanking } from "@/components/ranking/JakDzialaRanking";

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
  const [boiska, srednia] = await Promise.all([topBoiska(RANKING_DO), sredniaOpiniiSerwisu()]);

  return (
    <main className="rk-strona">
      <header className="rk-glowa">
        <p className="rk-nad">Ranking</p>
        <h1>Najlepiej oceniane boiska w Polsce</h1>
        <Link href="/gracze" className="rk-gracze">
          Zobacz ranking graczy <span aria-hidden>→</span>
        </Link>
      </header>

      <RankingBoisk courts={boiska} />

      {/* zasady na samym dole - kto chce wiedzieć, skąd taka kolejność, znajdzie tu wszystko */}
      <JakDzialaRanking sredniaSerwisu={srednia ?? 3.9} prog={RANKING_OD_OPINII} />

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
