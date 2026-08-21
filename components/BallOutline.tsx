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

/** Ile południków. Z obwodem i szwem poziomym daje osiem linii - tyle, ile ma piłka. */
const POLUDNIKOW = 6;

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

      {/* szew poziomy - równik, jedyna linia, która przy obrocie stoi w miejscu */}
      <path d="M24 200h352" stroke={poziom} strokeWidth="1.6" />

      {/*
        Sześć południków. Każdy jest tym samym łukiem wybrzuszonym w prawo, a CSS przesuwa
        jego grzbiet z prawej na lewą stronę - stąd wrażenie obrotu w lewo. Każdy startuje
        z innym opóźnieniem, więc na kuli zawsze widać kilka linii w różnych fazach, ale
        wszystkie idą w tę samą stronę. Wcześniej południki odbijały się w miejscu i wyglądało
        to jak drganie, a nie obrót.
      */}
      {Array.from({ length: POLUDNIKOW }, (_, k) => (
        <path
          key={k}
          className="pilka-szew"
          style={{ ["--k" as string]: k }}
          d={POLUDNIK}
          stroke={pion}
          strokeWidth="1.7"
        />
      ))}
    </svg>
  );
}
