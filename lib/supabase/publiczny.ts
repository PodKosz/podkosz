import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

/**
 * Klient do danych publicznych: boiska, zdjęcia, rankingi. Nie zagląda do ciasteczek,
 * więc jego wyniki wolno trzymać w pamięci podręcznej między żądaniami - w przeciwieństwie
 * do `supabaseServer()`, który czyta sesję użytkownika i musi działać na świeżo.
 *
 * Wszystko, co przez niego czytamy, jest i tak widoczne publicznie (RLS pilnuje reszty).
 */
export function supabasePublic() {
  if (!supabaseEnabled) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
