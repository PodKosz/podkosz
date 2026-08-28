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
  const fwd =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "";
  const ip = fwd.split(",")[0].trim();
  if (!ip) return Response.json({ ok: true, skipped: "brak adresu" });

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: true, skipped: "brak bazy" });

  await supabase.rpc("puls_obecnosci", { in_ip: ip });
  return Response.json({ ok: true });
}
