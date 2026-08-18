import { supabaseServer } from "@/lib/supabase/server";

/**
 * Wysyła opinię na maila projektu. Działa tylko wtedy, gdy w środowisku jest klucz
 * do dostawcy poczty — bez niego opinia i tak siedzi w bazie i widać ją w panelu.
 *
 * Wymagane zmienne (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   — klucz z resend.com
 *   FEEDBACK_TO      — adres odbiorcy, np. podkoszpl@gmail.com
 *   FEEDBACK_FROM    — adres nadawcy z domeny potwierdzonej w Resend
 */
export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO;
  const from = process.env.FEEDBACK_FROM ?? "PodKosz <onboarding@resend.dev>";

  if (!key || !to) {
    return Response.json({ sent: false, reason: "brak konfiguracji poczty" }, { status: 200 });
  }

  let message = "";
  let contact = "";
  try {
    const body = (await request.json()) as { message?: string; contact?: string };
    message = (body.message ?? "").trim();
    contact = (body.contact ?? "").trim();
  } catch {
    return Response.json({ sent: false, reason: "zły format" }, { status: 400 });
  }

  if (message.length < 3) {
    return Response.json({ sent: false, reason: "puste zgłoszenie" }, { status: 400 });
  }

  // Opinia musi istnieć w bazie i nie być jeszcze wysłana. Funkcja „zaklepuje” wiersz,
  // więc każde kolejne uderzenie w ten endpoint tą samą treścią dostaje odmowę —
  // inaczej dałoby się zasypać skrzynkę powtarzanym żądaniem.
  const supabase = await supabaseServer();
  if (!supabase) {
    return Response.json({ sent: false, reason: "brak bazy" }, { status: 500 });
  }
  const { data: claimed } = await supabase.rpc("feedback_claim_for_mail", { msg: message });
  if (!claimed) {
    return Response.json(
      { sent: false, reason: "opinia nieznana albo już wysłana" },
      { status: 403 }
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "PodKosz — nowa opinia",
      text: `${message}\n\n---\nKontakt: ${contact || "nie podano"}`,
    }),
  });

  return Response.json({ sent: res.ok }, { status: res.ok ? 200 : 502 });
}
