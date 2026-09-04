import { BallOutline } from "./BallOutline";

/**
 * Tło profilu i konta: zarys piłki w prawym narożniku plus ciepłe plamy światła.
 *
 * Piłka leży w prawym dolnym narożniku i wychodzi poza ekran obiema krawędziami -
 * wyśrodkowana zbierała się dokładnie pod kolumną kart i szwy przebijały przez tekst.
 * Z narożnika daje ten sam sygnał („to jest o koszykówce"), a treść zostaje na czystym tle.
 *
 * Obie warstwy są przyklejone do okna (`fixed`): rysunek trzyma wtedy proporcje niezależnie
 * od długości strony, a plamy szersze od ekranu nie dorzucają poziomego przewijania -
 * `absolute` z takimi rozmiarami zrobiłby pasek na telefonie.
 */
export function TloPilki({ uid = "profil" }: { uid?: string }) {
  return (
    <>
      <div
        className="pilka-tlo pointer-events-none fixed bottom-[-26vh] right-[-32vw] -z-10 aspect-square w-[min(1300px,165vw)] sm:bottom-[-24vh] sm:right-[-16vw] sm:w-[min(1560px,104vw)]"
        aria-hidden
      >
        <BallOutline uid={uid} />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <span
          className="liquid-blob -left-32 -top-24 h-[540px] w-[700px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-flame) / .28) 0%, rgb(var(--rgb-ember) / .1) 52%, transparent 74%)",
          }}
        />
        <span
          className="liquid-blob right-[-16vw] top-[18vh] h-[620px] w-[720px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-ember) / .24) 0%, rgb(var(--rgb-flame) / .08) 54%, transparent 76%)",
          }}
        />
        <span
          className="liquid-blob left-[6vw] bottom-[-12rem] h-[520px] w-[680px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--rgb-glow) / .2) 0%, rgb(var(--rgb-flame) / .06) 52%, transparent 74%)",
          }}
        />
        <span
          className="liquid-blob right-[8vw] bottom-[-16rem] h-[460px] w-[560px]"
          style={{
            background: "radial-gradient(circle, rgb(var(--rgb-flame) / .18) 0%, transparent 72%)",
          }}
        />
      </div>
    </>
  );
}
