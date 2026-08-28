import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import {
  CIASTKO_WEJSCIA,
  KLUCZ_WEJSCIA,
  PAMIEC_IP_WOLNY,
  PAMIEC_IP_ZBANOWANY,
  SCIEZKA_ZASLONY,
  ZASLONA,
} from "@/lib/zaslona";

/**
 * Adresy działające także pod zasłoną: sama zasłona, powrót z logowania Google, robots.txt
 * (roboty muszą go przeczytać, żeby dostać zakaz indeksowania - podstawiona strona HTML nic
 * by im nie powiedziała), obrazek podglądu linków i zapis na otwarcie.
 *
 * Ten ostatni jest tu konieczny, a nie „na wszelki wypadek": formularz zapisu stoi NA
 * zasłonie, więc jego endpoint musi być spod zasłony osiągalny. Bez tego wpisu żądanie
 * trafiało w przepisanie na stronę „Już niedługo", a ta nie przyjmuje POST - formularz
 * dostawał w odpowiedzi HTML z kodem 405 i zapis nie działał w ogóle.
 */
const ZAWSZE_DOSTEPNE = [
  SCIEZKA_ZASLONY,
  "/auth",
  "/robots.txt",
  "/opengraph-image",
  "/api/zapis-na-otwarcie",
];

/** Wynik sprawdzenia adresu IP - żeby nie pytać bazy przy każdym żądaniu. */
const pamiecIP = new Map<string, { zbanowany: boolean; do: number }>();

/** Adres klienta: za Cloudflare i Vercelem prawdziwy adres siedzi w tych nagłówkach. */
function adresKlienta(request: NextRequest): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/** Strona dla zablokowanego adresu - bez nawigacji i bez linków w głąb serwisu. */
function stronaBlokady() {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Dostęp zablokowany - PodKosz</title>
<style>
  html,body{margin:0;height:100%;background:#07070a;color:#f5f5f7;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{min-height:100%;display:grid;place-items:center;padding:24px;text-align:center}
  h1{margin:0 0 12px;font-size:clamp(28px,6vw,44px);letter-spacing:-.02em;
    background:linear-gradient(120deg,#ffc47d,#ff7a18 45%,#ff3d00);
    -webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:6px}
  p{margin:0 auto;max-width:46ch;line-height:1.6;color:rgba(245,245,247,.66);font-size:15px}
</style></head><body><main><div>
<h1>Dostęp zablokowany</h1>
<p>Ten adres IP został zablokowany przez administratora serwisu. Jeśli uważasz, że to pomyłka,
napisz na opinie@podkosz.pl.</p>
</div></main></body></html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * Odświeża sesję Supabase w ciasteczkach, odsiewa zablokowane adresy IP, a przed premierą
 * trzyma zasłonę: wszystko poza stroną „Już niedługo" widzą tylko zalogowani i osoby
 * z przepustką.
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

  /*
    Blokady IP to druga warstwa obok blokady konta: zgłoszenia, opinie i raporty można
    wysyłać bez logowania, więc samo zablokowanie konta nie zawsze wystarcza. Wynik
    trzymamy w pamięci procesu, żeby nie pytać bazy przy każdym żądaniu.
  */
  const ip = adresKlienta(request);
  if (ip && klient) {
    const znane = pamiecIP.get(ip);
    if (znane && znane.do > Date.now()) {
      if (znane.zbanowany) return stronaBlokady();
    } else {
      const { data } = await klient.rpc("czy_ip_zbanowane", { p_ip: ip });
      const zbanowany = data === true;
      pamiecIP.set(ip, {
        zbanowany,
        do: Date.now() + (zbanowany ? PAMIEC_IP_ZBANOWANY : PAMIEC_IP_WOLNY),
      });
      if (zbanowany) return stronaBlokady();
    }
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
