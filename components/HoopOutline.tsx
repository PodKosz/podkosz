/**
 * Kosz widziany od przodu - tablica, obręcz i siatka, rysowane tą samą kreską co kontur
 * boiska z sekcji „O nas": włosowe linie w gradiencie marki, każda wygasająca na własnych
 * końcach, plus delikatna poświata pod całością.
 *
 * Siatkę składamy w pętli, a nie z wypisanych ścieżek: jeden zestaw liczb (promienie,
 * wysokości, liczba splotów) trzyma rysunek w proporcji, a przy zmianie gęstości nie trzeba
 * przeliczać dwudziestu krzywych ręcznie.
 *
 * Każdy kształt ma `pathLength={1}`, więc jedna reguła CSS („rysowanie" strokiem) domyka
 * linie w miarę przewijania strony - tak samo jak kontur boiska na „O nas".
 *
 * `uid` musi być inny dla każdego wystąpienia na stronie - identyfikatory gradientów w SVG
 * są globalne i przy powtórzeniu przeglądarka bierze pierwszy z dokumentu.
 */

/** Obręcz: środek, promienie. Siatka wisi pod nią i zwęża się do dolnego kółka. */
const OBRECZ = { cx: 240, cy: 250, rx: 92, ry: 17 };
const DOL = { cy: 384, rx: 42, ry: 9 };
/** Ile splotów siatki - tyle samo punktów na obręczy i na dolnym kółku. */
const SPLOTY = 14;
/** Pierścienie siatki: wysokość i promienie, od najszerszego pod obręczą. */
const PIERSCIENIE = [
  { cy: 288, rx: 78, ry: 14 },
  { cy: 322, rx: 64, ry: 12 },
  { cy: 354, rx: 52, ry: 10 },
];

function sploty(): string[] {
  const out: string[] = [];

  for (let i = 0; i < SPLOTY; i++) {
    const kat = (i / SPLOTY) * Math.PI * 2;
    const x1 = OBRECZ.cx + OBRECZ.rx * Math.cos(kat);
    const y1 = OBRECZ.cy + OBRECZ.ry * Math.sin(kat);
    const x2 = OBRECZ.cx + DOL.rx * Math.cos(kat);
    const y2 = DOL.cy + DOL.ry * Math.sin(kat);

    /*
      Punkt kontrolny ciągnie splot do środka: prosta linia dawała stożek jak z papieru,
      a siatka pod obręczą zwisa łukiem.
    */
    const cx = x1 + (x2 - x1) * 0.62;
    const cy = y1 + (y2 - y1) * 0.42;

    out.push(
      `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(
        1
      )} ${y2.toFixed(1)}`
    );
  }

  return out;
}

export function HoopOutline({
  uid = "hoop-outline",
  className = "",
}: {
  uid?: string;
  className?: string;
}) {
  const poziom = `url(#hoop-h-${uid})`;
  const pion = `url(#hoop-v-${uid})`;
  const bok = `url(#hoop-s-${uid})`;

  return (
    <svg
      viewBox="0 0 480 440"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 20px rgba(255,122,24,.26))" }}
    >
      <defs>
        {/* gradient liczony per element, więc każda linia gaśnie na swoich końcach */}
        <linearGradient id={`hoop-h-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,122,24,0)" />
          <stop offset="0.2" stopColor="rgba(255,150,60,0.6)" />
          <stop offset="0.5" stopColor="rgba(255,186,110,1)" />
          <stop offset="0.8" stopColor="rgba(255,150,60,0.6)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>

        {/* wersja pionowa - splot siatki jest wąski, poziomy gradient by go nie pomalował */}
        <linearGradient id={`hoop-v-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,186,110,0.9)" />
          <stop offset="0.72" stopColor="rgba(255,150,60,0.4)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>

        {/* symetryczny pionowy - do boków tablicy, żeby gasły u góry i u dołu jednakowo */}
        <linearGradient id={`hoop-s-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,122,24,0)" />
          <stop offset="0.22" stopColor="rgba(255,150,60,0.6)" />
          <stop offset="0.5" stopColor="rgba(255,186,110,1)" />
          <stop offset="0.78" stopColor="rgba(255,150,60,0.6)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>
      </defs>

      <g stroke={poziom} strokeLinecap="round" strokeLinejoin="round">
        {/*
          Tablica na cztery osobne kreski, a nie jeden `rect`. Gradient jest liczony na
          pudełku elementu, więc w prostokącie oba pionowe boki wypadają dokładnie na
          przezroczystych końcach gradientu i po prostu się nie rysują - dokładnie ten sam
          haczyk, na którym potknęły się tablice w konturze boiska.
        */}
        <path pathLength={1} d="M86 26h308M86 222h308" strokeWidth="2.4" />
        <path pathLength={1} d="M86 26v196M394 26v196" strokeWidth="2.4" stroke={bok} />
        <path pathLength={1} d="M192 112h96M192 188h96" strokeWidth="1.6" />
        <path pathLength={1} d="M192 112v76M288 112v76" strokeWidth="1.6" stroke={bok} />

        {/* mocowanie obręczy do tablicy */}
        <path pathLength={1} d="M228 222v14h24v-14" strokeWidth="1.8" />

        {/* obręcz */}
        <ellipse pathLength={1} cx={OBRECZ.cx} cy={OBRECZ.cy} rx={OBRECZ.rx} ry={OBRECZ.ry} strokeWidth="2.8" />

        {/* pierścienie siatki */}
        {PIERSCIENIE.map((p) => (
          <ellipse pathLength={1}
            key={p.cy}
            cx={OBRECZ.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            strokeWidth="1.3"
          />
        ))}
        <ellipse pathLength={1} cx={OBRECZ.cx} cy={DOL.cy} rx={DOL.rx} ry={DOL.ry} strokeWidth="1.3" />
      </g>

      {/* sploty siatki - pionowy gradient, żeby gasły ku dołowi */}
      <g stroke={pion} strokeWidth="1.2" strokeLinecap="round">
        {sploty().map((d) => (
          <path pathLength={1} key={d} d={d} />
        ))}
      </g>

      {/* słupek za tablicą - ledwo widoczny, tylko żeby kosz nie wisiał w powietrzu */}
      <path pathLength={1}
        d="M240 26v-20"
        stroke="rgba(255,150,60,0.22)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
