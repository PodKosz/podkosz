import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import {
  PAMIEC_IP_WOLNY,
  PAMIEC_IP_ZBANOWANY,
  PAMIEC_WEJSCIA_NIE,
  PAMIEC_WEJSCIA_TAK,
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
  "/api/obecnosc",
  "/api/utrzymanie",
  /*
    Sesja też, i to nie z wygody: zasłona musi umieć powiedzieć zalogowanemu, że jego
    adresu nie ma na liście testerów. Bez tego wpisu odpowiedź o sesji przechodziła przez
    przepisanie na „Już niedługo", wracała jako HTML i strona uznawała każdego za
    niezalogowanego - więc po zalogowaniu widać było ten sam przycisk co przed nim.
    Trasa oddaje wyłącznie dane właściciela ciasteczka, więc nic tu nie wycieka.
  */
  "/api/sesja",
];

/** Wynik sprawdzenia adresu IP - żeby nie pytać bazy przy każdym żądaniu. */
const pamiecIP = new Map<string, { zbanowany: boolean; do: number }>();

/**
 * Wynik sprawdzenia, czy konto wpuszczamy za zasłonę - po identyfikatorze użytkownika.
 *
 * Tu jest różnica między pamięcią a przepustką: to siedzi w procesie serwera, a nie
 * w ciasteczku, więc nikt tego sobie nie ustawi. Pusta pamięć nie wpuszcza nikogo -
 * oznacza tylko, że trzeba zapytać bazę.
 */
const pamiecWejscia = new Map<string, { wpuszczony: boolean; do: number }>();

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
export async function proxy(request: NextRequest) {
  const sciezka = request.nextUrl.pathname;

  let response = NextResponse.next({ request });
  let idUzytkownika: string | null = null;
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
    idUzytkownika = user?.id ?? null;
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

  const zawszeDostepny = ZAWSZE_DOSTEPNE.some(
    (p) => sciezka === p || sciezka.startsWith(`${p}/`)
  );

  /*
    Jedyna droga za zasłonę: zalogowana sesja, której adres jest na liście beta testerów
    (albo konto administratora). Pyta o to `czy_wpuscic()` w bazie, a wynik trzymamy
    w pamięci procesu po identyfikatorze konta, żeby nie odpytywać bazy przy każdym
    kliknięciu.

    Wcześniej stały tu jeszcze dwie ścieżki - klucz w adresie i ciasteczko z przepustką -
    i obie dawały się obejść bez konta. Powód ich usunięcia opisuje `lib/zaslona.ts`.
  */
  let wpuszczony = zawszeDostepny;

  if (!wpuszczony && idUzytkownika && klient) {
    const znane = pamiecWejscia.get(idUzytkownika);
    if (znane && znane.do > Date.now()) {
      wpuszczony = znane.wpuszczony;
    } else {
      const { data } = await klient.rpc("czy_wpuscic");
      wpuszczony = data === true;
      pamiecWejscia.set(idUzytkownika, {
        wpuszczony,
        do: Date.now() + (wpuszczony ? PAMIEC_WEJSCIA_TAK : PAMIEC_WEJSCIA_NIE),
      });
    }
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
