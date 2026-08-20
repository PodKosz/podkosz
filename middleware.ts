import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { CIASTKO_WEJSCIA, KLUCZ_WEJSCIA, SCIEZKA_ZASLONY, ZASLONA } from "@/lib/zaslona";

/**
 * Adresy działające także pod zasłoną: sama zasłona, powrót z logowania Google, robots.txt
 * (roboty muszą go przeczytać, żeby dostać zakaz indeksowania - podstawiona strona HTML nic
 * by im nie powiedziała) i obrazek podglądu linków, żeby wysłany link wyglądał jak należy.
 */
const ZAWSZE_DOSTEPNE = [SCIEZKA_ZASLONY, "/auth", "/robots.txt", "/opengraph-image"];

/**
 * Odświeża sesję Supabase w ciasteczkach, a przed premierą trzyma zasłonę: wszystko poza
 * stroną „Już niedługo" widzą tylko zalogowani i osoby z przepustką.
 */
export async function middleware(request: NextRequest) {
  const sciezka = request.nextUrl.pathname;

  let response = NextResponse.next({ request });
  let zalogowany = false;
  let klient: ReturnType<typeof createServerClient> | null = null;

  if (supabaseEnabled) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    zalogowany = Boolean(user);
    klient = supabase;
  }

  if (!ZASLONA) return response;

  /* Klucz w adresie zapisuje przepustkę w ciasteczku i wraca na czysty adres. */
  if (request.nextUrl.searchParams.get("wpusc") === KLUCZ_WEJSCIA) {
    const czysty = request.nextUrl.clone();
    czysty.searchParams.delete("wpusc");
    const przekierowanie = NextResponse.redirect(czysty);
    przekierowanie.cookies.set(CIASTKO_WEJSCIA, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return przekierowanie;
  }

  const zPrzepustka = request.cookies.get(CIASTKO_WEJSCIA)?.value === "1";
  const zawszeDostepny = ZAWSZE_DOSTEPNE.some(
    (p) => sciezka === p || sciezka.startsWith(`${p}/`)
  );

  /*
    Zalogowanego pytamy bazy, czy go wpuścić: administrator i adresy z listy beta testerów
    przechodzą, reszta zostaje na zasłonie. Wynik zapisujemy w przepustce na tydzień, żeby
    nie odpytywać bazy przy każdym żądaniu.
  */
  let betaWpuszczony = false;
  if (!zPrzepustka && !zawszeDostepny && zalogowany && klient) {
    const { data } = await klient.rpc("czy_wpuscic");
    betaWpuszczony = data === true;
  }

  const wpuszczony = zPrzepustka || zawszeDostepny || betaWpuszczony;

  if (wpuszczony && betaWpuszczony) {
    response.cookies.set(CIASTKO_WEJSCIA, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (!wpuszczony) {
    /*
      Zasłonę podstawiamy przepisaniem adresu (a nie przekierowaniem), więc w pasku zostaje to,
      co gość wpisał. `X-Robots-Tag` zamyka temat indeksowania nawet bez czytania robots.txt.
    */
    const cel = request.nextUrl.clone();
    cel.pathname = SCIEZKA_ZASLONY;
    cel.search = "";

    const zaslona = NextResponse.rewrite(cel);
    zaslona.headers.set("X-Robots-Tag", "noindex, nofollow");
    return zaslona;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre|geo|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
