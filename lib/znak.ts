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
 * Znak słowny PODKOSZ - narysowany od zera, bez żadnej czcionki, więc w całości nasz. Od
 * 22.10.2026 wariant 05 „Szeroki” z dwudziestu propozycji: rysunek „Atletycznego” z szerszymi
 * literami i większym światłem między nimi. Litery to pełne kształty z wyciętym światłem: równe
 * promienie narożników, kreski poziome odrobinę cieńsze od pionowych (korekta optyczna),
 * przekątne trafiające dokładnie w narożniki. Generator: `narzedzia/napis20.py` w podkosz-brand
 * (wariant `a05`).
 *
 * Układ: wysokość 100 = wysokość liter, wszystko stoi równo w pasie 0..100. „POD” i „KOSZ” to
 * osobne ścieżki, bo malujemy je inaczej: POD kolorem tekstu, KOSZ płomieniem.
 */
export const ZNAK_SLOWNY = {
  szerokosc: 745.33,
  wysokosc: 100,
  /** gdzie zaczyna się „KOSZ” - od tego miejsca biegnie gradient */
  koszOd: 343.64,
  pod: "M125.6 0H182.88C198.34 0 210.88 12.54 210.88 28V72C210.88 87.46 198.34 100 182.88 100H125.6C110.14 100 97.6 87.46 97.6 72V28C97.6 12.54 110.14 0 125.6 0ZM228.88 0H297.64C313.1 0 325.64 12.54 325.64 28V72C325.64 87.46 313.1 100 297.64 100H228.88ZM0 0H54.6C70.06 0 82.6 12.54 82.6 28V32C82.6 47.46 70.06 60 54.6 60H22V100H0ZM127.6 18.5C123.18 18.5 119.6 22.08 119.6 26.5V73.5C119.6 77.92 123.18 81.5 127.6 81.5H180.88C185.3 81.5 188.88 77.92 188.88 73.5V26.5C188.88 22.08 185.3 18.5 180.88 18.5ZM250.88 18.5V81.5H295.64C300.06 81.5 303.64 77.92 303.64 73.5V26.5C303.64 22.08 300.06 18.5 295.64 18.5ZM22 18.5V41.5H52.6C57.02 41.5 60.6 37.92 60.6 33.5V26.5C60.6 22.08 57.02 18.5 52.6 18.5Z",
  kosz: "M471.82 0H529.1C544.56 0 557.1 12.54 557.1 28V72C557.1 87.46 544.56 100 529.1 100H471.82C456.36 100 443.82 87.46 443.82 72V28C443.82 12.54 456.36 0 471.82 0ZM343.64 0H365.64V33.52L366.28 32.94L402.23 0H433.32L381.14 47.8L433.32 100H403.63L365.64 62V100H343.64ZM600.1 0H652.34V18.5H602.1C597.68 18.5 594.1 22.08 594.1 26.5V31.75C594.1 36.17 597.68 39.75 602.1 39.75H632.34C643.39 39.75 652.34 48.7 652.34 59.75V72C652.34 87.46 639.8 100 624.34 100H572.1V81.5H622.34C626.76 81.5 630.34 77.92 630.34 73.5V66.25C630.34 61.83 626.76 58.25 622.34 58.25H592.1C581.05 58.25 572.1 49.3 572.1 38.25V28C572.1 12.54 584.64 0 600.1 0ZM665.09 0H745.33V18.5L692.5 81.5H745.33V100H665.09V81.5L717.92 18.5H665.09ZM473.82 18.5C469.4 18.5 465.82 22.08 465.82 26.5V73.5C465.82 77.92 469.4 81.5 473.82 81.5H527.1C531.52 81.5 535.1 77.92 535.1 73.5V26.5C535.1 22.08 531.52 18.5 527.1 18.5Z",
} as const;

/**
 * Płomień na „KOSZ” i jasne „POD” z motywu ciemnego (`--color-glow-soft` … `--color-ember-deep`,
 * `--color-ink` w globals.css) - dla miejsc, gdzie nie ma zmiennych CSS: obrazek do
 * udostępniania i logo w mailach. Oba leżą na czerni, więc biorą barwy ciemnego motywu.
 */
export const NAPIS_BARWY = {
  pod: "#F2F2F5",
  plomien: [
    [0, "#FFC47D"],
    [0.45, "#FF7A18"],
    [0.75, "#FF4D0A"],
    [1, "#FF3D00"],
  ] as [number, string][],
};

/** Napis jako gotowy SVG w barwach `NAPIS_BARWY` - `wysokosc` to wysokość liter w pikselach. */
export function napisSvg(uid: string, wysokosc: number) {
  const { szerokosc: w, wysokosc: h, koszOd, pod, kosz } = ZNAK_SLOWNY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${f((wysokosc * w) / h)}" height="${wysokosc}">
<defs>
<linearGradient id="${uid}-g" gradientUnits="userSpaceOnUse" x1="${koszOd}" y1="0" x2="${w}" y2="${h}">${NAPIS_BARWY.plomien.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>
</defs>
<path d="${pod}" fill="${NAPIS_BARWY.pod}"/>
<path d="${kosz}" fill="url(#${uid}-g)"/>
</svg>`;
}

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
