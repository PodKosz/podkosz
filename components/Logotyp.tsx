import { Znak } from "./Znak";
import { NapisZPartnerem } from "./NapisPodkosz";

/**
 * Pełny zestaw marki w poziomie: znak (pinezka z piłką), obok napis PODKOSZ, a pod napisem
 * „Powered by” z logo Coconaut. Od 22.10.2026 logo wszędzie występuje w tym komplecie.
 *
 * Wymiary są w `em` (1em = wysokość liter), więc rozmiar ustawia jedna klasa `text-[…]`
 * w `className`. Przy literach 20,5 px znak ma 54 px, a odstęp 12 px - jak na mapie.
 *
 * Bez linku i bez hooków: `Brand` (nawigacja, mapa) i rama dokumentów owijają go we własny
 * odnośnik z własnym opisem dla czytników ekranu, a `uid` podają z zewnątrz.
 */
export function Logotyp({ uid, className = "" }: { uid: string; className?: string }) {
  return (
    <span className={`flex items-center gap-[0.585em] ${className}`}>
      <span
        className="grid place-items-center"
        style={{ filter: "drop-shadow(0 4px 14px rgb(var(--rgb-ember) / .35))" }}
      >
        <Znak uid={uid} rozmiar="maly" className="h-[2.634em] w-auto" />
      </span>
      <NapisZPartnerem uid={uid} className="text-ink" />
    </span>
  );
}
