"use client";

import { useSyncExternalStore } from "react";

/**
 * Motyw strony - „ciemny" (domyślny) albo „jasny".
 *
 * Motyw zmienia wyłącznie warstwę barwną. Nie ma tu żadnej logiki poza przełączeniem:
 * cała różnica siedzi w zmiennych CSS (patrz blok „motywy" w `app/globals.css`), a suwak
 * w menu konta ustawia tylko atrybut `data-motyw` na elemencie `html`. Dzięki temu ani
 * jeden komponent nie wie, który motyw jest włączony - i nie może się o niego potknąć.
 *
 * WYBÓR NIE PRZETRWA ODŚWIEŻENIA STRONY - i to celowo (decyzja Basketa z 19.10.2026).
 * Każde wejście i każde przeładowanie zaczyna się od ciemnego, a jasny trwa, dopóki strona
 * jest otwarta: przechodzenie między podstronami go nie gasi, bo atrybut siedzi na `html`,
 * który przy nawigacji w obrębie serwisu zostaje ten sam. Do tego dnia wybór leżał
 * w `localStorage` i wracał po odświeżeniu.
 */

export const MOTYWY = [
  { id: "ciemny", nazwa: "Ciemny" },
  { id: "jasny", nazwa: "Jasny" },
] as const;

export type Motyw = (typeof MOTYWY)[number]["id"];

const DOMYSLNY: Motyw = "ciemny";
/** Klucz, pod którym wybór leżał w pamięci przeglądarki do 19.10.2026 - już tylko do sprzątnięcia. */
const DAWNY_KLUCZ = "podkosz-motyw";
const ZDARZENIE = "podkosz-motyw-zmiana";

/** Maluje stronę wybranym motywem i budzi wszystkie nasłuchy w tej karcie. */
export function ustawMotyw(motyw: Motyw) {
  zastosuj(motyw);
  window.dispatchEvent(new Event(ZDARZENIE));
}

/**
 * Nadaje atrybut na `html`. Motyw domyślny zdejmuje atrybut, a nie ustawia go na
 * „ciemny" - w arkuszu barwy domyślne siedzą wprost na `:root`, więc brak atrybutu jest
 * poprawnym stanem i nie wymaga niczego dopisywać.
 */
function zastosuj(motyw: Motyw) {
  const html = document.documentElement;
  if (motyw === DOMYSLNY) delete html.dataset.motyw;
  else html.dataset.motyw = motyw;
}

function subskrybuj(powiadom: () => void) {
  window.addEventListener(ZDARZENIE, powiadom);
  return () => window.removeEventListener(ZDARZENIE, powiadom);
}

/* jedynym źródłem prawdy jest atrybut na `html` - nic poza nim nie pamięta wyboru */
function stanPrzegladarki(): Motyw {
  return document.documentElement.dataset.motyw === "jasny" ? "jasny" : DOMYSLNY;
}

/* serwer zawsze renderuje ciemny - i to jest dokładnie to, co strona pokaże po wejściu */
const stanSerwera = () => DOMYSLNY;

/**
 * Aktualny motyw.
 *
 * Przez `useSyncExternalStore`, a nie `useState`: suwak w menu i warstwy mapy muszą
 * widzieć tę samą wartość i dowiedzieć się o zmianie w tej samej chwili, a stan siedzi
 * poza Reactem - w atrybucie na `html`.
 */
export function useMotyw(): Motyw {
  return useSyncExternalStore(subskrybuj, stanPrzegladarki, stanSerwera);
}

/**
 * Skrypt wykonywany przed pierwszym malowaniem strony.
 *
 * Do 19.10.2026 malował tu zapamiętany motyw. Wyboru już nie pamiętamy, więc zostały mu
 * dwie rzeczy:
 *
 *  - sprząta dawny wpis z `localStorage`, żeby nie leżał w przeglądarce bez powodu,
 *  - dopisuje klasę `wjazdy`: od niej arkusz ukrywa elementy podstron, które mają dopiero
 *    wejść (patrz `components/Wjazdy.tsx`). Musi paść PRZED pierwszym malowaniem -
 *    dopisana z Reactem, po hydracji, pozwoliłaby treści mignąć w stanie końcowym
 *    i zniknąć. Poza `try`, bo nie zależy od pamięci przeglądarki, którą prywatne okno
 *    potrafi zablokować.
 */
export const SKRYPT_MOTYWU = `try{localStorage.removeItem("${DAWNY_KLUCZ}")}catch(e){}document.documentElement.classList.add("wjazdy")`;
