import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { CIASTKO_WEJSCIA, KLUCZ_WEJSCIA, SCIEZKA_ZASLONY, ZASLONA } from "@/lib/zaslona";

/**
 * Adresy działające także pod zasłoną: sama zasłona, powrót z logowania Google i robots.txt
 * (roboty muszą go przeczytać, żeby dostać zakaz indeksowania - podstawiona strona HTML
 * zamiast pliku nic by im nie powiedziała).
 */
const ZAWSZE_DOSTEPNE = [SCIEZKA_ZASLONY, "/auth", "/robots.txt"];

/**
 * Odświeża sesję Supabase w ciasteczkach, a przed premierą trzyma zasłonę: wszystko poza
 * stroną „Już niedługo" widzą tylko zalogowani i osoby z przepustką.
 */
export async function middleware(request: NextRequest) {
  const sciezka = request.nextUrl.pathname;

  /*
    Ścieżkę przekazujemy dalej nagłówkiem, bo układ strony (komponent serwerowy) nie ma do niej
    dostępu, a musi wiedzieć, kiedy pominąć nawigację i stopkę. Snapshot bierzemy za każdym
    razem od nowa, żeby zabrać też ciasteczka odświeżone przez Supabase.
  */
  const zNaglowkiem = (docelowa: string) => {
    const naglowki = new Headers(request.headers);
    naglowki.set("x-sciezka", docelowa);
    return naglowki;
  };

  let response = NextResponse.next({ request: { headers: zNaglowkiem(sciezka) } });
  let zalogowany = false;

  if (supabaseEnabled) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: zNaglowkiem(sciezka) } });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    zalogowany = Boolean(user);
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

  const wpuszczony =
    zalogowany ||
    request.cookies.get(CIASTKO_WEJSCIA)?.value === "1" ||
    ZAWSZE_DOSTEPNE.some((p) => sciezka === p || sciezka.startsWith(`${p}/`));

  if (!wpuszczony) {
    /*
      Zasłonę podstawiamy przepisaniem adresu (a nie przekierowaniem), więc w pasku zostaje to,
      co gość wpisał. `X-Robots-Tag` zamyka temat indeksowania nawet bez czytania robots.txt.
    */
    const cel = request.nextUrl.clone();
    cel.pathname = SCIEZKA_ZASLONY;
    cel.search = "";

    const zaslona = NextResponse.rewrite(cel, {
      request: { headers: zNaglowkiem(SCIEZKA_ZASLONY) },
    });
    zaslona.headers.set("X-Robots-Tag", "noindex, nofollow");
    return zaslona;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre|geo|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
