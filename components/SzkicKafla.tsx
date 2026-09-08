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
 * ------------------------------------------------------------------ kreska i barwa
 *
 * Kreska jest CIENKA, a barwa NASYCONA - i to jest zamiana świadoma. Pierwsza wersja
 * miała grubą kreskę w bladym złocie (`--rgb-glow`, #ffb25c): rysunek był wyraźny, ale
 * ciężki, a jego barwa siadała gdzieś między szarością kafelka a pomarańczem marki
 * i nie należała do żadnego z nich. Teraz grubości zeszły o 38%, a barwa idzie
 * z `--rgb-flame` do `--rgb-ember` - czyli tam, gdzie serwis ma swój ogień. Ubytek
 * grubości nadrabia poświata pod kreską, nie sama kreska.
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
        <rect x="-34" y="-22" width="112" height="78" rx="2" strokeWidth="1.98" />
        <rect x="-2" y="8" width="48" height="40" strokeWidth="1.18" />
        <path d="M22 56v11" strokeWidth="1.74" />
        <ellipse cx="22" cy="72" rx="35" ry="8.5" strokeWidth="2.11" />
        {/* sploty siatki zbiegają się do węzła daleko pod kafelkiem */}
        <path d="M-11 74 6 150M22 80.5v70M55 74 38 150" strokeWidth="1.05" />
        <path d="M-7 92q29 11 58 0M2 116q20 8 40 0" strokeWidth="0.87" />
        {/* słup - wychodzi prawą krawędzią i dołem */}
        <path d="M78 2h20v160" strokeWidth="1.61" />
      </>
    ),
  },

  /* Narożnik płyty: linia boczna i końcowa przecinają kafelek, łuk za trzy wychodzi bokiem. */
  nawierzchnia: {
    obrot: -11,
    kreski: (
      <>
        <path d="M-40 98h200" strokeWidth="1.98" />
        <path d="M16 -40v200" strokeWidth="1.98" />
        <path d="M16 20a78 78 0 0 1 78 78" strokeWidth="1.61" />
        <path d="M16 48h42v40H16" strokeWidth="1.12" />
        <path d="M58 48a20 20 0 0 1 0 40" strokeWidth="1.12" />
        {/* faktura - krótkie kreski, nierówno, jak ziarno betonu */}
        <path
          d="M28 112h13M52 120h10M74 108h15M96 124h11M40 132h11M84 138h13M62 104h9M108 112h11"
          strokeWidth="0.93"
        />
      </>
    ),
  },

  /* Tarcza zegara w większości poza kafelkiem - środek przy lewym dolnym narożniku. */
  godziny: {
    obrot: 5,
    kreski: (
      <>
        <circle cx="20" cy="104" r="92" strokeWidth="1.98" />
        <circle cx="20" cy="104" r="74" strokeWidth="0.93" />
        {/* wskazówki - jedna w górę, druga w prawo, obie wychodzą poza tarczę */}
        <path d="M20 104V16" strokeWidth="2.11" />
        <path d="M20 104 96 128" strokeWidth="1.74" />
        {/* podziałka na łuku */}
        <path
          d="M20 12v14M89 39l-10 10M112 104h-14M76 32l-7 12M100 66l-12 7M104 142l-13-5"
          strokeWidth="1.05"
        />
      </>
    ),
  },

  /* Otwarta brama: słupki wychodzą górą i dołem, skrzydło odchylone do środka. */
  dostep: {
    obrot: -6,
    kreski: (
      <>
        <path d="M4 -40v200" strokeWidth="2.11" />
        <path d="M116 -40v200" strokeWidth="2.11" />
        <path d="M4 118h112" strokeWidth="1.24" />
        {/* skrzydło pod kątem - to ono mówi „otwarte" */}
        <path d="M116 -4 50 26v96l66-30V-4" strokeWidth="1.67" />
        <path d="M50 58 116 28M50 90 116 60" strokeWidth="0.99" />
        {/* zawiasy */}
        <path d="M112 8h12M112 76h12" strokeWidth="1.36" />
      </>
    ),
  },

  /* Maszt wchodzi dolnym prawym narożnikiem, reflektor wychodzi górą, snop na boki. */
  oswietlenie: {
    obrot: 0,
    kreski: (
      <>
        <path d="M104 160 66 4" strokeWidth="2.23" />
        <path d="M18 -14h84l-13 24H31L18 -14Z" strokeWidth="1.98" />
        <path d="M42 -14v24M64 -14v24M86 -14v24" strokeWidth="0.99" />
        {/* snop - promienie rozchodzą się i wychodzą krawędziami */}
        <path d="M28 14-30 104M60 14 44 150M92 14 150 96" strokeWidth="1.18" />
        <path d="M20 16-40 54M100 16 160 50" strokeWidth="0.93" />
        <path d="M-16 74q68 30 136 0" strokeWidth="0.93" />
      </>
    ),
  },

  /* Siatka ogrodzenia skosem, wychodzi wszystkimi czterema krawędziami. */
  ogrodzenie: {
    obrot: -9,
    kreski: (
      <>
        <path d={oczka(1)} strokeWidth="0.93" />
        <path d={oczka(-1)} strokeWidth="0.93" />
        <path d="M-40 16h200" strokeWidth="2.11" />
        <path d="M-40 104h200" strokeWidth="1.74" />
        <path d="M12 -40v200M100 -40v200" strokeWidth="1.61" />
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
      /*
        Poświata jak przy obrysach na innych stronach - bez niej kreska jest sucha.
        Przy cieńszej kresce robi więcej niż wcześniej: to ona daje rysunkowi obecność,
        której nie ma już z samej grubości linii.
      */
      style={{ filter: "drop-shadow(0 0 11px rgb(var(--rgb-ember) / .42))" }}
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
          <stop offset="0" stopColor="rgb(var(--rgb-flame) / 0.5)" />
          <stop offset="0.32" stopColor="rgb(var(--rgb-flame))" />
          <stop offset="0.66" stopColor="rgb(var(--rgb-ember) / 0.92)" />
          <stop offset="1" stopColor="rgb(var(--rgb-ember) / 0.38)" />
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
