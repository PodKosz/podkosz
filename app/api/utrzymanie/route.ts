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
  /*
    Zamknięte na klucz, a bez klucza zamknięte na głucho.

    Wcześniej warunek brzmiał „jeśli sekret JEST ustawiony, sprawdź go" - czyli dopóki
    `CRON_SECRET` nie był ustawiony (a nie był), sprzątanie archiwum mógł uruchomić
    ktokolwiek, w pętli. Zadanie chodzi po całej bazie, więc to była gotowa dźwignia do
    obciążenia jej cudzym kosztem. Brak konfiguracji nie może otwierać drzwi.
  */
  const sekret = process.env.CRON_SECRET;
  if (!sekret) {
    return Response.json(
      { ok: false, powod: "brak CRON_SECRET - zadanie jest wyłączone" },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${sekret}`) {
    return Response.json({ ok: false, powod: "brak uprawnień" }, { status: 401 });
  }

  const supabase = supabasePublic();
  if (!supabase) return Response.json({ ok: false, powod: "brak bazy" }, { status: 503 });

  const { error } = await supabase.from("courts").select("id").limit(1);

  if (error) return Response.json({ ok: false, powod: error.message }, { status: 502 });
  return Response.json({ ok: true, baza: "odpowiada" });
}
