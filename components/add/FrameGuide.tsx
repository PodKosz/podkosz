import { PhotoKind } from "@/lib/types";

/** Nakładka na podgląd aparatu — pokazuje, jak ustawić kadr. */
export function FrameGuide({ kind }: { kind: PhotoKind }) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g stroke="rgba(255,180,90,.85)" fill="none" strokeWidth="2" strokeDasharray="7 7">
        {kind === "narożnik" && (
          <>
            <path d="M40 250 L150 130 L330 130 L370 250 Z" />
            <path d="M150 130 v-38 M330 130 v-30" strokeDasharray="4 5" />
          </>
        )}
        {kind === "kosz-a" && <BackboardGuide />}
        {kind === "kosz-b" && <BackboardGuide />}
        {kind === "detal-kosza" && (
          <>
            <ellipse cx="200" cy="140" rx="105" ry="34" />
            <path d="M115 150 q85 90 170 0" strokeDasharray="4 6" />
          </>
        )}
        {kind === "ogólne-2" && (
          <>
            <path d="M30 240 L120 140 L300 140 L375 240 Z" />
            <path d="M120 140 v-34" strokeDasharray="4 5" />
          </>
        )}
        {kind === "nawierzchnia" && (
          <>
            <rect x="70" y="70" width="260" height="160" rx="10" />
            <path d="M70 150 h260" strokeDasharray="4 6" />
          </>
        )}
      </g>
      <g fill="rgba(255,180,90,.9)" fontSize="11" fontFamily="system-ui" textAnchor="middle">
        <text x="200" y="284">
          {HINT[kind]}
        </text>
      </g>
    </svg>
  );
}

function BackboardGuide() {
  return (
    <>
      <rect x="128" y="52" width="144" height="90" rx="4" />
      <rect x="172" y="92" width="56" height="38" strokeDasharray="4 5" />
      <ellipse cx="200" cy="146" rx="36" ry="10" strokeDasharray="3 4" />
      <path d="M200 156 v90" strokeDasharray="4 6" />
    </>
  );
}

const HINT: Record<PhotoKind, string> = {
  "narożnik": "cała płyta w kadrze, aparat poziomo",
  "narożnik-2": "drugi narożnik, cała płyta w kadrze",
  "kosz-a": "tablica na środku, na wprost",
  "kosz-b": "drugi kosz, na wprost",
  "detal-kosza": "obręcz wypełnia kadr",
  "nawierzchnia": "aparat skierowany w dół",
  "ogólne-1": "całość z innego miejsca",
  "ogólne-2": "z przeciwnej strony niż zdjęcie 1",
};
