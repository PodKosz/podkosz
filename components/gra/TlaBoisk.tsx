import type { IdMiejsca } from "@/lib/minigra";

/**
 * Tła minigry - obrysy w stylistyce reszty serwisu.
 *
 * Poprzednia wersja była kolorową kreskówką i odstawała od strony jak wklejka z innej
 * bajki. Teraz jest tak samo jak wszędzie indziej: czerń, ciepłe światła i włosowe linie
 * w gradiencie marki - ten sam język, co kontur boiska na stronie głównej i piłka na
 * profilu.
 *
 * Scena jest wyłącznie tłem. Wszystko, co ma znaczenie w grze - kosz i piłka - rysuje
 * canvas nad spodem, więc rysunek pod spodem musi być cichy: cienka kreska, żadnych
 * wypełnień i nic jaśniejszego niż piłka.
 */
export function TloBoiska({ miejsce }: { miejsce: IdMiejsca }) {
  return (
    <svg
      viewBox="0 0 1000 680"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {/*
          Gradient liczony osobno dla każdego elementu: dzięki temu KAŻDA linia gaśnie
          na swoich końcach, a nie tylko przy krawędzi kadru. To ta sama sztuczka, co
          w konturze boiska - bez niej rysunek kończy się w powietrzu.
        */}
        <linearGradient id="gra-linia" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(var(--rgb-flame) / 0)" />
          <stop offset="0.2" stopColor="rgb(var(--rgb-glow) / 0.5)" />
          <stop offset="0.5" stopColor="rgb(var(--rgb-glow) / 0.78)" />
          <stop offset="0.8" stopColor="rgb(var(--rgb-glow) / 0.5)" />
          <stop offset="1" stopColor="rgb(var(--rgb-flame) / 0)" />
        </linearGradient>
        <linearGradient id="gra-linia-pion" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--rgb-flame) / 0)" />
          <stop offset="0.28" stopColor="rgb(var(--rgb-glow) / 0.46)" />
          <stop offset="1" stopColor="rgb(var(--rgb-glow) / 0.62)" />
        </linearGradient>

        <radialGradient id="gra-swiatlo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgb(var(--rgb-flame) / 0.3)" />
          <stop offset="0.5" stopColor="rgb(var(--rgb-ember) / 0.08)" />
          <stop offset="1" stopColor="rgb(var(--rgb-ember) / 0)" />
        </radialGradient>
        <radialGradient id="gra-swiatlo-zimne" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(120,170,255,0.16)" />
          <stop offset="1" stopColor="rgba(120,170,255,0)" />
        </radialGradient>
      </defs>

      <rect width="1000" height="680" fill="#07070a" />

      {miejsce === "venice" ? <Venice /> : miejsce === "manhattan" ? <Manhattan /> : <Chicago />}

      {/*
        Podłoga jest wspólna dla dwóch miejsc z grą w rzuty. Chicago ma własną - cały
        parkiet - więc tam by się z nią zderzyła.
      */}
      {miejsce !== "chicago" && (
        <g stroke="url(#gra-linia)" fill="none" strokeLinecap="round">
          <path d="M0 596h1000" strokeWidth="1.6" opacity=".5" />
          <path d="M120 680 360 596M880 680 640 596" strokeWidth="1.4" opacity=".38" />
          <path d="M310 640h380" strokeWidth="1.4" opacity=".32" />
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- Venice */

function Venice() {
  return (
    <>
      {/* zachód nad oceanem - ciepłe światło nisko po prawej */}
      <ellipse cx="820" cy="470" rx="460" ry="330" fill="url(#gra-swiatlo)" />
      <ellipse cx="140" cy="180" rx="320" ry="260" fill="url(#gra-swiatlo)" opacity=".5" />

      <g stroke="url(#gra-linia)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* słońce tuż nad horyzontem */}
        <circle cx="820" cy="452" r="74" strokeWidth="1.8" opacity=".75" />

        {/* horyzont i fale - im bliżej brzegu, tym dłuższa kreska */}
        <path d="M0 452h1000" strokeWidth="1.6" opacity=".55" />
        <path d="M120 486h160M360 494h120M600 486h150M810 500h120" strokeWidth="1.4" opacity=".4" />
        <path d="M60 520h200M330 528h180M640 520h190" strokeWidth="1.4" opacity=".34" />
        <path d="M180 552h230M520 558h260" strokeWidth="1.4" opacity=".28" />
      </g>

      {/* palmy - sam obrys, bez wypełnień */}
      <Palma x={112} y={596} skala={1.05} przechyl={-7} />
      <Palma x={906} y={596} skala={0.92} przechyl={6} />
      <Palma x={252} y={572} skala={0.62} przechyl={-3} />
      <Palma x={772} y={568} skala={0.55} przechyl={4} />
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
    <g
      transform={`translate(${x} ${y}) scale(${skala}) rotate(${przechyl})`}
      stroke="url(#gra-linia-pion)"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {/* pień - dwie linie, żeby miał grubość, i poprzeczki jak łuski */}
      <path d="M-5 0c6-56 8-112 1-166M5 0c6-56 8-112 3-166" />
      <path d="M-4 -30h8M-3 -60h8M-2 -90h8M-1 -120h8" opacity=".55" strokeWidth="1.4" />

      {/* liście - każdy jako łuk z ząbkami na końcu */}
      <g strokeWidth="1.8">
        <path d="M2-166c-30-6-62 6-84 30" />
        <path d="M2-166c30-6 62 6 84 30" />
        <path d="M2-166c-14-30-44-48-76-50" />
        <path d="M2-166c14-30 44-48 76-50" />
        <path d="M2-168c2-28 20-52 44-66" />
      </g>
      <g strokeWidth="1.2" opacity=".6">
        <path d="M-40-150l-12 12M-62-142l-10 14M-16-190l-12-8M-46-198l-10-10" />
        <path d="M44-150l12 12M66-142l10 14M20-190l12-8M50-198l10-10" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------- Manhattan */

function Manhattan() {
  const domy = [
    { x: -10, w: 128, h: 300 },
    { x: 108, w: 92, h: 220 },
    { x: 192, w: 132, h: 372 },
    { x: 316, w: 104, h: 264 },
    { x: 604, w: 118, h: 300 },
    { x: 714, w: 96, h: 388 },
    { x: 802, w: 124, h: 246 },
    { x: 918, w: 122, h: 336 },
  ];

  return (
    <>
      <ellipse cx="500" cy="300" rx="480" ry="340" fill="url(#gra-swiatlo)" opacity=".7" />
      <ellipse cx="160" cy="150" rx="300" ry="240" fill="url(#gra-swiatlo-zimne)" />

      {/*
        Pierzeja: same obrysy. Środek kadru zostaje pusty z rozmysłem - tam wisi kosz
        i żadna linia nie ma prawa się z nim mieszać.

        Kreska jest tu jednolita, nie gradientowa: gradient pionowy wygaszał linię przy
        górnej krawędzi, więc z budynków znikały dachy i zostawały same pionowe kreski
        wiszące w powietrzu.
      */}
      <g stroke="rgb(var(--rgb-glow) / .52)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {domy.map((d, i) => (
          <g key={i}>
            <path d={`M${d.x} 596V${596 - d.h}h${d.w}V596`} strokeWidth="1.8" opacity=".9" />
            {/* gzyms - dwie kreski pod dachem, żeby bryła miała wierzch, a nie samą krawędź */}
            <path
              d={`M${d.x + 6} ${596 - d.h + 12}h${d.w - 12}`}
              strokeWidth="1.4"
              opacity=".5"
            />
            {/* okna - krótkie kreski, nie prostokąty: mniej hałasu przy tej skali */}
            {Array.from({ length: Math.floor(d.h / 54) }, (_, r) =>
              Array.from({ length: Math.max(1, Math.floor(d.w / 38)) }, (_, c) => (
                <path
                  key={`${r}-${c}`}
                  d={`M${d.x + 16 + c * 38} ${596 - d.h + 34 + r * 54}h16`}
                  strokeWidth="1.5"
                  opacity={(i * 5 + r * 3 + c * 7) % 4 === 0 ? 0.24 : 0.55}
                />
              ))
            )}
          </g>
        ))}
      </g>

      <g stroke="url(#gra-linia)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* zbiornik na dachu - znak rozpoznawczy nowojorskich kamienic */}
        <g transform="translate(232 224)">
          <path d="M0 0h58v58H0z" strokeWidth="1.8" />
          <path d="M-6 0l35-22 35 22" strokeWidth="1.8" />
          <path d="M8 58v22M50 58v22" strokeWidth="1.5" opacity=".7" />
        </g>

        {/* most - pylon i liny, daleko w tle */}
        <g opacity=".55">
          <path d="M470 596V286h60v310" strokeWidth="1.8" />
          <path d="M470 322h60M470 360h60" strokeWidth="1.5" />
          <path d="M250 470c110-96 200-150 220-184M750 470c-110-96-200-150-220-184" strokeWidth="1.5" />
        </g>
      </g>
    </>
  );
}

/* ---------------------------------------------------------------- Chicago */

/**
 * Parkiet widziany z góry pod kątem - deski zbiegające się w perspektywie i linie boiska.
 *
 * To tło pod grę w kozłowanie, więc rysunek musi robić jedną rzecz: mówić, gdzie jest
 * podłoga. Piłka odbija się od poziomej linii na 82% wysokości planszy i dokładnie tam
 * kończą się deski - bez tego piłka odskakiwałaby od niczego.
 *
 * Deski zbiegają się do punktu wysoko nad kadrem, nie do środka: przy zbiegu w środku
 * kadru parkiet czyta się jak wachlarz, a nie jak podłoga, po której się chodzi. Poprzeczki
 * gęstnieją ku górze, bo tak działa perspektywa - i to one, nie same deski, sprzedają tu
 * wrażenie głębokości.
 */
/**
 * Chicago: samo światło hali i sylwetka miasta.
 *
 * Parkietu tu nie ma z rozmysłem - rysuje go kanwa gry, bo od jego linii odbija się piłka.
 * Ta warstwa skaluje się przez `preserveAspectRatio`, więc przy innych proporcjach okna
 * jej podłoga rozjeżdżałaby się z fizyką i piłka odbijałaby się od niczego.
 */
function Chicago() {
  return (
    <>
      {/* światło z góry, jak nad parkietem w hali */}
      <ellipse cx="500" cy="300" rx="520" ry="380" fill="url(#gra-swiatlo)" opacity=".5" />
      <ellipse cx="500" cy="620" rx="640" ry="200" fill="url(#gra-swiatlo)" opacity=".35" />

      {/* sylwetka wieżowców - Chicago poznaje się po niej, nie po parkiecie */}
      <g stroke="url(#gra-linia-pion)" fill="none" strokeLinecap="round" opacity=".45">
        <path d="M120 520V300h96v220M150 300V236h36v64" strokeWidth="1.4" />
        <path d="M250 520V360h74v160" strokeWidth="1.3" />
        <path d="M700 520V276h104v244M742 276V196h20v80" strokeWidth="1.4" />
        <path d="M836 520V372h68v148" strokeWidth="1.3" />
        <path d="M420 520V330h60v190" strokeWidth="1.2" opacity=".7" />
      </g>
    </>
  );
}
