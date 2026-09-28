import { supabasePublic } from "@/lib/supabase/publiczny";

export const dynamic = "force-dynamic";

/**
 * Wypis z powiadomień o wydarzeniach - bez logowania, na podstawie tokenu z listu.
 *
 * Dwie drogi wejścia i dlatego dwie odpowiedzi:
 *   - POST z klienta pocztowego (nagłówek `List-Unsubscribe-Post`, RFC 8058) - Gmail czy
 *     Apple Mail wołają to same po kliknięciu ich przycisku „Wypisz"; odpowiedź to goły
 *     status, bo nikt jej nie ogląda,
 *   - POST z formularza na `/wypisz` - wtedy wracamy na tę stronę z wynikiem.
 * GET nie wypisuje nigdy, tylko przekierowuje na stronę z przyciskiem: linki w listach
 * odwiedzają też skanery antywirusowe i podglądy, a te wypisywałyby ludzi same.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  return Response.redirect(new URL(`/wypisz?t=${encodeURIComponent(t)}`, request.url), 303);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const t = (url.searchParams.get("t") ?? "").trim();
  const zeStrony = url.searchParams.get("z") === "strona";

  let ok = false;
  if (UUID.test(t)) {
    const supabase = supabasePublic();
    const { data, error } = supabase
      ? await supabase.rpc("wypisz_z_powiadomien", { p_token: t })
      : { data: null, error: true };
    ok = !error && data === true;
  }

  if (zeStrony) {
    return Response.redirect(new URL(`/wypisz?wynik=${ok ? "ok" : "blad"}`, request.url), 303);
  }
  return new Response(ok ? "wypisano" : "nieznany link", { status: ok ? 200 : 404 });
}
