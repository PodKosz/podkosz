import { POWOD_BRAK_NADAWCY, nadawca } from "./nadawca";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZASLONA, CIASTKO_WEJSCIA } from "@/lib/zaslona";
import {
  htmlPowitania,
  tekstPowitania,
  tematPowitania,
  type DanePowitania,
  type RodzajPowitania,
} from "./powitanie";

/**
 * Wysyłka maila powitalnego - jeden strzał na konto, przy pierwszym wejściu na stronę.
 *
 * O tym, czy mail ma pójść, decyduje baza (`powitanie_zaklep()`): wstawia wiersz do
 * `welcome_mails` i tylko wtedy oddaje adres. Dzięki temu kolejne logowania - a jest ich
 * dużo, bo sesja wygasa - nie wysyłają niczego drugi raz.
 *
 * Zmienne środowiskowe (te same, co przy opiniach i decyzjach o zgłoszeniach):
 *   RESEND_API_KEY - klucz z resend.com
 *   FEEDBACK_FROM  - nadawca z domeny potwierdzonej w Resend
 *   FEEDBACK_TO    - adres, na który mają wracać odpowiedzi (opcjonalny)
 *
 * Bez klucza funkcja nie rusza bazy: gdyby zaklepała powitanie i dopiero potem odkryła,
 * że nie ma czym wysłać, konto straciłoby mail na zawsze.
 */

export interface WynikWysylki {
  wyslano: boolean;
  powod?: string;
}

interface WierszZaklepania {
  adres: string;
  nick: string | null;
  rodzaj: string;
  numer: number;
  pionier: boolean;
}

/**
 * Czy ta osoba faktycznie weszła na stronę.
 *
 * Za zasłoną samo zalogowanie nic nie znaczy: konto zakłada trigger na `auth.users`, ale
 * kto nie jest na liście beta testerów, wraca na „Już niedługo". Takiej osobie powitanie
 * byłoby nie na miejscu - wita się kogoś, kto wszedł.
 */
export async function czyWpuszczony(
  supabase: SupabaseClient,
  przepustka: boolean
): Promise<boolean> {
  if (!ZASLONA || przepustka) return true;

  const { data } = await supabase.rpc("czy_wpuscic");
  return data === true;
}

/** Nazwa ciasteczka z przepustką - żeby wołający nie musiał znać lib/zaslona.ts. */
export const CIASTKO_PRZEPUSTKI = CIASTKO_WEJSCIA;

export async function wyslijPowitanie(
  supabase: SupabaseClient,
  wpuszczony: boolean
): Promise<WynikWysylki> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { wyslano: false, powod: "brak konfiguracji poczty" };

  const { from, awaryjny } = nadawca();
  /* adresem testowym Resend nie da się napisać do obcych - lepiej nie udawać, że poszło */
  if (awaryjny) return { wyslano: false, powod: POWOD_BRAK_NADAWCY };
  const odpowiedzi = process.env.FEEDBACK_TO;

  const { data, error } = await supabase.rpc("powitanie_zaklep", {
    p_wpuszczony: wpuszczony,
  });

  if (error) return { wyslano: false, powod: error.message };

  const wiersz = (Array.isArray(data) ? data[0] : data) as WierszZaklepania | undefined;
  if (!wiersz?.adres) return { wyslano: false, powod: "powitanie już poszło albo brak adresu" };

  const dane: DanePowitania = {
    rodzaj: (wiersz.rodzaj === "beta" ? "beta" : "gracz") as RodzajPowitania,
    nick: wiersz.nick,
    numer: wiersz.numer,
    pionier: Boolean(wiersz.pionier),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [wiersz.adres],
      ...(odpowiedzi ? { reply_to: odpowiedzi } : {}),
      subject: tematPowitania(dane),
      html: htmlPowitania(dane),
      text: tekstPowitania(dane),
    }),
  });

  if (!res.ok) {
    /*
      Zaklepanie zdejmujemy, żeby jedna awaria dostawcy nie skasowała powitania na zawsze -
      przy następnym wejściu próba pójdzie jeszcze raz.
    */
    await supabase.rpc("powitanie_zwolnij");
    return { wyslano: false, powod: `poczta odmówiła (${res.status})` };
  }

  return { wyslano: true, powod: dane.rodzaj };
}
