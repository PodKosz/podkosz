import type { Metadata } from "next";
import Link from "next/link";
import { listCourts } from "@/lib/repo";
import { RankingBoisk } from "@/components/ranking/RankingBoisk";
import { HoopOutline } from "@/components/HoopOutline";

export const metadata: Metadata = {
  title: "Ranking boisk - PodKosz",
  description:
    "Najgorętsze boiska do koszykówki w Polsce. Kolejność wyznaczają płonące piłki od społeczności - podpalaj te, na których dobrze się gra.",
};

/* Kolejność zmienia podpalanie, a to unieważnia znacznik boisk - pięć minut wystarczy. */
export const revalidate = 300;

export default async function RankingPage() {
  const courts = await listCourts();
  const sorted = [...courts].sort((a, b) => b.likes - a.likes);

  return (
    /*
      Szeroka kolumna, nie wąska wstęga. Ranking jest siatką zdjęć, a nie artykułem - przy
      1024 pikselach na monitorze zostawało czarne pole po obu stronach i strona wyglądała
      na niedokończoną. 1600 pikseli mieści cztery karty w rzędzie i wciąż trzyma długość
      wiersza w ryzach tam, gdzie jest tekst.
    */
    <main className="relative mx-auto min-h-dvh w-full max-w-[1600px] px-5 pb-28 pt-28 sm:px-8">
      <Tlo />

      <header className="mb-14 max-w-2xl">
        <p className="text-[12px] uppercase tracking-[0.22em] text-flame">Ranking</p>
        <h1 className="mt-3 text-[clamp(34px,5.5vw,62px)] font-semibold leading-[1.02] tracking-[-0.03em]">
          Najgorętsze boiska w Polsce
        </h1>
        <p className="mt-5 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-muted">
          Kolejność wyznaczają płonące piłki od społeczności. Podpalaj boiska, na których
          dobrze się gra - to jedyne, co przesuwa je w górę.
        </p>
        <Link
          href="/gracze"
          className="mt-6 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.16em] text-muted transition hover:text-flame"
        >
          zobacz ranking graczy <span aria-hidden>→</span>
        </Link>
      </header>

      <RankingBoisk courts={sorted} />
    </main>
  );
}

/**
 * Tło strony: kosz w lewym dolnym rogu i ciepłe plamy światła.
 *
 * Kosz stał wcześniej wyśrodkowany u góry, dokładnie pod nagłówkiem - kreska przebijała
 * przez tekst i rysunek czytał się jak przypadkowa tekstura. Z narożnika daje ten sam
 * sygnał, a treść zostaje na czystym tle. Wychodzi poza obie krawędzie, więc widać jego
 * fragment, nie całą ikonę - to różnica między tłem a naklejką.
 *
 * Obie warstwy są przyklejone do okna (`fixed`): rysunek trzyma wtedy proporcje niezależnie
 * od długości strony, a plamy szersze od ekranu nie dorzucają poziomego przewijania.
 */
function Tlo() {
  return (
    <>
      <div
        className="kosz-tlo kontur-rysowany pointer-events-none fixed bottom-[-34vh] left-[-42vw] -z-10 aspect-[480/440] w-[min(1900px,215vw)] sm:bottom-[-40vh] sm:left-[-26vw] sm:w-[min(2400px,148vw)]"
        aria-hidden
      >
        <HoopOutline uid="ranking-boisk" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <span
          className="liquid-blob left-[-10vw] top-[-8rem] h-[560px] w-[720px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-flame) / .22) 0%, rgb(var(--rgb-ember) / .07) 48%, transparent 76%)",
          }}
        />
        <span
          className="liquid-blob right-[-8vw] top-[26vh] h-[560px] w-[660px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-glow) / .14) 0%, rgb(var(--rgb-flame) / .04) 50%, transparent 78%)",
          }}
        />
        <span
          className="liquid-blob bottom-[-14rem] left-[24vw] h-[520px] w-[680px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-ember) / .16) 0%, rgb(var(--rgb-flame) / .05) 52%, transparent 76%)",
          }}
        />
      </div>
    </>
  );
}
