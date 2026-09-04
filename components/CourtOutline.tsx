/**
 * Kontur boiska do koszykówki widzianego z góry - cienkie linie w gradiencie marki.
 *
 * Każdy kształt ma `pathLength={1}`, czyli własną długość opisaną jako jedynka. Dzięki temu
 * jedna reguła CSS (`stroke-dasharray: 1` i malejący `stroke-dashoffset`) „rysuje" po kolei
 * wszystkie linie - bez tego trzeba by znać rzeczywistą długość każdego łuku osobno.
 *
 * Rysunek jest ozdobą, nie ilustracją: ma dawać tło, które od razu mówi „koszykówka",
 * bez konkurowania z treścią. Dlatego linie są włosowe, gradient wygasza je po bokach,
 * a maska rozpuszcza dolną krawędź w tle karty.
 *
 * `uid` musi być inny dla każdego wystąpienia na stronie - identyfikatory gradientów
 * w SVG są globalne i przy powtórzeniu przeglądarka bierze pierwszy z dokumentu
 * (na tym potknęło się już logo w nagłówku).
 */
/**
 * Plamy słabszego nacisku - to one robią ze rysunku szkic.
 *
 * Równa kreska na całej długości czyta się jak rysunek techniczny: każda linia ma tę samą
 * siłę, więc widać, że stawiała ją maszyna. Ręka nie umie tak - naciska mocniej tam, gdzie
 * patrzy, i puszcza w miejscach, które rysuje mimochodem. Kilka miękkich plam przygaszenia
 * położonych NIE po linii, a po obrazie, przecina różne linie w różnych miejscach i ta
 * nierówność wystarcza.
 *
 * Plamy są w układzie rysunku (`userSpaceOnUse`), nie w pudełkach poszczególnych linii.
 * Gdyby siedziały w pudełkach, wszystkie linie przygasałyby na tej samej WZGLĘDNEJ
 * długości i równoległe linie płyty zgasłyby w jednym pionie - z nierówności zrobiłby się
 * wzór, czyli znowu maszyna.
 *
 * [x, y, promień poziomy, promień pionowy, siła przygaszenia]
 */
const PLAMY: [number, number, number, number, number][] = [
  [120, 84, 230, 120, 0.5],
  [520, 52, 190, 96, 0.36],
  [712, 296, 200, 150, 0.52],
  [330, 408, 250, 108, 0.42],
  [438, 226, 132, 88, 0.28],
  [56, 336, 120, 100, 0.34],
  [800, 96, 130, 84, 0.3],
  /* mniejsze i mocniejsze - miejsca, w których kreska prawie puszcza */
  [246, 232, 78, 62, 0.58],
  [604, 128, 88, 54, 0.5],
  [672, 420, 96, 70, 0.55],
  [104, 196, 62, 74, 0.46],
];

export function CourtOutline({
  uid = "court-outline",
  className = "",
  szkic = false,
}: {
  uid?: string;
  className?: string;
  /** przygasza kreskę miejscami, żeby rysunek wyglądał jak szkic ręką, nie jak plan */
  szkic?: boolean;
}) {
  const linia = `url(#line-${uid})`;

  /*
    preserveAspectRatio="none" rozciąga rysunek dokładnie na blok, w którym siedzi.
    Proporcje boiska (1,83) i karty różnią się o kilka procent, więc zniekształcenie jest
    niewidoczne, a linie dochodzą do wszystkich krawędzi zamiast kończyć się w powietrzu.
  */
  return (
    <svg
      viewBox="0 0 840 460"
      preserveAspectRatio="none"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 18px rgb(var(--rgb-flame) / .28))" }}
    >
      <defs>
        {/*
          Gradient liczony osobno dla każdego elementu (domyślny objectBoundingBox): dzięki
          temu KAŻDA linia gaśnie na swoich końcach, a nie tylko przy krawędziach kadru.
          To właśnie daje efekt rozpływających się boków boiska.

          Haczyk: element o zerowej szerokości pudełka (czysto pionowa linia) nie ma jak
          takiego gradientu rozłożyć i w ogóle się nie rysuje - linia środkowa dostaje
          więc własny, stały kolor (patrz niżej).
        */}
        {/*
          Krańce linii są przezroczyste, ale przez zmienną `--kontur-koniec` - i tylko po to,
          żeby dało się je gdzieś zapalić. Domyślnie zero, czyli jak było: rysunek rozpływa
          się w tle karty. Zasłona przed premierą ustawia tę zmienną na ekranach szerszych
          niż telefon, bo tam kontur ma dochodzić do samej krawędzi ekranu pełną kreską -
          strefa wygaszenia zajmuje skrajne 18% każdej linii i przy tym kadrze wypadała
          w środku obrazu, więc linie kończyły się w powietrzu.
        */}
        <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(var(--rgb-glow) / var(--kontur-koniec, 0))" />
          <stop offset="0.18" stopColor="rgb(var(--rgb-glow) / 0.65)" />
          <stop offset="0.5" stopColor="rgb(var(--rgb-glow))" />
          <stop offset="0.82" stopColor="rgb(var(--rgb-glow) / 0.65)" />
          <stop offset="1" stopColor="rgb(var(--rgb-glow) / var(--kontur-koniec, 0))" />
        </linearGradient>

        {szkic && (
          <>
            <radialGradient id={`plama-${uid}`}>
              <stop offset="0" stopColor="#000" stopOpacity="0.85" />
              <stop offset="0.55" stopColor="#000" stopOpacity="0.4" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            {/*
              Maska luminancyjna: biel to pełna siła kreski, plamy odejmują. Miękkie brzegi
              każdej plamy są konieczne - twarda krawędź maski przecięłaby linię w widoczny
              sposób i wyglądałaby jak wytarcie, nie jak lżejszy nacisk.
            */}
            <mask id={`szkic-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="840" height="460">
              <rect width="840" height="460" fill="#fff" />
              {PLAMY.map(([cx, cy, rx, ry, moc], i) => (
                <ellipse
                  key={i}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={`url(#plama-${uid})`}
                  opacity={moc}
                />
              ))}
            </mask>
          </>
        )}
      </defs>

      <g
        stroke={linia}
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={szkic ? `url(#szkic-${uid})` : undefined}
      >
        {/* płyta boiska */}
        <rect pathLength={1} x="40" y="40" width="760" height="380" rx="6" strokeWidth="2.4" />

        {/* linia środkowa - stały kolor, bo gradient per element nie działa na pionowej linii */}
        <path pathLength={1} d="M420 40v380" strokeWidth="1.6" stroke="rgb(var(--rgb-glow) / 0.5)" />
        <circle pathLength={1} cx="420" cy="230" r="62" strokeWidth="1.8" />

        {/* pola podkoszowe z półkolami rzutów wolnych */}
        <path pathLength={1} d="M40 140h150v180H40" strokeWidth="1.8" />
        <path pathLength={1} d="M190 170a60 60 0 0 1 0 120" strokeWidth="1.6" />
        <path pathLength={1} d="M800 140h-150v180h150" strokeWidth="1.8" />
        <path pathLength={1} d="M650 170a60 60 0 0 0 0 120" strokeWidth="1.6" />

        {/* łuki za trzy punkty */}
        <path pathLength={1} d="M40 92h34a186 186 0 0 1 0 276H40" strokeWidth="1.6" />
        <path pathLength={1} d="M800 92h-34a186 186 0 0 0 0 276h34" strokeWidth="1.6" />

        {/* tablice i obręcze - tablice mają stały, ledwo widoczny kolor, bo leżą dokładnie
            tam, gdzie gradient wygasza rysunek; bez tego nie rysowałyby się wcale */}
        <g strokeWidth="2.6">
          <path pathLength={1} d="M62 196v68M778 196v68" stroke="rgb(var(--rgb-glow) / 0.26)" />
          <circle pathLength={1} cx="76" cy="230" r="9" strokeWidth="1.8" />
          <circle pathLength={1} cx="764" cy="230" r="9" strokeWidth="1.8" />
        </g>
      </g>
    </svg>
  );
}
