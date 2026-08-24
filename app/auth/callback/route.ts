import { NextResponse, after, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CIASTKO_PRZEPUSTKI, czyWpuszczony, wyslijPowitanie } from "@/lib/mail/wysylka";

/** Odbiera kod OAuth od Google i zamienia go na sesję w ciasteczkach. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/";
  // tylko ścieżka we własnym serwisie: "//zly.example" też zaczyna się od ukośnika
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (code) {
    const supabase = await supabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(`${origin}/?blad_logowania=${encodeURIComponent(error.message)}`);
      }

      /*
        Mail powitalny idzie stąd, bo to jedyne miejsce, przez które przechodzi każde
        logowanie. `after` odkłada wysyłkę na po odpowiedzi - inaczej człowiek czekałby
        na Resenda, zanim zobaczy stronę. Sama decyzja „czy wysyłać" siedzi w bazie,
        więc powtórne logowania nic nie robią.
      */
      const przepustka = request.cookies.get(CIASTKO_PRZEPUSTKI)?.value === "1";
      after(async () => {
        try {
          const wpuszczony = await czyWpuszczony(supabase, przepustka);
          await wyslijPowitanie(supabase, wpuszczony);
        } catch {
          // logowanie musi się udać nawet wtedy, gdy poczta leży
        }
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
