import { WeatherScene } from "@/lib/pogoda";

/**
 * Grafika pogody rysowana wektorowo - jedna scena na kafelek w prognozie.
 *
 * Rysunki zamiast zestawu ikon z paczki: mają wypełniać całe tło kafelka, a informacje
 * (godzina, temperatura, opad, wiatr) leżą na nich. Wszystko w SVG, więc nie ma dodatkowych
 * plików do pobrania i skaluje się bez rozmycia. Kolory trzymamy w klimacie serwisu:
 * ciepłe pomarańcze na dzień, granat i fiolet na noc.
 */
export function WeatherArt({
  scene,
  day,
  seed = 0,
  className = "",
}: {
  scene: WeatherScene;
  day: boolean;
  /** różnicuje losowe elementy (gwiazdy, kropki deszczu) między kafelkami */
  seed?: number;
  className?: string;
}) {
  const uid = `w-${scene}-${day ? "d" : "n"}-${seed}`;
  /* przy opadach chmury wygaszamy wyżej, żeby zostało miejsce na kreski deszczu i płatki */
  const mokro = scene === "rain" || scene === "snow" || scene === "storm";

  return (
    <svg
      viewBox="0 0 200 260"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label={`Pogoda: ${scene}`}
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          {day ? (
            <>
              <stop offset="0" stopColor={scene === "clear" ? "#3a1f10" : "#241a18"} />
              <stop offset="0.55" stopColor="#1a1210" />
              <stop offset="1" stopColor="#0d0b0c" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#16182c" />
              <stop offset="0.6" stopColor="#101018" />
              <stop offset="1" stopColor="#0a0a0e" />
            </>
          )}
        </linearGradient>

        <radialGradient id={`sun-${uid}`} cx="0.5" cy="0.5" r="0.5">
          {day ? (
            <>
              <stop offset="0" stopColor="var(--color-glow-soft)" />
              <stop offset="0.45" stopColor="var(--color-flame-soft)" />
              <stop offset="1" stopColor="var(--color-ember)" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#e8e6ff" />
              <stop offset="1" stopColor="#a9a7d8" />
            </>
          )}
        </radialGradient>

        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop
            offset="0"
            stopColor={day ? "rgb(var(--rgb-flame) / .55)" : "rgba(150,150,220,.35)"}
          />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>

        <linearGradient id={`cloud-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor={day ? "#5a4a44" : "#3a3c52"} />
          <stop offset="1" stopColor={day ? "#2c2422" : "#20222f"} />
        </linearGradient>

        {/* Chmury mają płaskie dolne krawędzie - bez wygaszenia wyglądałyby jak wycinanka
            leżąca na półce. Maska rozpuszcza ich spód w ciemności. */}
        <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset={mokro ? "0.32" : "0.5"} stopColor="#fff" />
          <stop offset={mokro ? "0.6" : "0.95"} stopColor="#000" />
        </linearGradient>
        <mask id={`mask-${uid}`}>
          <rect width="200" height="260" fill={`url(#fade-${uid})`} />
        </mask>
      </defs>

      <rect width="200" height="260" fill={`url(#sky-${uid})`} />

      {!day && <Stars uid={uid} seed={seed} />}

      {(scene === "clear" || scene === "partly") && (
        <>
          <circle cx="128" cy="72" r="78" fill={`url(#glow-${uid})`} />
          <circle cx="128" cy="72" r="30" fill={`url(#sun-${uid})`} />
          {/* na noc księżyc: wycinamy sierp drugim kołem w kolorze nieba */}
          {!day && <circle cx="140" cy="62" r="26" fill="#101018" />}
        </>
      )}

      {scene === "clear" && day && (
        /* promienie - delikatne, tylko przy pełnym słońcu */
        <g stroke="rgb(var(--rgb-glow) / .35)" strokeWidth="2.4" strokeLinecap="round">
          <path d="M128 18v-12M128 138v12M68 72h-12M188 72h12M86 30 78 22M170 30l8-8M86 114l-8 8M170 114l8 8" />
        </g>
      )}

      {(scene === "partly" || scene === "overcast" || scene === "rain" || scene === "snow" || scene === "storm") && (
        <g mask={`url(#mask-${uid})`}>
          <Clouds uid={uid} scene={scene} />
        </g>
      )}

      {scene === "fog" && (
        <g stroke={day ? "rgba(220,200,190,.30)" : "rgba(190,195,230,.26)"} strokeWidth="9" strokeLinecap="round">
          <path d="M18 96h120M40 124h140M14 152h108M52 180h132M26 208h96" />
        </g>
      )}

      {scene === "rain" && <Rain uid={uid} seed={seed} />}
      {scene === "snow" && <Snow seed={seed} />}
      {scene === "storm" && (
        <>
          <Rain uid={uid} seed={seed} />
          <path
            d="M104 148l-26 42h20l-8 34 34-48h-20z"
            fill="var(--color-glow-soft)"
            stroke="rgb(var(--rgb-flame) / .9)"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

function Clouds({ uid, scene }: { uid: string; scene: WeatherScene }) {
  const mocne = scene === "overcast" || scene === "rain" || scene === "storm" || scene === "snow";
  return (
    <g fill={`url(#cloud-${uid})`}>
      {mocne && (
        <path
          d="M-10 118c0-16 13-28 29-28 6-14 20-24 36-24 20 0 37 14 41 33 3-1 6-2 9-2 15 0 27 12 27 27 0 5-1 9-3 13V260H-10z"
          opacity="0.95"
        />
      )}
      <path
        d="M6 150c0-14 11-25 25-25 5-13 18-22 32-22 18 0 33 12 37 29 3-1 5-1 8-1 13 0 24 11 24 24 0 4-1 8-3 12V260H6z"
        opacity={mocne ? "0.9" : "0.75"}
      />
      {!mocne && (
        <path
          d="M96 176c0-11 9-20 20-20 4-10 14-17 25-17 15 0 27 11 29 25 2 0 4-1 6-1 10 0 19 9 19 19 0 3-1 6-2 9V260H96z"
          opacity="0.55"
        />
      )}
    </g>
  );
}

function Rain({ uid, seed }: { uid: string; seed: number }) {
  const kreski = Array.from({ length: 16 }, (_, i) => {
    const x = 14 + ((i * 37 + seed * 13) % 172);
    const y = 150 + ((i * 23 + seed * 7) % 80);
    return `M${x} ${y}l-5 16`;
  });
  return (
    <g stroke="rgba(150,200,255,.55)" strokeWidth="2.6" strokeLinecap="round" key={uid}>
      {kreski.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

function Snow({ seed }: { seed: number }) {
  const punkty = Array.from({ length: 18 }, (_, i) => ({
    x: 12 + ((i * 41 + seed * 11) % 176),
    y: 150 + ((i * 29 + seed * 5) % 88),
    r: 2 + ((i + seed) % 3),
  }));
  return (
    <g fill="rgba(226,236,255,.75)">
      {punkty.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} />
      ))}
    </g>
  );
}

function Stars({ uid, seed }: { uid: string; seed: number }) {
  const gwiazdy = Array.from({ length: 22 }, (_, i) => ({
    x: 8 + ((i * 53 + seed * 17) % 184),
    y: 8 + ((i * 31 + seed * 9) % 120),
    r: ((i + seed) % 3) * 0.6 + 0.7,
  }));
  return (
    <g fill="rgba(226,230,255,.8)" key={uid}>
      {gwiazdy.map((g, i) => (
        <circle key={i} cx={g.x} cy={g.y} r={g.r} opacity={0.35 + ((i % 4) * 0.18)} />
      ))}
    </g>
  );
}
