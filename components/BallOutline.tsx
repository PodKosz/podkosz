/**
 * Zarys piłki do koszykówki - ta sama kreska co kontur boiska i kosz w tle: włosowe linie
 * w gradiencie marki, każda wygasająca na swoich końcach, plus delikatna poświata.
 *
 * Szwy są rysowane osobnymi ścieżkami z różnymi gradientami, bo gradient jest liczony na
 * pudełku elementu: pionowy szew w poziomym gradiencie wypadłby na przezroczystym końcu
 * i w ogóle by się nie narysował.
 *
 * `uid` musi być inny dla każdego wystąpienia na stronie - identyfikatory gradientów w SVG
 * są globalne i przy powtórzeniu przeglądarka bierze pierwszy z dokumentu.
 */
/** Południk piłki: łuk od bieguna do bieguna, wybrzuszony w prawo o 88 jednostek. */
const POLUDNIK = "M200 24C247 62 288 124 288 200C288 276 247 338 200 376";

export function BallOutline({
  uid = "ball-outline",
  className = "",
}: {
  uid?: string;
  className?: string;
}) {
  const poziom = `url(#ball-h-${uid})`;
  const pion = `url(#ball-v-${uid})`;

  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 22px rgba(255,122,24,.22))" }}
    >
      <defs>
        <linearGradient id={`ball-h-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,122,24,0)" />
          <stop offset="0.22" stopColor="rgba(255,150,60,0.55)" />
          <stop offset="0.5" stopColor="rgba(255,186,110,0.95)" />
          <stop offset="0.78" stopColor="rgba(255,150,60,0.55)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>

        <linearGradient id={`ball-v-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,122,24,0)" />
          <stop offset="0.22" stopColor="rgba(255,150,60,0.55)" />
          <stop offset="0.5" stopColor="rgba(255,186,110,0.95)" />
          <stop offset="0.78" stopColor="rgba(255,150,60,0.55)" />
          <stop offset="1" stopColor="rgba(255,122,24,0)" />
        </linearGradient>
      </defs>

      {/* obwód piłki */}
      <circle cx="200" cy="200" r="176" stroke={poziom} strokeWidth="2.6" />

      {/* szew poziomy - przez środek */}
      <path d="M24 200h352" stroke={poziom} strokeWidth="1.8" />

      {/*
        Cztery południki - wszystkie tym samym łukiem, wybrzuszonym w prawo. To ważne: gdy
        każdy szew miał własny kierunek wygięcia, przy obrocie leciały raz w jedną, raz w
        drugą stronę i nachodziły na siebie. Z jednym kształtem znak skali (`scaleX`) sam
        odbija łuk na drugą stronę, więc cały wzór przesuwa się zgodnie w jedną stronę - tak
        jak szwy na kręcącej się piłce.

        Fazy są rozłożone co 45°, dzięki czemu zawsze widać kilka łuków w różnych etapach
        obrotu i nigdzie nie robi się pusto.
      */}
      <path className="pilka-szew pilka-szew-a" d={POLUDNIK} stroke={pion} strokeWidth="1.7" />
      <path className="pilka-szew pilka-szew-b" d={POLUDNIK} stroke={pion} strokeWidth="1.7" />
      <path className="pilka-szew pilka-szew-c" d={POLUDNIK} stroke={pion} strokeWidth="1.7" />
      <path className="pilka-szew pilka-szew-d" d={POLUDNIK} stroke={pion} strokeWidth="1.7" />
    </svg>
  );
}
