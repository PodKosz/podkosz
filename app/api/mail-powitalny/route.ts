import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { htmlPowitania, type RodzajPowitania } from "@/lib/mail/powitanie";
import { czyWpuszczony, wyslijPowitanie } from "@/lib/mail/wysylka";

/**
 * Mail powitalny - podgląd i wysyłka na żądanie.
 *
 * Właściwa wysyłka idzie sama, z powrotu z logowania Google (app/auth/callback). Ten
 * endpoint jest po to, żeby dało się zobaczyć oba listy w przeglądarce przed zaproszeniem
 * ludzi do testów, i żeby administrator miał czym dobić wysyłkę, gdyby poczta padła
 * dokładnie w chwili czyjegoś pierwszego logowania.
 *
 *   GET  /api/mail-powitalny?rodzaj=beta&numer=7   - podgląd HTML (tylko administrator)
 *   POST /api/mail-powitalny                       - wyślij powitanie do siebie
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return Response.json({ blad: "tylko administrator" }, { status: 403 });
  }

  const parametry = new URL(request.url).searchParams;
  const rodzaj: RodzajPowitania = parametry.get("rodzaj") === "beta" ? "beta" : "gracz";
  const numer = Number(parametry.get("numer") ?? 7);

  const html = htmlPowitania({
    rodzaj,
    nick: user.name,
    numer: Number.isFinite(numer) && numer > 0 ? numer : 7,
    /* w podglądzie pierwsza setka domyślnie widoczna - to jej akapit trzeba oglądać */
    pionier: parametry.get("pionier") !== "0" && numer <= 100,
  });

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function POST() {
  const supabase = await supabaseServer();
  if (!supabase) return Response.json({ wyslano: false, powod: "brak bazy" }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ wyslano: false, powod: "brak sesji" }, { status: 401 });

  const wynik = await wyslijPowitanie(supabase, await czyWpuszczony(supabase));

  return Response.json(wynik, { status: wynik.wyslano ? 200 : 200 });
}
