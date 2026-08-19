import { supabasePublic } from "@/lib/supabase/publiczny";

/**
 * Odnotowuje jedną wizytę do statystyk w panelu.
 *
 * Wcześniej robiła to przeglądarka, przez klienta Supabase - a to znaczyło, że KAŻDY
 * odwiedzający musiał pobrać bibliotekę Supabase (248 kB), nawet jeśli tylko czytał.
 * Teraz wystarczy jedno lekkie żądanie, a rozmowę z bazą prowadzi serwer.
 *
 * Adres IP wysyłamy do funkcji jawnie, bo wołana z serwera baza widziałaby adres
 * naszej funkcji, nie użytkownika. W bazie i tak zapisuje się wyłącznie skrót (md5
 * z solą) - czytelnego IP nie ma nigdzie.
 */
export async function POST(request: Request) {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim();
  if (!ip) return Response.json({ ok: true, skipped: "brak adresu" });

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: true, skipped: "brak bazy" });

  const { error } = await supabase.rpc("log_visit_ip", { in_ip: ip });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 200 });

  return Response.json({ ok: true });
}
