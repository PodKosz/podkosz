"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  odznaczenia,
  podsumowanie,
  POZIOMY,
  STOPNIE,
  type Odznaczenie,
  type StatystykiGracza,
} from "@/lib/odznaczenia";

/**
 * Piłka odznaczeń - wizytówka profilu.
 *
 * Kula podzielona szwami na osiem pól. Każde pole to jedno odznaczenie progowe. Pole
 * wypełnia się OD RDZENIA NA ZEWNĄTRZ i zatrzymuje tam, dokąd doszło odznaczenie, więc
 * barwa, przy której się kończy, jest jednocześnie jego stopniem. Gradient jest jeden,
 * wspólny dla całej piłki i przypisany do PROMIENIA, nie do pola: dwa odznaczenia o tym
 * samym stopniu kończą się dokładnie tą samą barwą, a różnicę jednego stopnia widać jako
 * przeskok koloru, nie jako odcień.
 *
 * KULA POKAZUJE OSIEM ODZNACZEŃ Z DWUDZIESTU SZEŚCIU - tyle, ile ma pól. Dziewiąte
 * progowe (Odkrywca) i siedemnaście wyróżnień miało tu kolejno obwódkę wokół piłki,
 * pierścień przy zdjęciu i kropki na szwach; wszystkie trzy zostały zdjęte jako zbyt
 * hałaśliwe. Komplet stoi w listach pod piłką i to one są źródłem prawdy - rysunek jest
 * wrażeniem, nie spisem.
 */

/* ————— geometria —————
   `EY` liczone z Pitagorasa, żeby końce łuków siedziały dokładnie na obwodzie - inaczej
   między polami zostają szczeliny. */
const BOK = 620;
const EX = 0.78;
const EY = Math.sqrt(1 - EX * EX);
const RY = 0.285;

const CX = BOK / 2;
const CY = BOK / 2;
const R = BOK * 0.355;
const R_AWATAR = R * 0.2;
/** zasięg prostokątów przycinających - byle poza kulę */
const D = 1.5;

const X = (v: number) => +(CX + v * R).toFixed(2);
const Y = (v: number) => +(CY + v * R).toFixed(2);
const U = (v: number) => +(v * R).toFixed(2);

/**
 * Osiem pól kuli.
 *
 * Każde powstaje z PRZECIĘCIA przycięć: bok (lewa/prawa), pas (czasza albo środek) i przy
 * pasach środkowych jeszcze połowa. Zagnieżdżone `clip-path` dają iloczyn, bo dzieci jednej
 * ścieżki przycinającej dają sumę - stąd trzy warstwy zamiast jednej.
 *
 * `kotwica` to środek ciężkości pola: stąd wychodzi fala światła przy najechaniu.
 * `zasieg` to promień tej fali - czasze są niższe i szersze od pasów, więc jedna wspólna
 * wartość znaczyłaby, że w czaszy czoło opuszcza pole w jednej trzeciej animacji.
 */
const POLA = [
  { bok: "lewa", pas: "czaszaG", pol: null, kotwica: [-0.33, -0.76], zasieg: 0.58 },
  { bok: "prawa", pas: "czaszaG", pol: null, kotwica: [0.33, -0.76], zasieg: 0.58 },
  { bok: "lewa", pas: "srodekG", pol: "polG", kotwica: [-0.46, -0.3], zasieg: 0.72 },
  { bok: "prawa", pas: "srodekG", pol: "polG", kotwica: [0.46, -0.3], zasieg: 0.72 },
  { bok: "lewa", pas: "srodekD", pol: "polD", kotwica: [-0.46, 0.3], zasieg: 0.72 },
  { bok: "prawa", pas: "srodekD", pol: "polD", kotwica: [0.46, 0.3], zasieg: 0.72 },
  { bok: "lewa", pas: "czaszaD", pol: null, kotwica: [-0.33, 0.76], zasieg: 0.58 },
  { bok: "prawa", pas: "czaszaD", pol: null, kotwica: [0.33, 0.76], zasieg: 0.58 },
] as const;

/** Promień czoła wypełnienia. Skala idzie od KRAWĘDZI AWATARA, nie od zera - inaczej
    pierwszy stopień chowałby się pod zdjęciem i wyglądał identycznie jak brak stopnia. */
const czolo = (stopien: number) => R_AWATAR + (R - R_AWATAR) * (stopien / POZIOMY.length);

/** Barwa żaru. Popiół dostaje chłodną biel: jego własny grafit nad czarną kulą nie dałby
    żadnego światła, a pole bez stopnia ma reagować tak samo jak każde inne. */
const zarBarwa = (stopien: number) =>
  stopien === 0 ? "220 230 242" : STOPNIE[stopien].barwa;


export function PilkaOdznaczen({
  statystyki,
  nick,
  avatar,
  wizytowka = false,
}: {
  statystyki: StatystykiGracza;
  nick: string;
  avatar: string | null;
  /**
   * Tryb wizytówki: sam rysunek, bez okienek pod kursorem i bez szyby rozmywającej tło.
   *
   * Tak piłka stoi przy graczach w rankingu. Tam jest znakiem rozpoznawczym, a nie
   * przyrządem: okienko z opisem odznaczenia wychodziłoby poza kafelek i przechwytywało
   * kliknięcie, które ma prowadzić na profil. Szyba odpada, bo rozmywa nazwę podchodzącą
   * pod kulę - a w rankingu pod kulą nie ma nazwy, jest tylko kafelek.
   */
  wizytowka?: boolean;
}) {
  const progowe = odznaczenia(statystyki);
  const razem = podsumowanie(statystyki);

  const svgRef = useRef<SVGSVGElement>(null);

  /** pole pod kursorem - 0 to pierścień Odkrywcy przy zdjęciu */
  const [gorace, setGorace] = useState<number | null>(null);
  /** numer odznaczenia, które pokazuje okienko obok kuli */
  const [wybor, setWybor] = useState<number | null>(null);
  /**
   * Czy okienko zostało PRZYPIĘTE kliknięciem.
   *
   * Bez tego rozróżnienia nie dałoby się obsłużyć obu urządzeń jedną kartą: na myszy ma
   * chodzić za kursorem i znikać po zejściu z kuli, a na dotyku nie ma żadnego „zejścia",
   * więc raz otwarta musi zostać, dopóki ktoś jej nie zamknie.
   */
  const [przypiete, setPrzypiete] = useState(false);
  /** fala światła: numer zmienia się przy każdym wyzwoleniu i przemontowuje kółko,
      co jest jedynym sposobem, żeby ta sama animacja CSS ruszyła drugi raz */
  const [fala, setFala] = useState<{ pole: number; x: number; y: number; nr: number } | null>(null);

  const puszFale = (pole: number, punkt?: [number, number]) => {
    const p = POLA[pole - 1];
    const dom: [number, number] = p
      ? [CX + p.kotwica[0] * R, CY + p.kotwica[1] * R]
      : [CX, CY];
    const [x, y] = punkt ?? dom;
    setFala((f) => ({ pole, x, y, nr: (f?.nr ?? 0) + 1 }));
  };

  /** Punkt z ekranu na układ rysunku. Kula jest skalowana przez `viewBox`, więc bez
      odwrócenia macierzy ekranowej fala wystartowałaby kilkadziesiąt jednostek obok palca. */
  const doRysunku = (e: { clientX: number; clientY: number }): [number, number] | undefined => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return undefined;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const zamknij = () => {
    setWybor(null);
    setGorace(null);
    setPrzypiete(false);
  };

  /** Najechanie: podświetl pole, puść falę i pokaż okienko - o ile nic nie jest przypięte. */
  const najedz = (pole: number) => {
    if (gorace === pole) return;
    setGorace(pole);
    puszFale(pole);
    if (!przypiete) setWybor(pole);
  };

  /* Zamykanie kliknięciem obok i Escape - tylko dla przypiętego okienka, bo tylko ono
     zostaje na ekranie samo z siebie. Wisi na dokumencie, żeby działało także wtedy,
     gdy ktoś kliknie zupełnie gdzie indziej na stronie. */
  useLayoutEffect(() => {
    if (!przypiete) return;
    const obok = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".kula-karta") && !t.closest?.(".kula")) zamknij();
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij();
    };
    document.addEventListener("click", obok);
    document.addEventListener("keydown", klawisz);
    return () => {
      document.removeEventListener("click", obok);
      document.removeEventListener("keydown", klawisz);
    };
  }, [przypiete]);

  /* Pola przycinające i gradienty. Wszystko raz, w `<defs>`. */
  const nadG = `M${X(-D)} ${Y(-D)}H${X(D)}V${Y(-EY)}L${X(EX)} ${Y(-EY)}A${U(EX)} ${U(RY)} 0 0 1 ${X(-EX)} ${Y(-EY)}L${X(-D)} ${Y(-EY)}Z`;
  const podG = `M${X(-D)} ${Y(-EY)}L${X(-EX)} ${Y(-EY)}A${U(EX)} ${U(RY)} 0 0 0 ${X(EX)} ${Y(-EY)}L${X(D)} ${Y(-EY)}V${Y(D)}H${X(-D)}Z`;
  const nadD = `M${X(-D)} ${Y(-D)}H${X(D)}V${Y(EY)}L${X(EX)} ${Y(EY)}A${U(EX)} ${U(RY)} 0 0 0 ${X(-EX)} ${Y(EY)}L${X(-D)} ${Y(EY)}Z`;
  const podD = `M${X(-D)} ${Y(EY)}L${X(-EX)} ${Y(EY)}A${U(EX)} ${U(RY)} 0 0 1 ${X(EX)} ${Y(EY)}L${X(D)} ${Y(EY)}V${Y(D)}H${X(-D)}Z`;

  const szwy = [
    `M${CX} ${Y(-1)}V${Y(1)}`,
    `M${X(-1)} ${CY}H${X(1)}`,
    `M${X(-EX)} ${Y(-EY)}A${U(EX)} ${U(RY)} 0 0 0 ${X(EX)} ${Y(-EY)}`,
    `M${X(-EX)} ${Y(EY)}A${U(EX)} ${U(RY)} 0 0 1 ${X(EX)} ${Y(EY)}`,
  ];

  const grubosc = BOK * 0.019;
  const gruboscObreczy = BOK * 0.0092;

  /** Klasy pola: numer służy do zapalania obu warstw naraz - wypełnienia i pola trafień. */
  const klasaPola = (nr: number, extra = "") =>
    `kula-pole kula-pole-${nr}${gorace === nr ? " gorace" : ""}${extra ? ` ${extra}` : ""}`;

  const otulina = (i: number, tresc: React.ReactNode, traf = false) => {
    const p = POLA[i];
    let w = <g clipPath={`url(#kula-${p.pas})`}>{tresc}</g>;
    if (p.pol) w = <g clipPath={`url(#kula-${p.pol})`}>{w}</g>;
    return (
      <g
        key={i}
        className={klasaPola(i + 1, traf ? "kula-traf" : "")}
        data-pole={traf ? i + 1 : undefined}
        clipPath="url(#kula-kolo)"
      >
        <g clipPath={`url(#kula-${p.bok})`}>{w}</g>
      </g>
    );
  };

  /** Numer pola spod kursora. Zdarzenia łapiemy na całym rysunku, a nie na ośmiu grupach
      z osobna: jedna obsługa zamiast szesnastu i nic nie gubi się przy przerysowaniu. */
  const polePod = (e: React.MouseEvent) => {
    const t = e.target as Element;
    const g = t.closest?.("[data-pole]");
    const nr = g?.getAttribute("data-pole");
    return nr === null || nr === undefined ? null : Number(nr);
  };

  return (
    <div className={`kula-scena${wizytowka ? " kula-wizytowka" : ""}`}>
      {/*
        Szyba: krążek rozmywający TŁO, czyli wszystko, co namalowano pod nim - a nazwa
        gracza podchodzi pod kulę i właśnie tam się znajduje. Litery gubią ostrość
        w miarę zbliżania się do piłki i odzyskują ją niżej, bo maska wygasza rozmycie
        pierścieniowo. Sama kula leży nad szybą, więc jej własny rysunek zostaje ostry.
      */}
      {!wizytowka && <div className="kula-szyba" aria-hidden />}
      <svg
        ref={svgRef}
        className="kula"
        viewBox={`0 0 ${BOK} ${BOK}`}
        onMouseOver={
          wizytowka
            ? undefined
            : (e) => {
                const nr = polePod(e);
                if (nr !== null) najedz(nr);
              }
        }
        onMouseLeave={
          wizytowka
            ? undefined
            : () => {
                if (przypiete) return;
                setGorace(null);
                setWybor(null);
              }
        }
        onClick={
          wizytowka
            ? undefined
            : (e) => {
                const nr = polePod(e);
                if (nr === null) return;
                e.stopPropagation();
                /* Drugie kliknięcie w to samo pole odpina - inaczej na dotyku nie byłoby jak
                   zamknąć okienka bez celowania w krzyżyk. */
                if (przypiete && wybor === nr) return zamknij();
                setGorace(nr);
                setWybor(nr);
                setPrzypiete(true);
                puszFale(nr, doRysunku(e));
              }
        }
        role="img"
        aria-label={`Piłka odznaczeń: ${razem.zdobyte} z ${razem.wszystkie} odznaczeń zdobytych. Pełna lista pod piłką.`}
      >
        <defs>
          {/* Widmo: rdzeń w barwie pierwszego stopnia, krawędź w barwie ostatniego.
              Przystanki siedzą dokładnie tam, gdzie kończą się kolejne stopnie, więc
              pole zatrzymane na danym stopniu ma na czole dokładnie jego barwę. */}
          <radialGradient
            id="kula-widmo"
            gradientUnits="userSpaceOnUse"
            cx={CX}
            cy={CY}
            r={R}
          >
            <stop offset={((R_AWATAR / R) * 0.5).toFixed(3)} stopColor={`rgb(${POZIOMY[0].barwa})`} />
            {POZIOMY.map((p, i) => (
              <stop
                key={p.id}
                offset={(czolo(i + 1) / R).toFixed(3)}
                stopColor={`rgb(${p.barwa})`}
              />
            ))}
          </radialGradient>

          {/* ————— szkło —————
              Trzy warstwy kładzione NA wypełnieniu, wszystkie w jednostkach rysunku, nie
              pola. To jest sedno: refleks ma jedno źródło światła dla całej kuli, więc
              osiem pól nalanych do różnej wysokości dalej wygląda jak jedno ciało, a nie
              jak osiem osobnych tarcz z własnym połyskiem. */}
          <radialGradient
            id="kula-rdzen"
            gradientUnits="userSpaceOnUse"
            cx={CX}
            cy={CY}
            r={+(R * 0.52).toFixed(1)}
          >
            <stop offset="0" stopColor="#FFF6E8" stopOpacity=".62" />
            <stop offset=".46" stopColor="#FFD8A4" stopOpacity=".2" />
            <stop offset="1" stopColor="#FFD8A4" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="kula-polysk"
            gradientUnits="userSpaceOnUse"
            cx={+(CX - R * 0.34).toFixed(1)}
            cy={+(CY - R * 0.42).toFixed(1)}
            r={+(R * 0.88).toFixed(1)}
          >
            <stop offset="0" stopColor="#ffffff" stopOpacity=".38" />
            <stop offset=".42" stopColor="#ffffff" stopOpacity=".1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="kula-spod"
            gradientUnits="userSpaceOnUse"
            cx={+(CX + R * 0.3).toFixed(1)}
            cy={+(CY + R * 0.46).toFixed(1)}
            r={+(R * 0.8).toFixed(1)}
          >
            <stop offset="0" stopColor="#ffffff" stopOpacity=".16" />
            <stop offset=".6" stopColor="#ffffff" stopOpacity=".03" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Żar pod kursorem bierze barwę ZE STOPNIA pola. Jedna wspólna pomarańcz
              przeczyłaby jedynej rzeczy, którą ten rysunek mówi: że barwa jest stopniem. */}
          {STOPNIE.map((p, k) => (
            <radialGradient key={`a${k}`} id={`kula-zarA-${k}`}>
              <stop offset="0" stopColor={`rgb(${zarBarwa(k)} / .34)`} />
              <stop offset=".62" stopColor={`rgb(${zarBarwa(k)} / .12)`} />
              <stop offset="1" stopColor={`rgb(${zarBarwa(k)} / 0)`} />
            </radialGradient>
          ))}
          <radialGradient id="kula-zarC">
            <stop offset="0" stopColor="rgb(var(--rgb-glow-soft) / .26)" />
            <stop offset=".62" stopColor="rgb(var(--rgb-glow-soft) / .08)" />
            <stop offset="1" stopColor="rgb(var(--rgb-glow-soft) / 0)" />
          </radialGradient>

          {/* Czoło fali: najjaśniejszy jest BRZEG, środek prawie przezroczysty. Dzięki temu
              czyta się jako czoło rozchodzącej się poświaty, a nie jako rosnąca plama -
              dokładnie jak podświetlenie województwa na mapie (`lib/zarWojewodztwa.ts`). */}
          <radialGradient id="kula-czolo">
            <stop offset="0" stopColor="rgb(var(--rgb-glow-soft) / 0)" />
            <stop offset=".5" stopColor="rgb(var(--rgb-glow-soft) / .05)" />
            <stop offset=".78" stopColor="rgb(var(--rgb-glow-soft) / .16)" />
            <stop offset=".92" stopColor="rgb(var(--rgb-glow-soft) / .30)" />
            <stop offset=".99" stopColor="rgb(255 255 255 / .12)" />
            <stop offset="1" stopColor="rgb(255 255 255 / 0)" />
          </radialGradient>

          <radialGradient id="kula-szklo" cx="34%" cy="26%" r="72%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".38" />
            <stop offset=".45" stopColor="#ffffff" stopOpacity=".07" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* Ostatni przystanek jest mocniejszy niż przedtem: na dole skóra jest już
              przezroczysta i to krawędź, sama jedna, trzyma sylwetkę kuli. Przy .16
              dolny łuk po prostu znikał i piłka wyglądała na urwaną. */}
          <linearGradient id="kula-krawedz" x1="0" y1="0" x2=".85" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".62" />
            <stop offset=".42" stopColor="#ffffff" stopOpacity=".06" />
            <stop offset="1" stopColor="#ffffff" stopOpacity=".4" />
          </linearGradient>
          {/* Cień leży NA wypełnieniu, więc każdy jego punkt krycia zabiera barwie
              tyle samo jasności. Przy .46 dolna ćwiartka kuli gasła do brązu niezależnie
              od tego, jaki stopień tam stał - a to właśnie stopień ma tam być widoczny. */}
          <radialGradient id="kula-cien" cx="70%" cy="80%" r="58%">
            <stop offset="0" stopColor="#000000" stopOpacity=".24" />
            <stop offset="1" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kula-skora" cx="36%" cy="28%">
            <stop offset="0" stopColor="#191D24" />
            <stop offset="1" stopColor="#0A0C10" />
          </radialGradient>

          {/* Rozmycie CELOWO małe. Przy większym czoła sąsiednich pól rozpływają się w jedną
              łunę i skok o jeden stopień przestaje być widoczny - a to jedyna rzecz, którą
              ten rysunek ma pokazywać. */}
          <filter id="kula-miekko" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation={(BOK * 0.0026).toFixed(2)} />
          </filter>
          <filter id="kula-poswiata" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={(BOK * 0.022).toFixed(2)} />
          </filter>

          {/* Dno kuli przechodzi w szkło: skóra i cień gasną ku dołowi, więc widać przez
              nie litery nazwy, która tam właśnie wchodzi. Rozmyte są już wcześniej, przez
              `.kula-szyba` leżącą pod rysunkiem - tutaj tylko przestajemy je zasłaniać.
              Szwy, obręcz, wypełnienia pól i refleks zostają nietknięte, bo to one trzymają
              kształt: bez nich zamiast szklanego dna byłaby dziura. */}
          <linearGradient id="kula-dno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset=".58" stopColor="#ffffff" stopOpacity="1" />
            <stop offset=".80" stopColor="#ffffff" stopOpacity=".74" />
            <stop offset="1" stopColor="#ffffff" stopOpacity=".34" />
          </linearGradient>
          <mask id="kula-maska-dna" maskUnits="userSpaceOnUse" x={CX - R} y={CY - R} width={R * 2} height={R * 2}>
            <rect x={CX - R} y={CY - R} width={R * 2} height={R * 2} fill="url(#kula-dno)" />
          </mask>

          <clipPath id="kula-kolo">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
          <clipPath id="kula-lewa">
            <rect x={X(-D)} y={Y(-D)} width={U(D)} height={U(2 * D)} />
          </clipPath>
          <clipPath id="kula-prawa">
            <rect x={CX} y={Y(-D)} width={U(D)} height={U(2 * D)} />
          </clipPath>
          <clipPath id="kula-czaszaG">
            <path d={nadG} />
          </clipPath>
          <clipPath id="kula-czaszaD">
            <path d={podD} />
          </clipPath>
          <clipPath id="kula-srodekG">
            <path d={podG} />
          </clipPath>
          <clipPath id="kula-srodekD">
            <path d={nadD} />
          </clipPath>
          <clipPath id="kula-polG">
            <rect x={X(-D)} y={Y(-D)} width={U(2 * D)} height={U(D)} />
          </clipPath>
          <clipPath id="kula-polD">
            <rect x={X(-D)} y={CY} width={U(2 * D)} height={U(D)} />
          </clipPath>
          <clipPath id="kula-awatar">
            <circle cx={CX} cy={CY} r={R_AWATAR} />
          </clipPath>
        </defs>

        {/* ————— korpus ————— */}
        <circle cx={CX} cy={CY} r={R} fill="url(#kula-skora)" mask="url(#kula-maska-dna)" />

        {/* ————— osiem pól, każde nalane od rdzenia ————— */}
        {POLA.map((p, i) => {
          const stopien = progowe[i + 1].stopien;
          const r = czolo(stopien);
          const zasieg = R * p.zasieg;
          const [ax, ay] = p.kotwica;
          const kx = CX + ax * R;
          const ky = CY + ay * R;
          const pudloW = R * 0.92;
          const pudloH = R * 0.58;

          const plama = (nr: number, ile: number, wype: string) => (
            <ellipse
              className={`kula-plama kula-p${nr}`}
              cx={kx}
              cy={ky}
              rx={+(pudloW * ile).toFixed(1)}
              ry={+(pudloH * ile).toFixed(1)}
              fill={wype}
              style={
                {
                  "--dx": `${(pudloW * ile * 0.3).toFixed(1)}px`,
                  "--dy": `${(pudloH * ile * 0.3).toFixed(1)}px`,
                } as React.CSSProperties
              }
            />
          );

          return otulina(
            i,
            <>
              {stopien > 0 && (
                <g className="kula-nalew" style={{ animationDelay: `${(i * 0.075).toFixed(2)}s` }}>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={+r.toFixed(1)}
                    fill="url(#kula-widmo)"
                    filter="url(#kula-miekko)"
                  />
                  {/* Rdzeń: gorące światło tuż za awatarem. Bez niego środek kuli był
                      najciemniejszym jej miejscem, mimo że to od niego wszystko się nalewa. */}
                  <circle cx={CX} cy={CY} r={+r.toFixed(1)} fill="url(#kula-rdzen)" />
                  {/* Refleks i odbicie od spodu - to one robią z barwy ciecz pod szkłem. */}
                  <circle cx={CX} cy={CY} r={+r.toFixed(1)} fill="url(#kula-polysk)" />
                  <circle cx={CX} cy={CY} r={+r.toFixed(1)} fill="url(#kula-spod)" />
                  {/* menisk: jasne czoło cieczy - to ono robi wrażenie nalania,
                      a nie pomalowania */}
                  <circle
                    cx={CX}
                    cy={CY}
                    r={+r.toFixed(1)}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity=".62"
                    strokeWidth={+(BOK * 0.0034).toFixed(2)}
                  />
                </g>
              )}

              {/* Żar jest przycięty razem z polem, więc zatrzymuje się dokładnie na jego
                  szwach - tak jak poświata województwa zatrzymuje się na granicy regionu. */}
              <g className="kula-zar">
                <g className="kula-plamy">
                  {plama(1, 0.58, `url(#kula-zarA-${stopien})`)}
                  {plama(2, 0.4, `url(#kula-zarA-${Math.min(stopien + 1, 4)})`)}
                  {plama(3, 0.23, "url(#kula-zarC)")}
                </g>
                {fala?.pole === i + 1 && (
                  <circle
                    key={fala.nr}
                    className="kula-fala"
                    cx={+fala.x.toFixed(1)}
                    cy={+fala.y.toFixed(1)}
                    r={+zasieg.toFixed(1)}
                    fill="url(#kula-czolo)"
                    onAnimationEnd={() => setFala(null)}
                  />
                )}
              </g>
            </>
          );
        })}

        {/* ————— szkło: refleks, krawędź, cień ————— */}
        <g clipPath="url(#kula-kolo)">
          <ellipse
            cx={+(CX - R * 0.3).toFixed(1)}
            cy={+(CY - R * 0.4).toFixed(1)}
            rx={+(R * 0.6).toFixed(1)}
            ry={+(R * 0.44).toFixed(1)}
            fill="url(#kula-szklo)"
            filter="url(#kula-poswiata)"
          />
          <circle cx={CX} cy={CY} r={R} fill="url(#kula-cien)" mask="url(#kula-maska-dna)" />
        </g>

        {/* ————— szwy ————— */}
        {szwy.map((d, i) => (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke="rgba(6,8,12,.86)"
              strokeWidth={+(grubosc * 0.96).toFixed(2)}
              strokeLinecap="round"
            />
            <path
              d={d}
              fill="none"
              stroke="rgba(255,255,255,.16)"
              strokeWidth={+(grubosc * 0.24).toFixed(2)}
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* ————— krawędź szkła —————
            Sama krawędź, bez barwy stopnia. Odkrywca siedział tu przedtem jako gruby
            kolorowy pierścień obiegający całą kulę - i to on, a nie gradient, robił
            z rysunku tarczę w obwódce. Przeniósł się pod zdjęcie, niżej. */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="url(#kula-krawedz)"
          strokeWidth={gruboscObreczy}
        />

        {/* ————— pola do najeżdżania i klikania ————— */}
        {POLA.map((_, i) =>
          otulina(
            i,
            <circle cx={CX} cy={CY} r={R} fill="transparent" style={{ pointerEvents: "all" }} />,
            true
          )
        )}

        {/* ————— awatar —————
            Litera zostaje pod spodem jako zapas: gdyby zdjęcie się nie wczytało, w rdzeniu
            kuli zostałaby dziura, a to najbardziej rzucające się w oczy miejsce na stronie. */}
        <circle cx={CX} cy={CY} r={R_AWATAR} fill="url(#kula-skora)" />
        <text
          x={CX}
          y={+(CY + R_AWATAR * 0.35).toFixed(1)}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={+(R_AWATAR * 1.08).toFixed(0)}
          fontWeight="800"
          fill={`rgb(${POZIOMY[2].barwa} / .5)`}
        >
          {nick.slice(0, 1).toUpperCase()}
        </text>
        {avatar && (
          <image
            href={avatar}
            x={+(CX - R_AWATAR).toFixed(1)}
            y={+(CY - R_AWATAR).toFixed(1)}
            width={+(R_AWATAR * 2).toFixed(1)}
            height={+(R_AWATAR * 2).toFixed(1)}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#kula-awatar)"
          />
        )}
        <circle
          cx={CX}
          cy={CY}
          r={R_AWATAR}
          fill="none"
          stroke="rgba(255,255,255,.26)"
          strokeWidth={+(BOK * 0.0026).toFixed(2)}
        />

      </svg>

      {/* Okienko stoi OBOK kuli, w stałym miejscu, a nie przy kursorze. Przy kursorze
          skakało po ekranie przy każdym przejściu między polami - a że teraz pokazuje się
          już od samego najechania, skakałoby bez przerwy. */}
      {wybor && (
        <div
          className={`kula-karta widac${przypiete ? " przypieta" : ""}`}
          role="dialog"
          aria-label="Szczegóły odznaczenia"
        >
          <KartaProgowa o={progowe[wybor]} zamknij={zamknij} pokazZamknij={przypiete} />
        </div>
      )}
    </div>
  );
}

function KartaProgowa({
  o,
  zamknij,
  pokazZamknij,
}: {
  o: Odznaczenie;
  zamknij: () => void;
  pokazZamknij: boolean;
}) {
  const barwa = (o.poziom ?? STOPNIE[0]).barwa;
  return (
    <>
      <div className="kula-karta-gora">
        <span className="kula-karta-pkt" style={{ background: `rgb(${barwa})` }} />
        <div>
          <h3>{o.nazwa}</h3>
          <p className="kula-karta-stopien" style={{ color: `rgb(${barwa})` }}>
            {(o.poziom ?? STOPNIE[0]).nazwa}
          </p>
        </div>
        {pokazZamknij && (
          <button type="button" className="kula-karta-zamknij" onClick={zamknij} aria-label="Zamknij">
            &times;
          </button>
        )}
      </div>

      <div className="kula-segmenty">
        {POZIOMY.map((p, k) => (
          <i
            key={p.id}
            style={k < o.stopien ? { background: `rgb(${p.barwa})` } : undefined}
          />
        ))}
      </div>

      <p className="kula-karta-licz">
        <b className="tabular-nums">{o.wartosc}</b>
        {o.licznik}
      </p>
      <p className="kula-karta-cel">
        {o.nastepny
          ? `Do stopnia „${o.nastepny.poziom.nazwa}” brakuje ${o.nastepny.brakuje}.`
          : "Najwyższy stopień osiągnięty - dalej już nie ma."}
      </p>
      <p className="kula-karta-opis">{o.opis}</p>
    </>
  );
}
