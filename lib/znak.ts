/**
 * Znak PodKosza: pinezka mapy, której główka jest piłką do koszykówki - pionowy szew, równik
 * i dwa łuki boczne. Szwy kończące się nisko biegną dalej po stycznej w ogonek, aż trafią w obrys,
 * a pionowy schodzi do samego czubka.
 *
 * Geometria w układzie 512 x 512: główka to okrąg r 168 o środku (256, 208), łuki boczne to okręgi
 * o promieniu 1,25 r ze środkiem 1,62 r od osi. Szwy są przycinane do wnętrza pinezki i schodzą pod
 * jej obrys, więc łączą się z nim bez szwów - rama i szwy mają jeden gradient w układzie całego
 * znaku (userSpaceOnUse).
 *
 * Jedno źródło dla wszystkich miejsc: logo w nawigacji (`Brand`), zasłona, obrazek do udostępniania
 * linku (`opengraph-image`) i pliki PNG do maili generowane z tych samych ścieżek.
 */
const f = (n: number) => +n.toFixed(2);

const CX = 256;
const CY = 208;
const R = 168;
/* łuk boczny: okrąg o środku (CX - A·R, CY) i promieniu B·R, przecina główkę w (CX + XI·R, CY ∓ YI·R) */
const A = 1.62;
const B = 1.25;
const XI = (1 + A * A - B * B) / (-2 * A);
const YI = Math.sqrt(1 - XI * XI);
/* styczna w górnym końcu lewego łuku, skierowana w górę i w lewo (prostopadła do promienia łuku);
   dolny koniec ma ją odbitą w pionie, prawy łuk - w poziomie */
const UX = -YI / B;
const UY = -(XI + A) / B;
const PRZEDL = 220; // długość przedłużenia w px - i tak przycina je obrys

/** strona -1 to lewy łuk „)", 1 prawy „(" */
function lukBoczny(strona: -1 | 1) {
  const px = CX + (strona < 0 ? XI : -XI) * R, gy = CY - YI * R, dy = CY + YI * R;
  const ux = strona < 0 ? UX : -UX;
  const g0 = [px + ux * PRZEDL, gy + UY * PRZEDL];
  const d0 = [px + ux * PRZEDL, dy - UY * PRZEDL];
  const r = B * R;
  return `M${f(g0[0])} ${f(g0[1])}L${f(px)} ${f(gy)}A${f(r)} ${f(r)} 0 0 ${strona < 0 ? 1 : 0} ${f(px)} ${f(dy)}L${f(d0[0])} ${f(d0[1])}`;
}

export const ZNAK = {
  /** kadr ciasno wokół pinezki razem z grubością obrysu */
  viewBox: "70 22 372 476",
  /** proporcja szerokości do wysokości */
  proporcja: 372 / 476,
  rama: "M256 480C256 480 88 332 88 208A168 168 0 0 1 424 208C424 332 256 480 256 480Z",
  szwy: [`M${CX} 0V512`, `M0 ${CY}H512`, lukBoczny(-1), lukBoczny(1)],
  /**
   * Grubości kresek. `duzy` - znak od ~120 px wzwyż, jak w wybranej wersji 001.
   * `maly` - nawigacja i favicon: 7 jednostek w 36 px to pół piksela i szwy by znikły.
   */
  grubosc: {
    duzy: { rama: 28, szwy: 7 },
    maly: { rama: 32, szwy: 13 },
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
<g clip-path="url(#${uid}-c)">${ZNAK.szwy.map((d) => `<path d="${d}" stroke-width="${g.szwy}"/>`).join("")}</g>
<path d="${ZNAK.rama}" stroke-width="${g.rama}"/>
</g>
</svg>`;
}
