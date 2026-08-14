"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Klient przeglądarkowy. Zwraca null, gdy projekt Supabase nie jest jeszcze podpięty. */
export function supabaseBrowser() {
  if (!supabaseEnabled) return null;
  cached ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
