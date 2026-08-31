import { POWOD_BRAK_NADAWCY, nadawca } from "@/lib/mail/nadawca";
import {
  htmlOdmowy,
  htmlPublikacji,
  tekstOdmowy,
  tekstPublikacji,
  tematOdmowy,
  tematPublikacji,
} from "@/lib/mail/zgloszenie";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Powiadamia autora zgłoszenia o decyzji: boisko opublikowane albo odrzucone z powodem.
 *
 * Adres autora bierze się z `submissions.author_email`, a ten wypełnia się w dwóch
 * przypadkach - kiedy ktoś dodaje boisko z konta (adres konta) i kiedy gość wpisze go
 * ręcznie w kreatorze. Kto nie zostawił adresu, nie dostanie listu i nie ma na to
 * sposobu; wysyłka po prostu nie startuje.
 *
 * Wymagane zmienne środowiskowe (te same, co przy opiniach):
 *   RESEND_API_KEY - klucz z resend.com
 *   FEEDBACK_FROM  - adres nadawcy z domeny potwierdzonej w Resend
 *
 * Bez klucza endpoint odpowiada spokojnie „nie wysłano" - moderacja działa dalej.
 */
export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  const { from, awaryjny } = nadawca();
  /* adresem testowym Resend nie da się napisać do obcych - lepiej nie udawać, że poszło */
  if (awaryjny) return Response.json({ sent: false, reason: POWOD_BRAK_NADAWCY });

  let body: {
    submissionId?: string;
    decision?: "approved" | "rejected";
    reason?: string;
    courtName?: string;
    /** identyfikator opublikowanego boiska - z niego bierzemy adres karty i miasto */
    courtId?: string;
    courtCity?: string;
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
  let miasto = body.courtCity?.trim() || null;
  let slug: string | null = null;

  /*
    Adres karty czytamy z bazy, a nie z ciała żądania, bo wcześniej nikt go tam nie wkładał:
    `approve_submission()` układa go z miasta i nazwy dopiero przy publikacji, więc panel go
    nie znał i list prowadził na stronę główną. Zamiast pisać „Twoje boisko jest na mapie"
    i odsyłać człowieka do samodzielnego szukania, pytamy o `courts` po identyfikatorze,
    który ta funkcja zwraca.
  */
  if (decision === "approved" && body.courtId) {
    const { data: boisko } = await supabase
      .from("courts")
      .select("slug, city")
      .eq("id", body.courtId)
      .maybeSingle();

    if (boisko) {
      slug = boisko.slug;
      miasto = miasto ?? boisko.city;
    }
  }

  const [subject, html, text] =
    decision === "approved"
      ? [
          tematPublikacji({ nazwa, miasto, slug }),
          htmlPublikacji({ nazwa, miasto, slug }),
          tekstPublikacji({ nazwa, miasto, slug }),
        ]
      : [
          tematOdmowy(),
          htmlOdmowy({ nazwa, miasto, powod: body.reason }),
          tekstOdmowy({ nazwa, miasto, powod: body.reason }),
        ];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [adres], subject, html, text }),
  });

  return Response.json({ sent: res.ok }, { status: res.ok ? 200 : 502 });
}
