"use client";

import { useSyncExternalStore } from "react";

/**
 * Motyw strony - „ciemny" (domyślny) albo „jasny".
 *
 * Motyw zmienia wyłącznie warstwę barwną. Nie ma tu żadnej logiki poza zapamiętaniem
 * wyboru: cała różnica siedzi w zmiennych CSS (patrz blok „motywy" w `app/globals.css`),
 * a suwak w menu konta ustawia tylko atrybut `data-motyw` na elemencie `html`. Dzięki
 * temu ani jeden komponent nie wie, który motyw jest włączony - i nie może się o niego
 * potknąć.
 *
 * Wybór trzymamy w `localStorage`, nie w bazie: to ustawienie urządzenia, nie konta -
 * na telefonie w nocy ktoś chce ciemnego, na komputerze w biurze jasnego.
 */

export const MOTYWY = [
  { id: "ciemny", nazwa: "Ciemny" },
  { id: "jasny", nazwa: "Jasny" },
] as const;

export type Motyw = (typeof MOTYWY)[number]["id"];

const DOMYSLNY: Motyw = "ciemny";
export const KLUCZ_MOTYWU = "podkosz-motyw";
/* własne zdarzenie, bo `storage` nie leci do karty, która sama zapisała wartość */
const ZDARZENIE = "podkosz-motyw-zmiana";

/*
  Dawne skórki z pokazów (do 19.10.2026) były jasne - kto którąś wybrał, chciał jasnej
  strony, więc dostaje motyw jasny, a nie powrót do ciemnego. Ta sama mapa siedzi
  w `SKRYPT_MOTYWU` niżej, bo skrypt działa, zanim ten moduł się wczyta.
*/
const DAWNE_JASNE = ["polska", "coconaut"];

function poprawny(wartosc: string | null): Motyw {
  if (wartosc && DAWNE_JASNE.includes(wartosc)) return "jasny";
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
 * „ciemny" - w arkuszu barwy domyślne siedzą wprost na `:root`, więc brak atrybutu jest
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
/*
  Na końcu skryptu klasa `wjazdy`: od niej arkusz ukrywa elementy podstron, które mają
  dopiero wejść (patrz `components/Wjazdy.tsx`). Musi paść PRZED pierwszym malowaniem -
  dopisana z Reactem, po hydracji, pozwoliłaby treści mignąć w stanie końcowym i zniknąć.
  Poza `try`, bo nie zależy od pamięci przeglądarki, którą prywatne okno potrafi zablokować.
*/
export const SKRYPT_MOTYWU = `try{var m=localStorage.getItem("${KLUCZ_MOTYWU}");if(${JSON.stringify(DAWNE_JASNE)}.indexOf(m)>=0)m="jasny";if(m==="jasny")document.documentElement.dataset.motyw=m}catch(e){}document.documentElement.classList.add("wjazdy")`;
