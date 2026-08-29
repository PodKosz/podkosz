import { supabasePublic } from "@/lib/supabase/publiczny";

/**
 * Codzienne uderzenie utrzymaniowe - budzik dla bazy.
 *
 * Supabase na darmowym planie ZATRZYMUJE projekt po siedmiu dniach bez zapytań. Zatrzymany
 * projekt to nie jest „wolniejsza strona": przestaje działać logowanie, baza i zdjęcia, a
 * odpalenie z powrotem wymaga wejścia do panelu Supabase i kliknięcia. Dla serwisu przed
 * premierą, gdzie ruchu z definicji nie ma, to nie jest ryzyko teoretyczne - to kwestia
 * jednego spokojnego tygodnia.
 *
 * Wystarczy jedno prawdziwe zapytanie na dobę, dlatego trasa nie robi nic ponadto: czyta
 * jeden wiersz z tabeli boisk. Nie potrzebuje uprawnień administratora ani żadnego sekretu
 * do działania - i celowo nie ma prawa niczego zmienić.
 *
 * Odpalanie: `vercel.json`, sekcja `crons`. Vercel woła to raz dziennie i sam dokłada
 * nagłówek `Authorization: Bearer <CRON_SECRET>`, jeśli taka zmienna jest ustawiona.
 * Sprawdzamy go tylko wtedy, gdy istnieje - bez niej trasa i tak niczego nie ujawnia.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sekret = process.env.CRON_SECRET;
  if (sekret && request.headers.get("authorization") !== `Bearer ${sekret}`) {
    return Response.json({ ok: false, powod: "brak uprawnień" }, { status: 401 });
  }

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: false, powod: "brak bazy" }, { status: 503 });

  const { error } = await supabase.from("courts").select("id").limit(1);

  if (error) return Response.json({ ok: false, powod: error.message }, { status: 502 });
  return Response.json({ ok: true, baza: "odpowiada" });
}
