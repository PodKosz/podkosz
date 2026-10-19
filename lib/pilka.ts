/**
 * Szwy piłki do kosza - jedno miejsce dla całego serwisu.
 *
 * ------------------------------------------------------------------ po co osobny plik
 *
 * Piłkę rysowaliśmy w SZEŚCIU miejscach, każde z własną, przepisaną ręcznie ścieżką:
 * pinezka boiska, pinezka nieodkrytego boiska, pinezka minigry, ikona `BallIcon`,
 * strona nieodkrytego boiska i piłka w kole środkowym logo. Sześć kopii tego samego
 * rysunku to sześć okazji, żeby jedna została w tyle - i dokładnie tak było przy
 * zmianie układu szwów. Teraz wszystkie biorą ścieżkę stąd.
 *
 * ------------------------------------------------------------------ jak wygląda układ
 *
 * Tak, jak na prawdziwej piłce widzianej NA WPROST:
 *
 *   - szew pionowy i poziomy przez środek,
 *   - dwa łuki PIONOWE po obu stronach szwu pionowego, wygięte ku środkowi - lewy „)",
 *     prawy „(" - oba dochodzą do obwodu u góry i u dołu. Ten sam układ co w logo
 *     (`lib/znak.ts`), więc pinezki na mapie i znak serwisu są jedną rodziną.
 *
 * Historia, na wypadek powrotu (oba stare warianty z instrukcją są w
 * `dokumentacja/pinezka-szwy-2026-09.md`):
 *   - do 18.09.2026 łuki pionowe, ale wygięte NA ZEWNĄTRZ, wzdłuż krawędzi kuli -
 *     czytały się jak celownik, nie jak piłka;
 *   - 18.09-19.10.2026 łuki POZIOME (górny zwisał ku środkowi, dolny się wypinał),
 *     czyli dzisiejszy rysunek obrócony o 90 stopni. Obrócony na prośbę twórcy,
 *     żeby linie na piłce szły pionowo, jak w logo.
 *
 * ------------------------------------------------------------------ skąd te proporcje
 *
 * Zdjęte z rysunku odniesienia, nie dobrane na oko:
 *
 *   0.585 r / 0.78 r  - końce łuku: odsunięcie od osi pionowej i od równika; to 0.975 r
 *                       od środka, więc z grubością kreski łuk dochodzi do obwodu
 *   0.30 r            - jak blisko osi podchodzi wierzchołek łuku; tyle zostaje
 *                       prześwitu między łukiem a szwem pionowym
 *   0.96 r            - zasięg szwu prostego. Skrócony, bo przy `stroke-linecap="round"`
 *                       okrągłe zakończenie wystaje o pół grubości kreski i przy pełnym
 *                       promieniu wyłaziłoby poza kulę.
 */

/** Zaokrąglenie do dwóch miejsc - dłuższe liczby tylko puchną w treści strony. */
const z = (n: number) => Math.round(n * 100) / 100;

/**
 * Cztery szwy jako jedna ścieżka SVG.
 *
 * Zwraca sam atrybut `d`, więc wywołujący decyduje o grubości, barwie i przezroczystości -
 * ikona rysuje je inaczej niż pinezka, a logo jeszcze inaczej.
 *
 * Samego OBRYSU kuli tu nie ma i to jest celowe: w części miejsc jest to `<circle>`,
 * w części wypełniona kula bez obrysu, a w jednym maska. Wspólne są szwy, nie kula.
 */
export function szwyPilki(cx: number, cy: number, r: number): string {
  const k = z(r * 0.96); // zasięg pionu i poziomu
  const ex = z(r * 0.585); // końce łuku: odsunięcie w bok
  const ey = z(r * 0.78); // ...i w pionie
  const wyg = z(r * 0.585 - r * 0.3); // poziomy promień łuku -> wierzchołek 0.3 r od osi

  return [
    `M${z(cx)} ${z(cy - k)}V${z(cy + k)}`,
    `M${z(cx - k)} ${z(cy)}H${z(cx + k)}`,
    // lewy łuk „)" - z góry na dół, wygięty w prawo, ku środkowi
    `M${z(cx - ex)} ${z(cy - ey)}A${wyg} ${ey} 0 0 1 ${z(cx - ex)} ${z(cy + ey)}`,
    // prawy łuk „(" - lustrzane odbicie lewego
    `M${z(cx + ex)} ${z(cy - ey)}A${wyg} ${ey} 0 0 0 ${z(cx + ex)} ${z(cy + ey)}`,
  ].join("");
}
