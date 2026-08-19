import { CourtPhotoRef, PhotoKind } from "@/lib/types";

/**
 * Placeholder zdjęcia boiska - generowany deterministycznie z ziarna.
 * Gdy w bazie pojawi się `url`, komponent renderuje prawdziwe zdjęcie.
 */
export function CourtPhoto({
  photo,
  seed,
  className = "",
  alt,
}: {
  photo: CourtPhotoRef;
  seed: number;
  className?: string;
  alt?: string;
}) {
  if (photo.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo.url}
        alt={alt ?? photo.caption}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return <PhotoPlaceholder kind={photo.kind} seed={seed} className={className} />;
}

const SCENE: Record<PhotoKind, "wide" | "hoop" | "surface"> = {
  "narożnik": "wide",
  "kosz-a": "hoop",
  "kosz-b": "hoop",
  "detal-kosza": "hoop",
  "nawierzchnia": "surface",
  "ogólne-2": "wide",
  "narożnik-2": "wide",
  "ogólne-1": "wide",
  "ogólne-3": "wide",
};

export function PhotoPlaceholder({
  kind,
  seed,
  className = "",
}: {
  kind: PhotoKind;
  seed: number;
  className?: string;
}) {
  const uid = `${kind}-${seed}`.replace(/[^a-z0-9-]/gi, "");
  const hue = 8 + ((seed * 37) % 40); // ciepły zakres: pomarańcz → czerwień
  const scene = SCENE[kind];
  const tilt = ((seed % 7) - 3) * 1.4;

  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label="Podgląd boiska"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor={`hsl(${hue + 200} 22% 9%)`} />
          <stop offset="0.55" stopColor={`hsl(${hue + 20} 26% 14%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 45% 20%)`} />
        </linearGradient>
        <radialGradient id={`sun-${uid}`} cx="0.75" cy="0.15" r="0.6">
          <stop offset="0" stopColor={`hsl(${hue + 14} 90% 62%)`} stopOpacity="0.5" />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={`floor-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue + 10} 18% 17%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 6} 14% 9%)`} />
        </linearGradient>
        <filter id={`grain-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      <rect width="800" height="500" fill={`url(#sky-${uid})`} />
      <rect width="800" height="500" fill={`url(#sun-${uid})`} />

      {scene === "wide" && <WideScene uid={uid} tilt={tilt} hue={hue} />}
      {scene === "hoop" && <HoopScene uid={uid} tilt={tilt} hue={hue} />}
      {scene === "surface" && <SurfaceScene uid={uid} hue={hue} seed={seed} />}

      <rect
        width="800"
        height="500"
        filter={`url(#grain-${uid})`}
        opacity="0.09"
        style={{ mixBlendMode: "overlay" }}
      />
      <rect
        width="800"
        height="500"
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="60"
        opacity="0.35"
      />
    </svg>
  );
}

function WideScene({ uid, tilt, hue }: { uid: string; tilt: number; hue: number }) {
  const line = "rgba(255,255,255,0.30)";
  return (
    <g transform={`rotate(${tilt} 400 250)`}>
      <path d="M0 300 L800 285 L800 500 L0 500 Z" fill={`url(#floor-${uid})`} />
      {/* linie boiska w perspektywie */}
      <g stroke={line} fill="none" strokeWidth="2.4">
        <path d="M60 500 L275 305 L560 305 L780 500" />
        <path d="M235 350 L600 350" opacity="0.7" />
        <path d="M330 305 L318 350 L505 350 L492 305 Z" opacity="0.85" />
        <ellipse cx="415" cy="352" rx="62" ry="14" opacity="0.7" />
      </g>
      {/* kosze */}
      <g fill="rgba(0,0,0,0.72)">
        <rect x="392" y="238" width="6" height="70" />
        <rect x="356" y="228" width="78" height="42" rx="3" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <rect x="382" y="268" width="30" height="4" rx="2" fill={`hsl(${hue} 90% 55%)`} />
        <rect x="144" y="250" width="4" height="58" />
        <rect x="118" y="243" width="52" height="28" rx="2" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.6" />
      </g>
      {/* horyzont / drzewa */}
      <path
        d="M0 300 C90 262 140 292 210 276 C280 260 330 292 400 282 C470 272 520 296 600 278 C670 262 730 292 800 282 L800 300 Z"
        fill="rgba(0,0,0,0.6)"
      />
    </g>
  );
}

function HoopScene({ uid, tilt, hue }: { uid: string; tilt: number; hue: number }) {
  return (
    <g transform={`rotate(${tilt * 0.5} 400 250)`}>
      <path d="M0 380 L800 372 L800 500 L0 500 Z" fill={`url(#floor-${uid})`} />
      <g>
        <rect x="388" y="250" width="14" height="140" fill="rgba(0,0,0,0.75)" />
        <rect
          x="262"
          y="92"
          width="278"
          height="168"
          rx="6"
          fill="rgba(255,255,255,0.13)"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="4"
        />
        <rect
          x="348"
          y="168"
          width="106"
          height="70"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="4"
        />
        {/* obręcz */}
        <ellipse
          cx="401"
          cy="252"
          rx="66"
          ry="15"
          fill="none"
          stroke={`hsl(${hue} 92% 55%)`}
          strokeWidth="7"
        />
        {/* siatka */}
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" fill="none">
          {Array.from({ length: 11 }).map((_, i) => {
            const a = (i / 11) * Math.PI * 2;
            const x1 = 401 + Math.cos(a) * 66;
            const y1 = 252 + Math.sin(a) * 15;
            const x2 = 401 + Math.cos(a) * 26;
            return <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${300} ${x2} 330`} />;
          })}
          <ellipse cx="401" cy="286" rx="48" ry="10" />
          <ellipse cx="401" cy="312" rx="34" ry="8" />
        </g>
      </g>
    </g>
  );
}

function SurfaceScene({ uid, hue, seed }: { uid: string; hue: number; seed: number }) {
  const cracks = Array.from({ length: 9 }).map((_, i) => {
    const x = ((seed * (i + 3) * 53) % 760) + 20;
    const y = ((seed * (i + 7) * 31) % 460) + 20;
    return `M${x} ${y} l${28 + (i % 5) * 14} ${16 - (i % 4) * 11} l${18 - (i % 3) * 9} ${22 + (i % 3) * 8}`;
  });
  return (
    <g>
      <rect width="800" height="500" fill={`url(#floor-${uid})`} />
      <rect width="800" height="500" fill={`hsl(${hue} 30% 22%)`} opacity="0.5" />
      <g stroke="rgba(0,0,0,0.45)" strokeWidth="2" fill="none">
        {cracks.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path
        d="M-20 340 Q 400 300 820 350 L820 392 Q 400 342 -20 382 Z"
        fill="rgba(255,255,255,0.55)"
        opacity="0.75"
      />
      <circle cx="620" cy="120" r="140" fill="rgba(0,0,0,0.28)" />
    </g>
  );
}
