import type { IdMiejsca } from "@/lib/minigra";

/**
 * Tła minigry - dwie kreskówkowe sceny, płaskie i bez detali.
 *
 * Rysunek jest tłem, nie ilustracją: ma powiedzieć „to Venice" albo „to Nowy Jork"
 * jednym rzutem oka i zniknąć z pola uwagi, bo patrzy się na piłkę i na kosz. Stąd płaskie
 * plamy koloru, brak cieni i brak kreski - wszystko, co dodatkowe, zabierałoby czytelność
 * lecącej piłce.
 *
 * Sceny są w SVG, a nie w obrazkach: ważą tyle co nic, skalują się na dowolny ekran
 * i rysują się razem ze stroną, więc gra nigdy nie zaczyna się na białym tle.
 */
export function TloBoiska({ miejsce }: { miejsce: IdMiejsca }) {
  return (
    <svg
      viewBox="0 0 1000 680"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {miejsce === "venice" ? <Venice /> : <Manhattan />}
    </svg>
  );
}

/* ---------------------------------------------------------------- Venice */

function Venice() {
  return (
    <>
      <defs>
        <linearGradient id="gra-niebo-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a4a86" />
          <stop offset="0.45" stopColor="#e97a4a" />
          <stop offset="0.75" stopColor="#ffb46a" />
          <stop offset="1" stopColor="#ffd79a" />
        </linearGradient>
        <linearGradient id="gra-ocean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6f8f" />
          <stop offset="1" stopColor="#2f9ab0" />
        </linearGradient>
        <linearGradient id="gra-piach" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c98a" />
          <stop offset="1" stopColor="#d8a765" />
        </linearGradient>
      </defs>

      <rect width="1000" height="680" fill="url(#gra-niebo-v)" />

      {/* słońce nisko nad wodą */}
      <circle cx="760" cy="300" r="66" fill="#ffe6a8" opacity=".9" />

      {/* ocean i linia brzegu */}
      <rect y="330" width="1000" height="90" fill="url(#gra-ocean)" />
      <path d="M0 418h1000v14H0z" fill="#ffffff" opacity=".5" />

      {/* piasek */}
      <rect y="430" width="1000" height="250" fill="url(#gra-piach)" />

      {/* asfalt boiska - to na nim stoi gracz */}
      <path d="M60 520h880l60 160H0z" fill="#8c8f97" />
      <path d="M60 520h880l60 160H0z" fill="#000" opacity=".08" />
      {/* linia rzutów wolnych, mocno skrócona perspektywą */}
      <path d="M300 566h400" stroke="#fdfdfd" strokeWidth="4" opacity=".55" />
      <path d="M232 640h536" stroke="#fdfdfd" strokeWidth="5" opacity=".45" />

      {/* palmy - trzy sylwetki, każda z innym pochyleniem */}
      <Palma x={120} y={520} skala={1} przechyl={-6} />
      <Palma x={952} y={512} skala={0.86} przechyl={5} />
      <Palma x={330} y={498} skala={0.6} przechyl={-2} />
    </>
  );
}

function Palma({
  x,
  y,
  skala,
  przechyl,
}: {
  x: number;
  y: number;
  skala: number;
  przechyl: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${skala}) rotate(${przechyl})`}>
      <path d="M0 0c6-60 8-120 2-176" stroke="#6b4b2a" strokeWidth="11" fill="none" />
      <g fill="#2f7d4f">
        <path d="M2-176c-38-10-72 4-92 30 34-10 62-8 88 6Z" />
        <path d="M2-176c38-10 72 4 92 30-34-10-62-8-88 6Z" />
        <path d="M2-176c-16-34-48-52-84-52 26 20 44 42 78 62Z" />
        <path d="M2-176c16-34 48-52 84-52-26 20-44 42-78 62Z" />
        <path d="M2-178c0-30 18-58 46-74-12 30-18 54-40 82Z" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------- Manhattan */

function Manhattan() {
  const domy = [
    { x: 0, w: 130, h: 330, kolor: "#2b3550" },
    { x: 120, w: 96, h: 250, kolor: "#354063" },
    { x: 210, w: 140, h: 400, kolor: "#242e46" },
    { x: 344, w: 110, h: 300, kolor: "#303b5c" },
    { x: 448, w: 86, h: 380, kolor: "#28324c" },
    { x: 528, w: 132, h: 268, kolor: "#354063" },
    { x: 654, w: 104, h: 356, kolor: "#242e46" },
    { x: 752, w: 128, h: 296, kolor: "#2f3a58" },
    { x: 874, w: 126, h: 372, kolor: "#28324c" },
  ];

  return (
    <>
      <defs>
        <linearGradient id="gra-niebo-m" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101a33" />
          <stop offset="0.55" stopColor="#33406b" />
          <stop offset="1" stopColor="#7c5f8a" />
        </linearGradient>
      </defs>

      <rect width="1000" height="680" fill="url(#gra-niebo-m)" />

      {/* księżyc */}
      <circle cx="180" cy="120" r="34" fill="#e9e6f5" opacity=".85" />

      {/* pierzeja - bloki z oknami */}
      {domy.map((d, i) => (
        <g key={i}>
          <rect x={d.x} y={520 - d.h} width={d.w} height={d.h} fill={d.kolor} />
          {Array.from({ length: Math.floor(d.h / 46) }, (_, r) =>
            Array.from({ length: Math.max(1, Math.floor(d.w / 34)) }, (_, c) => {
              /* światła zapalone deterministycznie - inaczej migotałyby przy każdym renderze */
              const zapalone = (i * 7 + r * 5 + c * 3) % 4 !== 0;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={d.x + 12 + c * 34}
                  y={520 - d.h + 20 + r * 46}
                  width="14"
                  height="20"
                  fill={zapalone ? "#ffd98a" : "#1b2338"}
                  opacity={zapalone ? 0.85 : 0.7}
                />
              );
            })
          )}
        </g>
      ))}

      {/* most w tle - sam zarys pylonu i lin */}
      <g stroke="#1b2338" fill="none" strokeWidth="6" opacity=".75">
        <path d="M640 520V300h56v220" />
        <path d="M640 330h56M640 366h56" />
        <path d="M400 470c120-120 240-120 296-140M992 470c-120-120-240-120-296-140" />
      </g>

      {/* mur z cegły i asfalt */}
      <rect y="470" width="1000" height="60" fill="#6b3a2e" />
      {Array.from({ length: 26 }, (_, i) => (
        <path
          key={i}
          d={`M${i * 40} 470v60`}
          stroke="#000"
          strokeWidth="2"
          opacity=".16"
        />
      ))}
      <path d="M0 500h1000" stroke="#000" strokeWidth="2" opacity=".16" />

      <path d="M0 530h1000l0 150H0z" fill="#3d4250" />
      <path d="M300 576h400" stroke="#c9ced9" strokeWidth="4" opacity=".4" />
      <path d="M232 648h536" stroke="#c9ced9" strokeWidth="5" opacity=".32" />
    </>
  );
}
