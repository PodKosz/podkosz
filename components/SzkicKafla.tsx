/**
 * Rysunki do kafelków z parametrami boiska - w tym samym języku, co obrysy w tle rankingu,
 * strony graczy i „o nas" (patrz `CourtOutline`): włosowa kreska w barwie marki, gasnąca
 * przy krawędziach rysunku, i maska z miękkimi plamami, która miejscami przygasza
 * nacisk. To ostatnie robi z rysunku szkic: równa kreska na całej długości czyta się jak
 * plan techniczny, bo widać, że stawiała ją maszyna. Ręka naciska mocniej tam, gdzie
 * patrzy, i puszcza na tym, co rysuje mimochodem.
 *
 * ------------------------------------------------------------------ czym to nie jest
 *
 * To nie ikona informacyjna. Wartość kafelka mówi napis na wierzchu, a rysunek jest pod
 * nim i jest przygaszony - ma dawać kafelkowi charakter i podpowiadać temat rzutem oka,
 * nie zastępować treści. Dlatego `aria-hidden` i dlatego kreska jest cienka: gdyby była
 * mocniejsza, konkurowałaby z napisem, który jest tu najważniejszy.
 *
 * ------------------------------------------------------------------ dlaczego `uid`
 *
 * Identyfikatory gradientów i masek w SVG są globalne w dokumencie. Sześć kafelków to
 * sześć rysunków na jednej stronie, więc każdy musi mieć własne - inaczej przeglądarka
 * bierze pierwszy z dokumentu i wszystkie kafelki dostają maskę pierwszego. Tu `uid`
 * bierze się z rodzaju rysunku, a rodzaj jest w kafelku jeden.
 *
 * Plamy też zależą od rodzaju: ta sama plama w tym samym miejscu na sześciu rysunkach
 * dałaby wzór, a wzór to znowu maszyna. Przesunięcie liczone z nazwy rodzaju daje każdemu
 * rysunkowi własne zużycie i jest stałe między wejściami na stronę (nic nie „mruga").
 */

export type RodzajSzkicu =
  | "kosze"
  | "nawierzchnia"
  | "godziny"
  | "dostep"
  | "oswietlenie"
  | "ogrodzenie";

/* Plamy przygaszenia: [x, y, promień poziomy, promień pionowy, siła]. Układ rysunku 0-100. */
const PLAMY: [number, number, number, number, number][] = [
  [22, 30, 34, 26, 0.62],
  [74, 22, 28, 22, 0.48],
  [80, 76, 30, 24, 0.58],
  [30, 82, 32, 20, 0.5],
  [52, 50, 20, 16, 0.3],
  [12, 60, 16, 20, 0.44],
];

/** Przesunięcie plam liczone z nazwy - stałe, a różne dla każdego rodzaju. */
function ziarno(rodzaj: string) {
  let s = 0;
  for (let i = 0; i < rodzaj.length; i++) s = (s * 31 + rodzaj.charCodeAt(i)) % 997;
  return s;
}

/*
  Rysunki. Wszystkie w układzie 0-100, wszystkie z `pathLength={1}` - tak samo jak
  w `CourtOutline`, żeby dało się je kiedyś „narysować" jedną regułą CSS bez liczenia
  długości każdego łuku osobno.

  Grubości są dobrane tak, żeby to, co w przedmiocie jest konstrukcją, było grubsze od
  tego, co jest wypełnieniem: obręcz grubsza od siatki, rama ogrodzenia grubsza od oczek,
  tarcza zegara grubsza od podziałki. Bez tego rysunek robi się płaski.
*/
const RYSUNKI: Record<RodzajSzkicu, React.ReactNode> = {
  /* tablica z obręczą i siatką, widok z przodu */
  kosze: (
    <>
      <rect pathLength={1} x="26" y="14" width="48" height="34" rx="2" strokeWidth="2.2" />
      <rect pathLength={1} x="40" y="30" width="20" height="18" strokeWidth="1.4" />
      <path pathLength={1} d="M50 48v6" strokeWidth="2" />
      <ellipse pathLength={1} cx="50" cy="56" rx="14" ry="3.4" strokeWidth="2.4" />
      {/* siatka - linie zbiegające się do węzła pod obręczą */}
      <path pathLength={1} d="M37 57.5 42 74M50 59.4v16M63 57.5 58 74" strokeWidth="1.1" />
      <path pathLength={1} d="M42 74h16" strokeWidth="1.1" />
      <path pathLength={1} d="M39 63.5q11 4 22 0M40.5 69q9.5 3.4 19 0" strokeWidth="0.9" />
      {/* słup */}
      <path pathLength={1} d="M74 31h9v55" strokeWidth="1.8" />
    </>
  ),

  /* płyta z góry: łuk za trzy, prostokąt pola i faktura nawierzchni */
  nawierzchnia: (
    <>
      <path pathLength={1} d="M14 20h72v56" strokeWidth="2.2" />
      <path pathLength={1} d="M14 20v56h72" strokeWidth="2.2" />
      <path pathLength={1} d="M36 20v22h28V20" strokeWidth="1.4" />
      <path pathLength={1} d="M36 42a14 14 0 0 0 28 0" strokeWidth="1.4" />
      <path pathLength={1} d="M18 20a32 32 0 0 0 64 0" strokeWidth="1.6" />
      {/* faktura - krótkie kreski, nierówno, jak ziarno betonu */}
      <path
        pathLength={1}
        d="M22 56h7M34 62h5M46 57h8M58 64h6M28 68h6M52 70h7M40 52h5M66 54h6M24 48h4M70 68h4"
        strokeWidth="0.9"
      />
    </>
  ),

  /* zegar */
  godziny: (
    <>
      <circle pathLength={1} cx="50" cy="50" r="32" strokeWidth="2.4" />
      <path pathLength={1} d="M50 30v22l14 9" strokeWidth="2.2" />
      <path
        pathLength={1}
        d="M50 18v5M50 77v5M18 50h5M77 50h5M27.4 27.4l3.6 3.6M69 69l3.6 3.6M72.6 27.4 69 31M31 69l-3.6 3.6"
        strokeWidth="1.2"
      />
    </>
  ),

  /* otwarta brama: dwa słupki i skrzydło odchylone do środka */
  dostep: (
    <>
      <path pathLength={1} d="M20 22v58M80 22v58" strokeWidth="2.2" />
      <path pathLength={1} d="M20 80h60" strokeWidth="1.2" />
      {/* skrzydło pod kątem - to ono mówi „otwarte" */}
      <path pathLength={1} d="M80 26 52 40v34l28-14V26" strokeWidth="1.8" />
      <path pathLength={1} d="M52 47.5 80 33.5M52 61 80 47" strokeWidth="1" />
      {/* zawiasy */}
      <path pathLength={1} d="M78 32h4M78 58h4" strokeWidth="1.4" />
    </>
  ),

  /* maszt z reflektorem i snopem światła */
  oswietlenie: (
    <>
      <path pathLength={1} d="M50 34v52" strokeWidth="2.2" />
      <path pathLength={1} d="M38 86h24" strokeWidth="1.6" />
      <path pathLength={1} d="M30 26h40l-6 10H36l-6-10Z" strokeWidth="2.2" />
      <path pathLength={1} d="M43 26v10M57 26v10" strokeWidth="1.1" />
      {/* snop - rozchodzące się promienie, coraz słabsze na zewnątrz */}
      <path pathLength={1} d="M36 40 24 62M50 40v20M64 40l12 22" strokeWidth="1.1" />
      <path pathLength={1} d="M30 44 18 52M70 44l12 8" strokeWidth="0.9" />
      <path pathLength={1} d="M26 68q24 10 48 0" strokeWidth="0.9" />
    </>
  ),

  /* siatka ogrodzenia w ramie */
  ogrodzenie: (
    <>
      <path pathLength={1} d="M16 24h68M16 78h68" strokeWidth="2.2" />
      <path pathLength={1} d="M22 20v62M78 20v62" strokeWidth="2" />
      {/* oczka - dwie serie przekątnych, każda w innym kierunku */}
      <path
        pathLength={1}
        d="M22 38 36 24M22 56 54 24M22 74 72 24M32 78 78 32M50 78 78 50M68 78 78 68"
        strokeWidth="0.9"
      />
      <path
        pathLength={1}
        d="M22 38 36 78M22 56 44 78M36 24 78 66M54 24 78 48M72 24 78 30M22 28 72 78"
        strokeWidth="0.9"
      />
    </>
  ),
};

export function SzkicKafla({
  rodzaj,
  className = "",
}: {
  rodzaj: RodzajSzkicu;
  className?: string;
}) {
  const uid = `szkic-${rodzaj}`;
  const przesuniecie = ziarno(rodzaj);

  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      /* poświata jak przy obrysach na innych stronach - bez niej kreska jest sucha */
      style={{ filter: "drop-shadow(0 0 10px rgb(var(--rgb-flame) / .35))" }}
    >
      <defs>
        {/*
          GRADIENT W UKŁADZIE RYSUNKU (`userSpaceOnUse`), nie w pudełkach poszczególnych
          linii - i to jest tu inna decyzja niż w `CourtOutline`, więc wymaga uzasadnienia.

          Domyślny `objectBoundingBox` rozkłada gradient osobno w pudełku każdego elementu,
          dzięki czemu każda kreska gaśnie na swoich końcach. Ma jednak pułapkę zapisaną
          w SVG: element o zerowej szerokości ALBO wysokości pudełka nie ma jak takiego
          gradientu rozłożyć i przeglądarka go POMIJA - nie rysuje wcale. Czysto pionowa
          i czysto pozioma kreska to dokładnie ten przypadek, a rysunki przedmiotów są ich
          pełne: maszt lampy, podstawa maszt, dolna belka bramy, dno siatki kosza. Pierwsza
          wersja tego pliku miała je wszystkie i wszystkie były niewidoczne.

          `CourtOutline` może sobie pozwolić na pudełka, bo jego pionową linię środkową
          obsłużono wyjątkiem, a gaśnięcie każdej linii osobno jest tam całym efektem -
          to ono rozpuszcza boki boiska. Tutaj efekt „szkicu" robi maska z plamami, więc
          nie ma czego bronić, a układ rysunku znosi całą klasę błędów: dorysowanie prostej
          kreski nie może już sprawić, że coś po cichu zniknie.
        */}
        <linearGradient
          id={`kreska-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1="6"
          y1="0"
          x2="94"
          y2="100"
        >
          <stop offset="0" stopColor="rgb(var(--rgb-glow) / 0.15)" />
          <stop offset="0.22" stopColor="rgb(var(--rgb-glow) / 0.8)" />
          <stop offset="0.5" stopColor="rgb(var(--rgb-glow))" />
          <stop offset="0.78" stopColor="rgb(var(--rgb-glow) / 0.8)" />
          <stop offset="1" stopColor="rgb(var(--rgb-glow) / 0.15)" />
        </linearGradient>

        <radialGradient id={`plama-${uid}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.4" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/*
          Maska luminancyjna: biel to pełna siła kreski, plamy odejmują. Miękkie brzegi
          plam są konieczne - twarda krawędź przecięłaby linię widocznie i wyglądałaby jak
          wytarcie gumką, a nie jak lżejszy nacisk.

          Plamy siedzą w układzie rysunku (`userSpaceOnUse`), nie w pudełkach linii. Gdyby
          siedziały w pudełkach, wszystkie linie przygasałyby na tej samej WZGLĘDNEJ
          długości i równoległe kreski ogrodzenia zgasłyby w jednym pionie - z nierówności
          zrobiłby się wzór.
        */}
        <mask id={`maska-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          {PLAMY.map(([cx, cy, rx, ry, moc], i) => (
            <ellipse
              key={i}
              cx={(cx + przesuniecie * (i + 1)) % 100}
              cy={(cy + przesuniecie * (i + 2) * 0.7) % 100}
              rx={rx}
              ry={ry}
              fill={`url(#plama-${uid})`}
              opacity={moc}
            />
          ))}
        </mask>
      </defs>

      <g
        stroke={`url(#kreska-${uid})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#maska-${uid})`}
      >
        {RYSUNKI[rodzaj]}
      </g>
    </svg>
  );
}
