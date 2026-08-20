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
