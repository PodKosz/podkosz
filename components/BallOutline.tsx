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
        Trzy szwy „pionowe" to południki piłki. Każdy dostaje własną klasę, bo przy obrocie
        kuli ich szerokość zmienia się z innym przesunięciem fazy: gdy jeden jest najszerszy,
        drugi stoi już bokiem do nas i wygląda jak prosta kreska. Resztę roboty robi CSS.
      */}
      <path
        className="pilka-szew pilka-szew-a"
        d="M200 24v352"
        stroke={pion}
        strokeWidth="1.8"
      />
      <path
        className="pilka-szew pilka-szew-b"
        d="M200 24c-58 44-88 106-88 176s30 132 88 176"
        stroke={pion}
        strokeWidth="1.6"
      />
      <path
        className="pilka-szew pilka-szew-c"
        d="M200 24c58 44 88 106 88 176s-30 132-88 176"
        stroke={pion}
        strokeWidth="1.6"
      />
    </svg>
  );
}
