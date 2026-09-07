import { adresKlienta } from "@/lib/adres-ip";
import { przepustka, zaDuzo } from "@/lib/limity";
import { supabasePublic } from "@/lib/supabase/publiczny";

/**
 * Puls obecności - „ja tu wciąż jestem".
 *
 * Osobny endpoint od `/api/wizyta` z rozmysłem: wizyta liczy się raz na sesję i wchodzi
 * do statystyk dziennych, a puls powtarza się co kilkadziesiąt sekund i służy wyłącznie
 * licznikowi „ilu jest teraz". Gdyby to było jedno żądanie, każdy odwiedzający dorzucałby
 * do licznika wizyt kilkadziesiąt wejść na godzinę.
 *
 * Adres IP podajemy funkcji jawnie, bo wołana z serwera baza widziałaby adres naszej
 * funkcji, a nie odwiedzającego. W bazie zapisuje się wyłącznie skrót md5 z solą.
 */
export async function POST(request: Request) {
  const ip = adresKlienta(request.headers);
  if (!ip) return Response.json({ ok: true, skipped: "brak adresu" });

  /* puls idzie co 45 s, więc sześć na minutę to zapas na kilka kart w jednej przeglądarce */
  const przepust = przepustka("obecnosc", ip, 6, 60);
  if (!przepust.ok) return zaDuzo(przepust.poczekaj);

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: true, skipped: "brak bazy" });

  await supabase.rpc("puls_obecnosci", { in_ip: ip });
  return Response.json({ ok: true });
}
