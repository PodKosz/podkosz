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
   * Grubości kresek - wersja 7 z porównania grubości (19.10.2026): obrys pinezki jak w znaku
   * 001 (28), szwy piłki grube (17). Wcześniej było 28 / 7, a nawigacja dostawała osobną,
   * pogrubioną odmianę (32 / 13), bo 7 jednostek w 36 px to pół piksela i szwy znikały.
   * Przy szwach 17 ten problem znika, więc obie odmiany są dziś równe - zostają jako dwie,
   * żeby małe rozmiary dało się kiedyś znowu dostroić bez szukania wszystkich miejsc.
   */
  grubosc: {
    duzy: { rama: 28, szwy: 17 },
    maly: { rama: 28, szwy: 17 },
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

/**
 * Znak słowny PODKOSZ - narysowany od zera 22.10.2026 (wersja „Atletyczny”), bez żadnej czcionki,
 * więc w całości nasz. Litery to pełne kształty z wyciętym światłem: równe promienie narożników,
 * kreski poziome odrobinę cieńsze od pionowych (korekta optyczna), przekątne trafiające dokładnie
 * w narożniki. Generator: `narzedzia/napis-atletyczny.py` w podkosz-brand.
 *
 * Układ: wysokość 100 = wysokość liter, wszystko stoi równo w pasie 0..100. „POD” i „KOSZ” to
 * osobne ścieżki, bo malujemy je inaczej: POD kolorem tekstu, KOSZ płomieniem.
 */
export const ZNAK_SLOWNY = {
  szerokosc: 615.5,
  wysokosc: 100,
  /** gdzie zaczyna się „KOSZ” - od tego miejsca biegnie gradient */
  koszOd: 282,
  pod: "M108 0H148C163.46 0 176 12.54 176 28V72C176 87.46 163.46 100 148 100H108C92.54 100 80 87.46 80 72V28C80 12.54 92.54 0 108 0ZM188 0H242C257.46 0 270 12.54 270 28V72C270 87.46 257.46 100 242 100H188ZM0 0H42C57.46 0 70 12.54 70 28V32C70 47.46 57.46 60 42 60H22V100H0ZM110 18.5C105.58 18.5 102 22.08 102 26.5V73.5C102 77.92 105.58 81.5 110 81.5H146C150.42 81.5 154 77.92 154 73.5V26.5C154 22.08 150.42 18.5 146 18.5ZM210 18.5V81.5H240C244.42 81.5 248 77.92 248 73.5V26.5C248 22.08 244.42 18.5 240 18.5ZM22 18.5V41.5H40C44.42 41.5 48 37.92 48 33.5V26.5C48 22.08 44.42 18.5 40 18.5Z",
  kosz: "M393 0H433C448.46 0 461 12.54 461 28V72C461 87.46 448.46 100 433 100H393C377.54 100 365 87.46 365 72V28C365 12.54 377.54 0 393 0ZM282 0H304V30.03L305.39 28.43L330.15 0H358L318.13 45.77L358 100H331.94L304 62V100H282ZM499 0H539V18.5H501C496.58 18.5 493 22.08 493 26.5V31.75C493 36.17 496.58 39.75 501 39.75H519C530.05 39.75 539 48.7 539 59.75V72C539 87.46 526.46 100 511 100H471V81.5H509C513.42 81.5 517 77.92 517 73.5V66.25C517 61.83 513.42 58.25 509 58.25H491C479.95 58.25 471 49.3 471 38.25V28C471 12.54 483.54 0 499 0ZM547.5 0H615.5V18.5L572.86 81.5H615.5V100H547.5V81.5L590.14 18.5H547.5ZM395 18.5C390.58 18.5 387 22.08 387 26.5V73.5C387 77.92 390.58 81.5 395 81.5H431C435.42 81.5 439 77.92 439 73.5V26.5C439 22.08 435.42 18.5 431 18.5Z",
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
