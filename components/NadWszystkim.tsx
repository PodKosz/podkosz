"use client";

import { createPortal } from "react-dom";

/**
 * Nakładka wyniesiona do <body> - dla okien, które mają przykryć cały ekran.
 *
 * Treść każdej strony leży w warstwie `relative z-10` z układu, a pasek nawigacji stoi obok
 * niej z `z-40`. Okno otwarte z wnętrza strony, choćby miało `z-50` albo `z-[90]`, liczy
 * się tylko wewnątrz tamtej warstwy - więc pasek wchodził na jego górę. Do tego sekcje
 * z animacją wejścia (`data-wjazd`) przez chwilę się przekształcają, a przekształcony
 * przodek odbiera elementom `position: fixed` przyklejenie do ekranu: tło okna „Napisz
 * opinię" zajmowało wtedy pas w połowie strony zamiast całego widoku.
 *
 * W <body> nic z tego nie sięga. Zdarzenia Reacta i tak idą przez drzewo komponentów, więc
 * okno trzeba osadzać obok przycisku, a nie wewnątrz linku czy klikalnej karty.
 */
export function NadWszystkim({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
