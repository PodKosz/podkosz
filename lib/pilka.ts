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
 *   - dwa łuki POZIOME po obu stronach szwu poziomego: górny zwisa ku środkowi
 *     (dolina), dolny wypina się ku środkowi (garb), oba dotykają obwodu z lewej
 *     i z prawej.
 *
 * Poprzedni układ miał łuki PIONOWE, wygięte na zewnątrz wzdłuż krawędzi. Wyglądało
 * to jak celownik, nie jak piłka: to dwa dodatkowe łuki w poprzek, a nie sam krzyż,
 * dają wrażenie kuli. Stary wariant jest zapisany w
 * `dokumentacja/pinezka-szwy-2026-09.md` razem z instrukcją powrotu.
 *
 * ------------------------------------------------------------------ skąd te proporcje
 *
 * Zdjęte z rysunku odniesienia, nie dobrane na oko:
 *
 *   0.36 r / 0.933 r  - końce łuku; 0.36² + 0.933² = 1, czyli dokładnie na obwodzie
 *   0.30 r            - jak blisko środka podchodzi wierzchołek łuku; tyle zostaje
 *                       prześwitu między łukiem a szwem poziomym
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
  const ex = z(r * 0.78); // końce łuku: odsunięcie w bok
  const ey = z(r * 0.585); // ...i w pionie
  const wyg = z(r * 0.585 - r * 0.3); // promień pionowy łuku -> wierzchołek na 0.3 r

  return [
    `M${z(cx)} ${z(cy - k)}V${z(cy + k)}`,
    `M${z(cx - k)} ${z(cy)}H${z(cx + k)}`,
    `M${z(cx - ex)} ${z(cy - ey)}A${ex} ${wyg} 0 0 0 ${z(cx + ex)} ${z(cy - ey)}`,
    `M${z(cx - ex)} ${z(cy + ey)}A${ex} ${wyg} 0 0 1 ${z(cx + ex)} ${z(cy + ey)}`,
  ].join("");
}
