import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { POWOD_BRAK_NADAWCY, nadawca } from "@/lib/mail/nadawca";
import { htmlWydarzenia, tekstWydarzenia, tematWydarzenia } from "@/lib/mail/wydarzenie";
import { kiedy, type Wydarzenie } from "@/lib/wydarzenia";

/**
 * Wysyłka zaproszeń na wydarzenie.
 *
 * Idzie do tych, którzy dali ogień temu boisku albo boisku w okolicy, i do tych, którzy
 * deklarowali tu grę w ostatnim kwartale - listę składa baza (`wydarzenie_odbiorcy`),
 * bo adresy leżą w `auth.users`, do której front nie ma i nie może mieć wglądu.
 *
 * ------------------------------------------------------------------ trzy bezpieczniki
 *
 * 1. TYLKO ADMINISTRATOR - sprawdzane tutaj i drugi raz w obu funkcjach bazy.
 * 2. JEDEN LIST NA WYDARZENIE - `wydarzenie_zaklep_wysylke` przestawia znacznik tylko
 *    przy pierwszym wywołaniu, więc dwa kliknięcia albo powtórzone żądanie nie wyślą
 *    dwóch wysyłek. Zaklepujemy PRZED wysyłką, nie po: przy odwrotnej kolejności awaria
 *    w połowie wysyłki mogłaby doprowadzić do drugiej próby i do dwóch listów u tych
 *    samych ludzi. Lepiej stracić wysyłkę niż zasypać komuś skrzynkę.
 * 3. SUFIT - najwyżej `MAKS_ODBIORCOW` adresów na wydarzenie. Nie po to, żeby chronić
 *    użytkowników, ale konto pocztowe: przy większej liczbie to już wysyłka masowa
 *    i chcę o tym wiedzieć, zanim się stanie.
 */
export const dynamic = "force-dynamic";

/** Ile listów naraz przyjmuje Resend w jednym żądaniu. */
const PORCJA = 90;
const MAKS_ODBIORCOW = 500;

interface Odbiorca {
  email: string;
  nick: string;
  powod: "to-boisko" | "okolica";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return Response.json({ blad: "tylko administrator" }, { status: 403 });
  }

  let id = "";
  try {
    const body = (await request.json()) as { id?: string };
    id = (body.id ?? "").trim();
  } catch {
    return Response.json({ blad: "zły format" }, { status: 400 });
  }
  if (!id) return Response.json({ blad: "brak identyfikatora wydarzenia" }, { status: 400 });

  const supabase = await supabaseServer();
  if (!supabase) return Response.json({ blad: "brak bazy" }, { status: 500 });

  /* ---------------------------------------------------------------- wydarzenie */
  const { data: wiersz, error: bladWydarzenia } = await supabase
    .from("wydarzenia")
    .select("id, court_id, nazwa, opis, poczatek, koniec, zdjecie, powiadomiono_at, courts(name, city, slug)")
    .eq("id", id)
    .maybeSingle();

  if (bladWydarzenia) return Response.json({ blad: bladWydarzenia.message }, { status: 400 });
  if (!wiersz) return Response.json({ blad: "nie ma takiego wydarzenia" }, { status: 404 });

  const w = wiersz as unknown as {
    id: string;
    court_id: string;
    nazwa: string;
    opis: string | null;
    poczatek: string;
    koniec: string;
    powiadomiono_at: string | null;
    courts: { name: string; city: string; slug: string } | null;
  };

  if (w.powiadomiono_at) {
    return Response.json(
      { wyslane: 0, powod: "powiadomienia dla tego wydarzenia już poszły" },
      { status: 409 }
    );
  }
  if (!w.courts) return Response.json({ blad: "wydarzenie bez boiska" }, { status: 400 });

  /* ---------------------------------------------------------------- odbiorcy */
  const { data: lista, error: bladListy } = await supabase.rpc("wydarzenie_odbiorcy", {
    p_id: id,
  });
  if (bladListy) return Response.json({ blad: bladListy.message }, { status: 400 });

  const odbiorcy = ((lista ?? []) as Odbiorca[]).filter((o) => o.email).slice(0, MAKS_ODBIORCOW);

  if (odbiorcy.length === 0) {
    /* nie ma komu - i tak zaklepujemy, żeby przycisk przestał się prosić o kliknięcie */
    await supabase.rpc("wydarzenie_zaklep_wysylke", { p_id: id, p_ile: 0 });
    return Response.json({ wyslane: 0, powod: "nikt jeszcze nie podpalił tego boiska ani okolicy" });
  }

  /* ---------------------------------------------------------------- poczta */
  const key = process.env.RESEND_API_KEY;
  const { from, awaryjny } = nadawca();
  if (!key) return Response.json({ wyslane: 0, powod: "brak konfiguracji poczty" });
  if (awaryjny) return Response.json({ wyslane: 0, powod: POWOD_BRAK_NADAWCY });

  /* zaklepanie PRZED wysyłką - patrz opis na górze pliku */
  const { data: zaklepane } = await supabase.rpc("wydarzenie_zaklep_wysylke", {
    p_id: id,
    p_ile: odbiorcy.length,
  });
  if (zaklepane !== true) {
    return Response.json(
      { wyslane: 0, powod: "ktoś właśnie wysłał te powiadomienia" },
      { status: 409 }
    );
  }

  const doOpisuCzasu: Wydarzenie = {
    id: w.id,
    courtId: w.court_id,
    nazwa: w.nazwa,
    opis: w.opis ?? "",
    poczatek: w.poczatek,
    koniec: w.koniec,
    zdjecie: null,
    proporcje: null,
  };

  const wspolne = {
    nazwa: w.nazwa,
    opis: w.opis ?? "",
    kiedy: kiedy(doOpisuCzasu),
    boisko: w.courts.name,
    miasto: w.courts.city,
    slug: w.courts.slug,
  };

  const subject = tematWydarzenia({ nazwa: w.nazwa, boisko: w.courts.name });

  let wyslane = 0;
  const bledy: string[] = [];

  for (let i = 0; i < odbiorcy.length; i += PORCJA) {
    const paczka = odbiorcy.slice(i, i + PORCJA);

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        paczka.map((o) => {
          const dane = { ...wspolne, powod: o.powod, nick: o.nick };
          return {
            from,
            to: [o.email],
            subject,
            html: htmlWydarzenia(dane),
            text: tekstWydarzenia(dane),
          };
        })
      ),
    });

    if (res.ok) wyslane += paczka.length;
    else bledy.push(`porcja ${i / PORCJA + 1}: poczta odmówiła (${res.status})`);
  }

  return Response.json({
    wyslane,
    odbiorcow: odbiorcy.length,
    ...(bledy.length ? { powod: bledy.join("; ") } : {}),
  });
}
