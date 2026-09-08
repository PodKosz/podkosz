/**
 * Rysunki w kafelkach z parametrami boiska - w tym samym języku, co obrysy w tle rankingu,
 * strony graczy i „o nas".
 *
 * ------------------------------------------------------------------ czym jest ten język
 *
 * Pierwsza wersja tych rysunków była kompletnymi ikonkami: cały przedmiot, wyśrodkowany,
 * cienka kreska, symetrycznie. Wyglądały jak piktogramy z instrukcji, a nie jak tło z tej
 * strony - i o to była słuszna pretensja.
 *
 * Tło rankingu jest zrobione inaczej i cały jego charakter siedzi w trzech rzeczach,
 * z których żadna nie dotyczy samego rysunku:
 *
 *   SKALA. `HoopOutline` ma kreskę grubości 2,4 w układzie 480 jednostek, ale jego pojemnik
 *   to `w-[min(1900px,215vw)]` - rysunek jest powiększony około czterokrotnie, więc kreska
 *   robi się gruba sama z siebie. Grubej kreski nie rysuje się grubą kreską, tylko
 *   powiększeniem.
 *
 *   PRZYCIĘCIE. Kosz siedzi na `bottom-[-34vh] left-[-42vw]`, czyli w większości poza
 *   ekranem. Widać jego FRAGMENT. To jest różnica między tłem a naklejką: fragment czyta
 *   się jako coś większego od kadru, a cała ikona - jako obiekt położony w kadrze.
 *
 *   PRZEKRZYWIENIE. `rotate: -6deg`. Rysunek techniczny stoi prosto; ten leży skosem.
 *
 * Te rysunki robią to samo. Każdy jest FRAGMENTEM dużego przedmiotu, obróconym i wychodzącym
 * przynajmniej dwiema krawędziami poza kafelek - dlatego współrzędne wychodzą daleko poza
 * układ 0-120, a `preserveAspectRatio="xMidYMid slice"` każe przeglądarce wypełnić kafelek
 * i obciąć nadmiar, zamiast wpasować całość w środek.
 *
 * ------------------------------------------------------------------ czym to nie jest
 *
 * To nie ikona informacyjna. Wartość kafelka mówi napis na wierzchu, a rysunek leży pod nim
 * i jest przygaszony - ma dawać kafelkowi charakter i podpowiadać temat rzutem oka, nie
 * zastępować treści. Dlatego `aria-hidden` i dlatego przezroczystość jest niska.
 *
 * ------------------------------------------------------------------ dwie pułapki SVG
 *
 * GRADIENT W UKŁADZIE RYSUNKU (`userSpaceOnUse`), nie w pudełkach elementów. Domyślny
 * `objectBoundingBox` rozkłada gradient osobno w pudełku każdego kształtu i ma zapisaną
 * w SVG pułapkę: element o zerowej szerokości ALBO wysokości pudełka nie ma jak go rozłożyć
 * i przeglądarka POMIJA go w całości. Czysto pionowa i czysto pozioma kreska to dokładnie
 * ten przypadek, a rysunki przedmiotów są ich pełne - maszty, belki, słupki. Wcześniejsza
 * wersja tego pliku miała cztery takie kreski i wszystkie były niewidoczne.
 *
 * IDENTYFIKATORY SĄ GLOBALNE w dokumencie. Sześć kafelków to sześć rysunków na jednej
 * stronie, więc każdy musi mieć własne `uid` - inaczej przeglądarka bierze pierwszy
 * z dokumentu i wszystkie kafelki dostają maskę pierwszego.
 */

export type RodzajSzkicu =
  | "kosze"
  | "nawierzchnia"
  | "godziny"
  | "dostep"
  | "oswietlenie"
  | "ogrodzenie";

/* Plamy przygaszenia: [x, y, promień poziomy, promień pionowy, siła]. Układ rysunku. */
const PLAMY: [number, number, number, number, number][] = [
  [26, 34, 44, 32, 0.6],
  [92, 24, 34, 28, 0.46],
  [98, 92, 38, 30, 0.56],
  [36, 100, 40, 26, 0.5],
  [62, 60, 24, 20, 0.28],
  [8, 74, 20, 26, 0.42],
];

/** Przesunięcie plam liczone z nazwy - stałe, a różne dla każdego rodzaju. */
function ziarno(rodzaj: string) {
  let s = 0;
  for (let i = 0; i < rodzaj.length; i++) s = (s * 31 + rodzaj.charCodeAt(i)) % 997;
  return s;
}

/** Oczka siatki - jedna seria przekątnych. Pętla, bo ręcznie to dwadzieścia kresek. */
function oczka(kierunek: 1 | -1) {
  const linie: string[] = [];
  for (let i = -8; i <= 12; i++) {
    const x = i * 18;
    linie.push(kierunek === 1 ? `M${x} -30L${x + 150} 150` : `M${x} 150L${x + 150} -30`);
  }
  return linie.join("");
}

/*
  Rysunki. Współrzędne WYCHODZĄ poza układ 0-120 z rozmysłu - to one dają przycięcie.
  Grubości oddają konstrukcję przedmiotu: obręcz grubsza od siatki, rama ogrodzenia grubsza
  od oczek, tarcza zegara grubsza od podziałki. Bez tego rysunek jest płaski.

  `obrot` to przekrzywienie całości, osobne dla każdego rodzaju - żeby sześć kafelków obok
  siebie nie ułożyło się w regularny wzór.
*/
const RYSUNKI: Record<RodzajSzkicu, { obrot: number; kreski: React.ReactNode }> = {
  /* Tablica z obręczą wchodzi lewą górą; siatka i słup wychodzą dołem. */
  kosze: {
    obrot: -8,
    kreski: (
      <>
        <rect x="-34" y="-22" width="112" height="78" rx="2" strokeWidth="3.2" />
        <rect x="-2" y="8" width="48" height="40" strokeWidth="1.9" />
        <path d="M22 56v11" strokeWidth="2.8" />
        <ellipse cx="22" cy="72" rx="35" ry="8.5" strokeWidth="3.4" />
        {/* sploty siatki zbiegają się do węzła daleko pod kafelkiem */}
        <path d="M-11 74 6 150M22 80.5v70M55 74 38 150" strokeWidth="1.7" />
        <path d="M-7 92q29 11 58 0M2 116q20 8 40 0" strokeWidth="1.4" />
        {/* słup - wychodzi prawą krawędzią i dołem */}
        <path d="M78 2h20v160" strokeWidth="2.6" />
      </>
    ),
  },

  /* Narożnik płyty: linia boczna i końcowa przecinają kafelek, łuk za trzy wychodzi bokiem. */
  nawierzchnia: {
    obrot: -11,
    kreski: (
      <>
        <path d="M-40 98h200" strokeWidth="3.2" />
        <path d="M16 -40v200" strokeWidth="3.2" />
        <path d="M16 20a78 78 0 0 1 78 78" strokeWidth="2.6" />
        <path d="M16 48h42v40H16" strokeWidth="1.8" />
        <path d="M58 48a20 20 0 0 1 0 40" strokeWidth="1.8" />
        {/* faktura - krótkie kreski, nierówno, jak ziarno betonu */}
        <path
          d="M28 112h13M52 120h10M74 108h15M96 124h11M40 132h11M84 138h13M62 104h9M108 112h11"
          strokeWidth="1.5"
        />
      </>
    ),
  },

  /* Tarcza zegara w większości poza kafelkiem - środek przy lewym dolnym narożniku. */
  godziny: {
    obrot: 5,
    kreski: (
      <>
        <circle cx="20" cy="104" r="92" strokeWidth="3.2" />
        <circle cx="20" cy="104" r="74" strokeWidth="1.5" />
        {/* wskazówki - jedna w górę, druga w prawo, obie wychodzą poza tarczę */}
        <path d="M20 104V16" strokeWidth="3.4" />
        <path d="M20 104 96 128" strokeWidth="2.8" />
        {/* podziałka na łuku */}
        <path
          d="M20 12v14M89 39l-10 10M112 104h-14M76 32l-7 12M100 66l-12 7M104 142l-13-5"
          strokeWidth="1.7"
        />
      </>
    ),
  },

  /* Otwarta brama: słupki wychodzą górą i dołem, skrzydło odchylone do środka. */
  dostep: {
    obrot: -6,
    kreski: (
      <>
        <path d="M4 -40v200" strokeWidth="3.4" />
        <path d="M116 -40v200" strokeWidth="3.4" />
        <path d="M4 118h112" strokeWidth="2" />
        {/* skrzydło pod kątem - to ono mówi „otwarte" */}
        <path d="M116 -4 50 26v96l66-30V-4" strokeWidth="2.7" />
        <path d="M50 58 116 28M50 90 116 60" strokeWidth="1.6" />
        {/* zawiasy */}
        <path d="M112 8h12M112 76h12" strokeWidth="2.2" />
      </>
    ),
  },

  /* Maszt wchodzi dolnym prawym narożnikiem, reflektor wychodzi górą, snop na boki. */
  oswietlenie: {
    obrot: 0,
    kreski: (
      <>
        <path d="M104 160 66 4" strokeWidth="3.6" />
        <path d="M18 -14h84l-13 24H31L18 -14Z" strokeWidth="3.2" />
        <path d="M42 -14v24M64 -14v24M86 -14v24" strokeWidth="1.6" />
        {/* snop - promienie rozchodzą się i wychodzą krawędziami */}
        <path d="M28 14-30 104M60 14 44 150M92 14 150 96" strokeWidth="1.9" />
        <path d="M20 16-40 54M100 16 160 50" strokeWidth="1.5" />
        <path d="M-16 74q68 30 136 0" strokeWidth="1.5" />
      </>
    ),
  },

  /* Siatka ogrodzenia skosem, wychodzi wszystkimi czterema krawędziami. */
  ogrodzenie: {
    obrot: -9,
    kreski: (
      <>
        <path d={oczka(1)} strokeWidth="1.5" />
        <path d={oczka(-1)} strokeWidth="1.5" />
        <path d="M-40 16h200" strokeWidth="3.4" />
        <path d="M-40 104h200" strokeWidth="2.8" />
        <path d="M12 -40v200M100 -40v200" strokeWidth="2.6" />
      </>
    ),
  },
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
  const { obrot, kreski } = RYSUNKI[rodzaj];

  return (
    <svg
      viewBox="0 0 120 120"
      /* `slice` wypełnia kafelek i OBCINA nadmiar. `meet`, czyli domyślne, wpasowałoby
         całość w środek i z fragmentu zrobiłaby się znowu ikonka. */
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      fill="none"
      aria-hidden
      /* poświata jak przy obrysach na innych stronach - bez niej kreska jest sucha */
      style={{ filter: "drop-shadow(0 0 12px rgb(var(--rgb-flame) / .3))" }}
    >
      <defs>
        <linearGradient
          id={`kreska-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="120"
          y2="120"
        >
          <stop offset="0" stopColor="rgb(var(--rgb-glow) / 0.45)" />
          <stop offset="0.35" stopColor="rgb(var(--rgb-glow))" />
          <stop offset="0.7" stopColor="rgb(var(--rgb-glow) / 0.8)" />
          <stop offset="1" stopColor="rgb(var(--rgb-glow) / 0.3)" />
        </linearGradient>

        <radialGradient id={`plama-${uid}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.4" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/*
          Maska luminancyjna: biel to pełna siła kreski, plamy odejmują. Miękkie brzegi plam
          są konieczne - twarda krawędź przecięłaby linię widocznie i wyglądałaby jak
          wytarcie gumką, a nie jak lżejszy nacisk.

          Prostokąt maski sięga daleko poza kafelek, bo rysunek też. Gdyby kończył się na
          120, wszystko poza tym byłoby zamaskowane na czarno, czyli niewidoczne - a to jest
          właśnie ta część rysunku, która ma wychodzić za krawędź.
        */}
        <mask
          id={`maska-${uid}`}
          maskUnits="userSpaceOnUse"
          x="-80"
          y="-80"
          width="280"
          height="280"
        >
          <rect x="-80" y="-80" width="280" height="280" fill="#fff" />
          {PLAMY.map(([cx, cy, rx, ry, moc], i) => (
            <ellipse
              key={i}
              cx={(cx + przesuniecie * (i + 1)) % 120}
              cy={(cy + przesuniecie * (i + 2) * 0.7) % 120}
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
        transform={obrot ? `rotate(${obrot} 60 60)` : undefined}
      >
        {kreski}
      </g>
    </svg>
  );
}
