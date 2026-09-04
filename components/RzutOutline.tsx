/**
 * Rzut do kosza - piłka, tor lotu i obręcz, rysowane tą samą włosową kreską co kontur
 * boiska i kosza w innych sekcjach.
 *
 * Ranking graczy potrzebował własnego znaku, innego niż kosz spod rankingu boisk. Sam kosz
 * mówi „miejsce"; tu chodzi o ludzi i o to, co robią, więc rysunkiem jest RUCH: piłka
 * wychodzi z lewego dolnego rogu, tor wznosi się przez kadr i opada w obręcz. Przy
 * przewijaniu strony linie domykają się po kolei, więc rzut dosłownie leci wraz z czytaniem.
 *
 * Kolejność elementów w drzewie jest kolejnością rysowania (patrz `.kontur-rysowany`
 * w globals.css, gdzie kolejne kształty startują z innym „niedokończeniem"), dlatego piłka
 * jest pierwsza, tor drugi, a kosz na końcu - inaczej rzut kończyłby się, zanim się zacznie.
 *
 * `uid` musi być inny dla każdego wystąpienia na stronie: identyfikatory gradientów w SVG
 * są globalne i przy powtórzeniu przeglądarka bierze pierwszy z dokumentu.
 */

/** Piłka w lewym dolnym rogu - środek i promień. Z nich liczą się też południki. */
const PILKA = { cx: 176, cy: 486, r: 96 };
/** Obręcz w prawym górnym rogu; tablica wisi tuż nad nią. */
const OBRECZ = { cx: 726, cy: 214, rx: 74, ry: 15 };
/** Ile splotów siatki pod obręczą. */
const SPLOTY = 9;

/** Południki piłki - łuki o malejącej szerokości, jak na kuli w rzucie prostokątnym. */
function poludniki(): string[] {
  const { cx, cy, r } = PILKA;
  return [0.34, 0.72].flatMap((f) => [
    `M${cx} ${cy - r}C${cx + r * f} ${cy - r * 0.55} ${cx + r * f} ${cy + r * 0.55} ${cx} ${cy + r}`,
    `M${cx} ${cy - r}C${cx - r * f} ${cy - r * 0.55} ${cx - r * f} ${cy + r * 0.55} ${cx} ${cy + r}`,
  ]);
}

/** Siatka: od obręczy w dół, ku wspólnemu, węższemu kółku. */
function siatka(): string[] {
  const out: string[] = [];
  const dolCy = OBRECZ.cy + 62;
  const dolRx = OBRECZ.rx * 0.46;

  for (let i = 0; i < SPLOTY; i++) {
    const kat = (i / SPLOTY) * Math.PI * 2;
    const x1 = OBRECZ.cx + OBRECZ.rx * Math.cos(kat);
    const y1 = OBRECZ.cy + OBRECZ.ry * Math.sin(kat);
    const x2 = OBRECZ.cx + dolRx * Math.cos(kat);
    const y2 = dolCy + OBRECZ.ry * 0.5 * Math.sin(kat);
    /* punkt kontrolny ciągnie splot do środka - prosta linia dawała stożek jak z papieru */
    out.push(`M${x1} ${y1}Q${(x1 + x2) / 2 + (OBRECZ.cx - x1) * 0.16} ${(y1 + y2) / 2} ${x2} ${y2}`);
  }
  return out;
}

export function RzutOutline({
  uid = "rzut",
  className = "",
}: {
  uid?: string;
  className?: string;
}) {
  const linia = `url(#rzut-linia-${uid})`;

  return (
    <svg
      viewBox="0 0 900 640"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 22px rgb(var(--rgb-flame) / .22))" }}
    >
      <defs>
        {/*
          Gradient liczony względem pudełka każdego elementu (domyślny objectBoundingBox),
          więc KAŻDA linia gaśnie na swoich końcach, a nie tylko przy krawędziach kadru.
          Element o zerowej szerokości pudełka (linia idealnie pionowa) nie ma jak takiego
          gradientu rozłożyć - takim dajemy stały kolor.
        */}
        <linearGradient id={`rzut-linia-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--rgb-flame) / 0)" />
          <stop offset="0.2" stopColor="rgb(var(--rgb-glow) / 0.6)" />
          <stop offset="0.5" stopColor="rgb(var(--rgb-glow) / 0.95)" />
          <stop offset="0.8" stopColor="rgb(var(--rgb-glow) / 0.6)" />
          <stop offset="1" stopColor="rgb(var(--rgb-flame) / 0)" />
        </linearGradient>
      </defs>

      <g stroke={linia} strokeLinecap="round" strokeLinejoin="round">
        {/* piłka */}
        <circle pathLength={1} cx={PILKA.cx} cy={PILKA.cy} r={PILKA.r} strokeWidth="2.2" />
        <path
          pathLength={1}
          d={`M${PILKA.cx - PILKA.r} ${PILKA.cy}h${PILKA.r * 2}`}
          strokeWidth="1.5"
        />
        {poludniki().map((d, i) => (
          <path key={i} pathLength={1} d={d} strokeWidth="1.4" />
        ))}

        {/*
          Tor lotu. Jedna krzywa trzeciego stopnia zamiast łuku okręgu: rzut ma wznosić się
          stromo tuż za piłką i opadać niemal pionowo w obręcz, a okrąg jest symetryczny
          i wygląda przy tym jak tęcza.
        */}
        <path
          pathLength={1}
          d="M262 432C392 300 470 88 640 118C700 129 718 168 726 198"
          strokeWidth="1.8"
          strokeDasharray="0"
        />

        {/* tablica - pionowa krawędź ma stały kolor, bo gradient per element jej nie obejmie */}
        <path
          pathLength={1}
          d={`M${OBRECZ.cx + 96} ${OBRECZ.cy - 96}v132`}
          strokeWidth="2"
          stroke="rgb(var(--rgb-glow) / 0.3)"
        />
        <path
          pathLength={1}
          d={`M${OBRECZ.cx + 40} ${OBRECZ.cy - 84}h112`}
          strokeWidth="1.6"
        />

        {/* obręcz i siatka */}
        <ellipse
          pathLength={1}
          cx={OBRECZ.cx}
          cy={OBRECZ.cy}
          rx={OBRECZ.rx}
          ry={OBRECZ.ry}
          strokeWidth="2.4"
        />
        {siatka().map((d, i) => (
          <path key={i} pathLength={1} d={d} strokeWidth="1.1" />
        ))}
      </g>
    </svg>
  );
}
