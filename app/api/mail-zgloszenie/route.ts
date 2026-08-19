import { supabaseServer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

/**
 * Powiadamia autora zgłoszenia o decyzji: boisko opublikowane albo odrzucone z powodem.
 *
 * Do tej pory nikt nie dowiadywał się, co się stało z jego zgłoszeniem - adres autora
 * leżał w bazie nieużywany. Mail o publikacji jest zarazem powodem do powrotu na stronę.
 *
 * Wymagane zmienne środowiskowe (te same, co przy opiniach):
 *   RESEND_API_KEY - klucz z resend.com
 *   FEEDBACK_FROM  - adres nadawcy z domeny potwierdzonej w Resend
 *
 * Bez klucza endpoint odpowiada spokojnie „nie wysłano" - moderacja działa dalej.
 */
export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM ?? "PodKosz <onboarding@resend.dev>";

  let body: {
    submissionId?: string;
    decision?: "approved" | "rejected";
    reason?: string;
    courtName?: string;
    courtSlug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ sent: false, reason: "zły format" }, { status: 400 });
  }

  const { submissionId, decision } = body;
  if (!submissionId || (decision !== "approved" && decision !== "rejected")) {
    return Response.json({ sent: false, reason: "brak danych" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  if (!supabase) return Response.json({ sent: false, reason: "brak bazy" }, { status: 500 });

  // Funkcja sprawdza uprawnienia administratora i „zaklepuje" zgłoszenie: adres wraca
  // dokładnie raz, więc ta sama decyzja nie poleci pocztą dwa razy.
  const { data: adres, error } = await supabase.rpc("submission_claim_for_mail", {
    sub: submissionId,
  });

  if (error) {
    return Response.json({ sent: false, reason: error.message }, { status: 403 });
  }
  if (!adres) {
    return Response.json(
      { sent: false, reason: "brak adresu autora albo mail już poszedł" },
      { status: 200 }
    );
  }
  if (!key) {
    return Response.json({ sent: false, reason: "brak konfiguracji poczty" }, { status: 200 });
  }

  const nazwa = body.courtName?.trim() || "Twoje boisko";
  const link = body.courtSlug ? `${SITE_URL}/boisko/${body.courtSlug}` : SITE_URL;

  const [subject, text] =
    decision === "approved"
      ? [
          `${nazwa} jest już na mapie PodKosza`,
          `Dzięki! Boisko, które zgłosiłeś, przeszło sprawdzenie i jest już widoczne dla wszystkich:\n${link}\n\n` +
            `Jeśli zauważysz coś do poprawy, napisz - zaktualizujemy wpis.\n\n` +
            `Znasz kolejne boisko bez wpisu? ${SITE_URL}/dodaj\n\n---\nPodKosz`,
        ]
      : [
          `Zgłoszenie boiska nie zostało opublikowane`,
          `Dziękujemy za zgłoszenie, ale tym razem nie trafiło ono na mapę.\n\n` +
            `Powód: ${body.reason?.trim() || "brak szczegółów"}\n\n` +
            `Jeśli uważasz, że to pomyłka, odpisz na tę wiadomość.\n` +
            `Możesz też zgłosić boisko ponownie z poprawionymi zdjęciami: ${SITE_URL}/dodaj\n\n---\nPodKosz`,
        ];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [adres], subject, text }),
  });

  return Response.json({ sent: res.ok }, { status: res.ok ? 200 : 502 });
}
