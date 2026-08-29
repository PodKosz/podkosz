import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { htmlOtwarcia, tekstOtwarcia, tematOtwarcia } from "@/lib/mail/otwarcie";
import { POWOD_BRAK_NADAWCY, nadawca } from "@/lib/mail/nadawca";

/**
 * Rozesłanie wiadomości o otwarciu serwisu do osób zapisanych na stronie „Już niedługo".
 *
 * Wysyłamy porcjami, bo dostawca poczty przyjmuje ograniczoną liczbę wiadomości w jednym
 * żądaniu. O tym, kto dostanie list, decyduje baza: `zapisy_zaklep()` od razu stawia
 * `notified_at` i oddaje adresy, więc dwa uderzenia w ten endpoint nie wyślą nic dwa razy.
 * Gdy poczta odmówi, `zapisy_zwolnij()` oddaje porcję do kolejki.
 *
 *   GET  /api/mail-otwarcie   - podgląd HTML (tylko administrator)
 *   POST /api/mail-otwarcie   - wyślij jedną porcję
 *
 * Odpowiedź mówi, ile poszło i ile zostało, więc panel może wołać endpoint tyle razy,
 * ile trzeba.
 */
export const dynamic = "force-dynamic";

const PORCJA = 90;

export async function GET() {
  const user = await getSessionUser();
  if (!user?.isAdmin) return Response.json({ blad: "tylko administrator" }, { status: 403 });

  return new Response(htmlOtwarcia(), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user?.isAdmin) return Response.json({ blad: "tylko administrator" }, { status: 403 });

  const key = process.env.RESEND_API_KEY;
  const { from, awaryjny } = nadawca();
  const odpowiedzi = process.env.FEEDBACK_TO;

  if (!key) return Response.json({ wyslane: 0, powod: "brak konfiguracji poczty" });
  /* adresem testowym Resend nie da się napisać do obcych - lepiej nie udawać, że poszło */
  if (awaryjny) return Response.json({ wyslane: 0, powod: POWOD_BRAK_NADAWCY });

  const supabase = await supabaseServer();
  if (!supabase) return Response.json({ wyslane: 0, powod: "brak bazy" }, { status: 500 });

  const { data, error } = await supabase.rpc("zapisy_zaklep", { p_ile: PORCJA });
  if (error) return Response.json({ wyslane: 0, powod: error.message }, { status: 400 });

  const adresy = ((data ?? []) as { email: string }[]).map((w) => w.email).filter(Boolean);
  if (!adresy.length) return Response.json({ wyslane: 0, zostalo: 0, powod: "nie ma komu" });

  const html = htmlOtwarcia();
  const text = tekstOtwarcia();
  const subject = tematOtwarcia();

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      adresy.map((adres) => ({
        from,
        to: [adres],
        ...(odpowiedzi ? { reply_to: odpowiedzi } : {}),
        subject,
        html,
        text,
      }))
    ),
  });

  if (!res.ok) {
    await supabase.rpc("zapisy_zwolnij", { p_adresy: adresy });
    return Response.json(
      { wyslane: 0, powod: `poczta odmówiła (${res.status})` },
      { status: 502 }
    );
  }

  /* ile jeszcze czeka - żeby panel wiedział, czy wołać dalej */
  const { count } = await supabase
    .from("launch_signups")
    .select("email", { count: "exact", head: true })
    .is("notified_at", null);

  return Response.json({ wyslane: adresy.length, zostalo: count ?? 0 });
}
