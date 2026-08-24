import { supabaseServer } from "@/lib/supabase/server";
import {
  htmlPotwierdzenia,
  tekstPotwierdzenia,
  tematPotwierdzenia,
} from "@/lib/mail/potwierdzenie";

/**
 * Zapis na otwarcie serwisu ze strony „Już niedługo" plus krótkie potwierdzenie pocztą.
 *
 * Zapis idzie przez serwer, a nie wprost z przeglądarki, wyłącznie z powodu tego maila:
 * klucz do wysyłki nie ma prawa wyjść na front. Sam wpis i tak pilnuje baza (RLS pozwala
 * na `insert`, ale nie na odczyt listy), więc endpoint nie daje tu żadnej nowej władzy.
 *
 * Endpoint, który wysyła maila na dowolny podany adres, to potencjalna maszynka do
 * zasypywania cudzej skrzynki. Chroni przed tym klucz główny tabeli: list leci TYLKO
 * wtedy, gdy wiersz naprawdę powstał. Powtórzony adres dostaje spokojne „już jesteś
 * na liście" i żadnej wiadomości - a że adres da się zapisać tylko raz, to samo dotyczy
 * listu. Zablokowane adresy IP odsiewa wcześniej middleware.
 */
export const dynamic = "force-dynamic";

const ADRES = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ zapisany: false, powod: "zły format" }, { status: 400 });
  }

  if (!ADRES.test(email) || email.length > 200) {
    return Response.json({ zapisany: false, powod: "adres" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  if (!supabase) {
    return Response.json({ zapisany: false, powod: "brak bazy" }, { status: 500 });
  }

  const { error } = await supabase.from("launch_signups").insert({ email });

  /* powtórka to nie błąd - człowiek ma usłyszeć, że jest na liście */
  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return Response.json({ zapisany: true, nowy: false });
    }
    return Response.json(
      { zapisany: false, powod: /adres e-mail/i.test(error.message) ? "adres" : "baza" },
      { status: 400 }
    );
  }

  /*
    Zapis już jest i to on się liczy. Gdy poczta nie zadziała, nie cofamy wpisu - lepiej
    mieć adres bez potwierdzenia niż stracić zapis przez awarię dostawcy.
  */
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM ?? "PodKosz <onboarding@resend.dev>";
  const odpowiedzi = process.env.FEEDBACK_TO;

  if (!key) return Response.json({ zapisany: true, nowy: true, mail: false });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      ...(odpowiedzi ? { reply_to: odpowiedzi } : {}),
      subject: tematPotwierdzenia(),
      html: htmlPotwierdzenia(),
      text: tekstPotwierdzenia(),
    }),
  });

  return Response.json({ zapisany: true, nowy: true, mail: res.ok });
}
