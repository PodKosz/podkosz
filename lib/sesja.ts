"use client";

import { useEffect, useState } from "react";

/**
 * Dane zalogowanego użytkownika po stronie przeglądarki.
 *
 * Wszystko, co zależy od konkretnej osoby - kto jest zalogowany, które boiska podpaliła
 * i które ma w ulubionych - dociągamy tutaj, a nie renderujemy na serwerze. Dzięki temu
 * strony (mapa, karty boisk, podstrony miejsc) są jednakowe dla wszystkich i mogą lecieć
 * z pamięci podręcznej, zamiast być składane przy każdym wejściu.
 *
 * Zapytanie idzie raz na wczytanie strony: obietnica jest zapamiętana w module, więc pasek
 * nawigacji, przyciski podpalenia i ulubione korzystają z tej samej odpowiedzi.
 */
export interface SesjaUzytkownik {
  name: string;
  avatar: string | null;
  isAdmin: boolean;
  /** konto zablokowane - zapisy odrzuca też baza */
  isBanned: boolean;
}

export interface Sesja {
  user: SesjaUzytkownik | null;
  /** identyfikatory podpalonych boisk */
  likes: string[];
  /** identyfikatory boisk w ulubionych */
  favorites: string[];
}

const PUSTA: Sesja = { user: null, likes: [], favorites: [] };

let obietnica: Promise<Sesja> | null = null;

/** Jedno zapytanie na wczytanie strony, wspólne dla wszystkich komponentów. */
export function pobierzSesje(): Promise<Sesja> {
  obietnica ??= fetch("/api/sesja", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Sesja>) : PUSTA))
    .then((s) => ({ user: s.user ?? null, likes: s.likes ?? [], favorites: s.favorites ?? [] }))
    .catch(() => PUSTA);

  return obietnica;
}

/**
 * Zapisuje w pamięci sesji, że ktoś właśnie coś podpalił albo dodał do ulubionych.
 *
 * Bez tego kliknięcie potrafiło się cofnąć samo. Przyciski biorą stan początkowy z sesji
 * i są przemontowywane przez `key`, gdy ta wreszcie przyjdzie - a odpowiedź wyruszyła po
 * sieć ZANIM ktoś kliknął, więc nic o tym kliknięciu nie wie i przywraca stan sprzed niego.
 *
 * Listę zmieniamy W MIEJSCU, a nie przez podmianę obiektu. To jedyny sposób, żeby dotarło
 * to także do `useSesja`, które trzyma referencję na obiekcie z pierwszego rozwiązania
 * obietnicy. Podmiana samej obietnicy załatwia z kolei tych, którzy przyjdą później.
 */
export function zapamietajReakcje(
  rodzaj: "likes" | "favorites",
  courtId: string,
  jest: boolean
): void {
  obietnica = pobierzSesje().then((s) => {
    const lista = s[rodzaj];
    const gdzie = lista.indexOf(courtId);
    if (jest && gdzie === -1) lista.push(courtId);
    if (!jest && gdzie !== -1) lista.splice(gdzie, 1);
    return s;
  });
}

/** `undefined` dopóki odpowiedź nie wróci - stan „jeszcze nie wiemy". */
export function useSesja(): Sesja | undefined {
  const [sesja, setSesja] = useState<Sesja | undefined>(undefined);

  useEffect(() => {
    let aktualne = true;
    pobierzSesje().then((s) => {
      if (aktualne) setSesja(s);
    });
    return () => {
      aktualne = false;
    };
  }, []);

  return sesja;
}
