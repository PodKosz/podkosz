import { adresKlienta } from "@/lib/adres-ip";
import { przepustka, zaDuzo } from "@/lib/limity";
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
  /*
    Adres z `lib/adres-ip` - patrz opis tam. Brany z pierwszej wartości `x-forwarded-for`
    był podrabialny jednym nagłówkiem, a każdy inny adres to nowy wiersz w `visit_days`:
    dało się i zawyżyć licznik wizyt, i hodować tabelę bez końca.
  */
  const ip = adresKlienta(request.headers);
  if (!ip) return Response.json({ ok: true, skipped: "brak adresu" });

  /* wizyta liczy się raz na sesję; dziesięć na minutę to zapas na odświeżanie strony */
  const przepust = przepustka("wizyta", ip, 10, 60);
  if (!przepust.ok) return zaDuzo(przepust.poczekaj);

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: true, skipped: "brak bazy" });

  const { error } = await supabase.rpc("log_visit_ip", { in_ip: ip });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 200 });

  return Response.json({ ok: true });
}
