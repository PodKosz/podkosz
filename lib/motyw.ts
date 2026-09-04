"use client";

import { useSyncExternalStore } from "react";

/**
 * Motyw graficzny serwisu - „classic", „polska" albo „coconaut".
 *
 * Motyw zmienia wyłącznie warstwę barwną. Nie ma tu żadnej logiki poza zapamiętaniem
 * wyboru: cała różnica siedzi w zmiennych CSS (patrz blok „motywy graficzne"
 * w `app/globals.css`), a przełącznik ustawia tylko atrybut `data-motyw` na elemencie
 * `html`. Dzięki temu ani jeden komponent nie wie, która skórka jest włączona - i nie
 * może się o nią potknąć.
 *
 * Wybór trzymamy w `localStorage`, nie w bazie: to ustawienie urządzenia, nie konta.
 * Na czas pokazów wystarcza, a przy okazji nie wymaga migracji ani zapytania do bazy
 * przy każdym wejściu.
 */

export const MOTYWY = [
  { id: "classic", nazwa: "Classic" },
  { id: "polska", nazwa: "Polska" },
  { id: "coconaut", nazwa: "Coconaut" },
] as const;

export type Motyw = (typeof MOTYWY)[number]["id"];

const DOMYSLNY: Motyw = "classic";
export const KLUCZ_MOTYWU = "podkosz-motyw";
/* własne zdarzenie, bo `storage` nie leci do karty, która sama zapisała wartość */
const ZDARZENIE = "podkosz-motyw-zmiana";

function poprawny(wartosc: string | null): Motyw {
  return MOTYWY.some((m) => m.id === wartosc) ? (wartosc as Motyw) : DOMYSLNY;
}

/** Zapisuje wybór, maluje stronę i budzi wszystkie nasłuchy w tej karcie. */
export function ustawMotyw(motyw: Motyw) {
  try {
    window.localStorage.setItem(KLUCZ_MOTYWU, motyw);
  } catch {
    /* tryb prywatny albo zablokowane dane witryny - motyw zadziała do przeładowania */
  }
  zastosuj(motyw);
  window.dispatchEvent(new Event(ZDARZENIE));
}

/**
 * Nadaje atrybut na `html`. Motyw domyślny zdejmuje atrybut, a nie ustawia go na
 * „classic" - w arkuszu barwy domyślne siedzą wprost na `:root`, więc brak atrybutu jest
 * poprawnym stanem i nie wymaga niczego dopisywać.
 */
function zastosuj(motyw: Motyw) {
  const html = document.documentElement;
  if (motyw === DOMYSLNY) delete html.dataset.motyw;
  else html.dataset.motyw = motyw;
}

const sluchacze = new Set<() => void>();

function subskrybuj(powiadom: () => void) {
  sluchacze.add(powiadom);
  window.addEventListener(ZDARZENIE, powiadom);
  /* zmiana w innej karcie tej samej przeglądarki */
  window.addEventListener("storage", powiadom);
  return () => {
    sluchacze.delete(powiadom);
    window.removeEventListener(ZDARZENIE, powiadom);
    window.removeEventListener("storage", powiadom);
  };
}

function stanPrzegladarki(): Motyw {
  try {
    return poprawny(window.localStorage.getItem(KLUCZ_MOTYWU));
  } catch {
    return DOMYSLNY;
  }
}

/* serwer nie zna wyboru urządzenia - i to jest właściwa odpowiedź, nie brak odpowiedzi */
const stanSerwera = () => DOMYSLNY;

/**
 * Aktualny motyw.
 *
 * Przez `useSyncExternalStore`, a nie `useState`, z tego samego powodu co filtry mapy:
 * serwer renderuje stan domyślny, hydracja idzie po nim (więc zgadza się co do znaku),
 * a zaraz po niej React sam sięga po `localStorage`. Odczyt w stanie startowym dawałby
 * niezgodność hydracji i React składałby pasek nawigacji od nowa.
 */
export function useMotyw(): Motyw {
  return useSyncExternalStore(subskrybuj, stanPrzegladarki, stanSerwera);
}

/**
 * Skrypt malujący stronę, zanim przeglądarka pokaże pierwszą klatkę.
 *
 * Bez niego strona pojawiałaby się w barwach domyślnych i przeskakiwała na wybrane
 * dopiero po wczytaniu JavaScriptu - przy ciemnym tle i pomarańczowych akcentach taki
 * przeskok widać jak mrugnięcie. Skrypt jest w `<body>` przed treścią, wykonuje się
 * w trakcie parsowania i cały mieści się w jednej linijce, bo blokuje rysowanie.
 */
export const SKRYPT_MOTYWU = `try{var m=localStorage.getItem("${KLUCZ_MOTYWU}");if(m&&m!=="${DOMYSLNY}")document.documentElement.dataset.motyw=m}catch(e){}`;
