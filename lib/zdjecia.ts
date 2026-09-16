"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Wgrywanie i kasowanie zdjęć - przez własny Worker, nie przez magazyn Supabase.
 *
 * ------------------------------------------------------------------ dlaczego nie wprost do R2
 *
 * Do R2 nie da się pisać z przeglądarki bez klucza, a klucz w przeglądarce to klucz oddany
 * każdemu. Dlatego pomiędzy stoi Worker: przegląda ścieżkę, pyta bazę o uprawnienia
 * i dopiero wtedy zapisuje. Kubełek dostaje przez powiązanie, więc żaden klucz nie istnieje
 * w ogóle - nie ma czego ukraść. Reguły i uzasadnienia: `worker/zdjecia.js`.
 *
 * ------------------------------------------------------------------ token bywa pusty i to jest OK
 *
 * Boisko wolno dodać BEZ KONTA - tak jest dziś i tak zostaje. Gość nie ma tokenu, a Worker
 * wpuszcza go do katalogu otwartego zgłoszenia na podstawie samego zgłoszenia, nie
 * zalogowania. Dlatego brak tokenu nie jest tu błędem i nie przerywa wysyłki.
 */

const TRASA = "/zdjecia/wgraj";

/** Token sesji, jeśli jest. `null` dla gościa - patrz nota wyżej. */
async function token(): Promise<string | null> {
  const supabase = await supabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function naglowki(t: string | null, rodzaj?: string): HeadersInit {
  const h: Record<string, string> = {};
  if (t) h.authorization = `Bearer ${t}`;
  if (rodzaj) h["content-type"] = rodzaj;
  return h;
}

/**
 * Wgrywa jeden plik pod podaną ścieżkę.
 *
 * Rzuca błędem z powodem od Workera - wołający decyduje, czy to przerywa całą operację.
 * W kreatorze NIE przerywa: jedno zdjęcie mniej nie unieważnia zgłoszenia (patrz `lib/queue.ts`).
 */
export async function wgrajZdjecie(sciezka: string, plik: Blob): Promise<void> {
  const odp = await fetch(`${TRASA}?sciezka=${encodeURIComponent(sciezka)}`, {
    method: "PUT",
    headers: naglowki(await token(), plik.type || "image/jpeg"),
    body: plik,
  });

  if (!odp.ok) {
    const powod = await odp
      .json()
      .then((d: { powod?: string }) => d.powod)
      .catch(() => null);
    throw new Error(powod ?? `Wgrywanie odmówiło (${odp.status})`);
  }
}

/**
 * Kasuje pliki. Wymaga administratora - tak samo, jak wymagał magazyn Supabase.
 *
 * Nie zatrzymuje się na pierwszym niepowodzeniu: przy sprzątaniu sierot po nieudanym
 * zgłoszeniu ważniejsze jest usunąć ile się da niż przerwać w połowie i zostawić bałagan.
 * Zwraca, ile faktycznie zniknęło.
 */
export async function usunZdjecia(sciezki: string[]): Promise<number> {
  if (!sciezki.length) return 0;
  const t = await token();

  const wyniki = await Promise.all(
    sciezki.map((s) =>
      fetch(`${TRASA}?sciezka=${encodeURIComponent(s)}`, {
        method: "DELETE",
        headers: naglowki(t),
      })
        .then((r) => r.ok)
        .catch(() => false)
    )
  );

  return wyniki.filter(Boolean).length;
}
