/**
 * Znak PodKosza: pinezka mapy z planem połowy boiska (łuk za trzy, pole trzech sekund, koło rzutów
 * wolnych, półkole bez szarży domknięte linią tablicy i linia końcowa w poprzek pinezki).
 *
 * Geometria w układzie 512 x 512, linie boiska w proporcjach FIBA (22,4 px na metr). Linie są
 * przycinane do wnętrza pinezki i schodzą pod jej obrys, więc łączą się z nim bez szwów - rama
 * i linie mają jeden gradient w układzie całego znaku (userSpaceOnUse).
 *
 * Jedno źródło dla wszystkich miejsc: logo w nawigacji (`Brand`), zasłona, obrazek do udostępniania
 * linku (`opengraph-image`) i pliki PNG do maili generowane z tych samych ścieżek.
 */
const f = (n: number) => +n.toFixed(2);

const S = 22.4;
const CX = 256;
const DOL = 318; // linia końcowa
const KOSZ = DOL - 1.575 * S;
const R3 = 6.75 * S;
const DX3 = 6.6 * S;
const DY3 = Math.sqrt(6.75 ** 2 - 6.6 ** 2) * S;
const PW = 2.45 * S;
const POLE = DOL - 5.8 * S;
const RW = 1.8 * S;
const RP = 1.25 * S;
const TABLICA = DOL - 1.2 * S;

export const ZNAK = {
  /** kadr ciasno wokół pinezki razem z grubością obrysu */
  viewBox: "70 22 372 476",
  /** proporcja szerokości do wysokości */
  proporcja: 372 / 476,
  rama: "M256 480C256 480 88 332 88 208A168 168 0 0 1 424 208C424 332 256 480 256 480Z",
  linie: [
    `M${f(CX - DX3)} ${DOL}V${f(KOSZ - DY3)}A${f(R3)} ${f(R3)} 0 0 1 ${f(CX + DX3)} ${f(KOSZ - DY3)}V${DOL}`,
    `M${f(CX - PW)} ${DOL}V${f(POLE)}H${f(CX + PW)}V${DOL}`,
    `M${f(CX - RW)} ${f(POLE)}a${f(RW)} ${f(RW)} 0 1 0 ${f(2 * RW)} 0a${f(RW)} ${f(RW)} 0 1 0 ${f(-2 * RW)} 0`,
    `M${f(CX - RP)} ${f(TABLICA)}V${f(KOSZ)}A${f(RP)} ${f(RP)} 0 0 1 ${f(CX + RP)} ${f(KOSZ)}V${f(TABLICA)}Z`,
  ],
  koncowa: `M40 ${DOL}H472`,
  /**
   * Grubości kresek. `duzy` - znak od ~120 px wzwyż, cienkie linie jak w wybranej wersji.
   * `maly` - nawigacja i favicon: 5 jednostek w 36 px to pół piksela i linie by znikły.
   */
  grubosc: {
    duzy: { rama: 28, linie: 5, koncowa: 6 },
    maly: { rama: 32, linie: 12, koncowa: 13 },
  },
  /** gradient po przekątnej całego znaku: kremowy blask u góry z lewej, żar u dołu z prawej */
  gradient: {
    x1: 70, y1: 48, x2: 452, y2: 470,
    stopy: [
      [0, "#FFF3D1"],
      [0.2, "#FFC77E"],
      [0.48, "#FF8420"],
      [0.76, "#FF500E"],
      [1, "#E12A00"],
    ] as [number, string][],
  },
} as const;

/** Znak jako gotowy SVG - dla miejsc bez Reacta (obrazek do udostępniania, pliki do maili). */
export function znakSvg(uid: string, { rozmiar = "duzy" as "duzy" | "maly", szerokosc }: { rozmiar?: "duzy" | "maly"; szerokosc?: number } = {}) {
  const g = ZNAK.grubosc[rozmiar];
  const gr = ZNAK.gradient;
  const w = szerokosc ?? 372;
  const h = Math.round(w / ZNAK.proporcja);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ZNAK.viewBox}" width="${w}" height="${h}" fill="none">
<defs>
<linearGradient id="${uid}-g" gradientUnits="userSpaceOnUse" x1="${gr.x1}" y1="${gr.y1}" x2="${gr.x2}" y2="${gr.y2}">${gr.stopy.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>
<clipPath id="${uid}-c"><path d="${ZNAK.rama}"/></clipPath>
</defs>
<g stroke="url(#${uid}-g)" stroke-linecap="round" stroke-linejoin="round">
<g clip-path="url(#${uid}-c)">${ZNAK.linie.map((d) => `<path d="${d}" stroke-width="${g.linie}"/>`).join("")}<path d="${ZNAK.koncowa}" stroke-width="${g.koncowa}"/></g>
<path d="${ZNAK.rama}" stroke-width="${g.rama}"/>
</g>
</svg>`;
}
