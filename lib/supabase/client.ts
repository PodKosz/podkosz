"use client";

import type { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Klient przeglądarkowy Supabase. Zwraca null, gdy projekt nie jest jeszcze podpięty.
 *
 * Biblioteka wjeżdża przez dynamiczny import, więc nie siedzi w paczce JS wczytywanej
 * przy wejściu na stronę - to 248 kB, których zwykły czytelnik nie potrzebuje, dopóki
 * czegoś nie kliknie (logowanie, podpalenie boiska, ulubione, deklaracja gry).
 * Klienta trzymamy potem w pamięci, więc kolejne wywołania nic już nie ściągają.
 */
export async function supabaseBrowser() {
  if (!supabaseEnabled) return null;
  if (cached) return cached;

  const { createBrowserClient: create } = await import("@supabase/ssr");
  cached ??= create(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
