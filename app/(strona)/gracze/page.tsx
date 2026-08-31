import type { Metadata } from "next";
import Link from "next/link";
import { listRankingOdkrywcow } from "@/lib/repo";
import { RankingGraczy } from "@/components/ranking/RankingGraczy";
import { RzutOutline } from "@/components/RzutOutline";

export const metadata: Metadata = {
  title: "Ranking graczy - PodKosz",
  description:
    "Kto zbudował mapę boisk do koszykówki w Polsce. Miejsce zależy od liczby dodanych boisk, a przy remisie decydują zebrane podpalenia.",
};

/* Ranking zmienia się razem z publikacją boisk - ten sam odstęp co przy rankingu boisk. */
export const revalidate = 300;

export default async function GraczePage() {
  const odkrywcy = await listRankingOdkrywcow();

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-[1600px] px-5 pb-28 pt-28 sm:px-8">
      <Tlo />

      <header className="mb-14 max-w-2xl">
        <p className="text-[12px] uppercase tracking-[0.22em] text-flame">Gracze</p>
        <h1 className="mt-3 text-[clamp(34px,5.5vw,62px)] font-semibold leading-[1.02] tracking-[-0.03em]">
          Ci, którzy zbudowali tę mapę
        </h1>
        <p className="mt-5 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-muted">
          Liczą się tylko zalogowani. Miejsce zależy od liczby opublikowanych boisk, a przy
          równej liczbie wyżej stoi ten, kogo boiska częściej podpalano.
        </p>
        <Link
          href="/ranking"
          className="mt-6 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.16em] text-muted transition hover:text-flame"
        >
          zobacz ranking boisk <span aria-hidden>→</span>
        </Link>
      </header>

      <RankingGraczy odkrywcy={odkrywcy} />
    </main>
  );
}

/**
 * Tło strony: rzut do kosza w lewym dolnym rogu i ciepłe plamy światła.
 *
 * Ranking boisk ma pod spodem kosz - miejsce. Tu chodzi o ludzi i o to, co robią, więc
 * rysunkiem jest ruch: piłka wychodzi z rogu, tor wznosi się przez kadr i opada w obręcz.
 * Linie domykają się w miarę przewijania strony, więc rzut leci wraz z czytaniem listy.
 */
function Tlo() {
  return (
    <>
      <div
        className="rzut-tlo kontur-rysowany pointer-events-none fixed bottom-[-16vh] left-[-22vw] -z-10 aspect-[900/640] w-[min(1300px,165vw)] sm:bottom-[-18vh] sm:left-[-10vw] sm:w-[min(1560px,98vw)]"
        aria-hidden
      >
        <RzutOutline uid="gracze" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <span
          className="liquid-blob left-[-12vw] bottom-[-10rem] h-[600px] w-[760px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.24) 0%, rgba(255,77,10,.08) 48%, transparent 76%)",
          }}
        />
        <span
          className="liquid-blob right-[-6vw] top-[-6rem] h-[520px] w-[640px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,178,92,.15) 0%, rgba(255,122,24,.04) 50%, transparent 78%)",
          }}
        />
        <span
          className="liquid-blob right-[10vw] bottom-[-16rem] h-[500px] w-[620px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,77,10,.15) 0%, rgba(255,122,24,.04) 52%, transparent 76%)",
          }}
        />
      </div>
    </>
  );
}
