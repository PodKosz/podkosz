import { BallOutline } from "./BallOutline";

/**
 * Piłka do koszykówki w tle profilu i konta - ten sam rysunek co kontur boiska na „O nas"
 * i kosz w rankingu, tylko mocno przygaszony. Warstwa jest przyklejona do okna, więc rysunek
 * trzyma proporcje niezależnie od długości strony i nie rozciąga się na całą jej wysokość.
 */
export function TloPilki({ uid = "profil" }: { uid?: string }) {
  return (
    <div
      className="pilka-tlo pointer-events-none fixed left-1/2 top-1/2 -z-10 aspect-square w-[min(1200px,150vw)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(1020px,88vw)]"
      aria-hidden
    >
      <BallOutline uid={uid} />
    </div>
  );
}
