import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";
import { tozsamosc } from "./tozsamosc";

/** Klient serwerowy (RSC / route handlery). Null, gdy projekt nie jest podpięty. */
export async function supabaseServer() {
  if (!supabaseEnabled) return null;
  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // W komponentach serwerowych ciasteczek nie da się ustawić - odświeża je proxy.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string;
  avatar: string | null;
  isAdmin: boolean;
  /** konto zablokowane przez administratora - nie może nic zapisywać */
  isBanned: boolean;
}

/**
 * Kto jest zalogowany - jedno zapytanie do bazy, zero podróży do serwera Auth.
 *
 * Tożsamość bierze się ze sprawdzonego na miejscu podpisu tokenu (`lib/supabase/tozsamosc.ts`),
 * a wszystko, co może się zmienić po wystawieniu tokenu - nazwa, avatar, rola, blokada -
 * z tabeli `profiles`. Ten podział jest tu istotny: token nie mówi, czy konto nie zostało
 * w tej minucie zablokowane, a `profiles` mówi, i czytamy je i tak.
 *
 * Nazwa i avatar mają jeszcze zapas z tokenu (`user_metadata` od Google), bo profil
 * powstaje wyzwalaczem po pierwszym zalogowaniu i przez chwilę może go nie być.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;

  const kto = await tozsamosc(supabase);
  if (!kto) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role, banned_at")
    .eq("id", kto.id)
    .maybeSingle();

  return {
    id: kto.id,
    email: kto.email,
    name: profile?.display_name ?? kto.nazwaZTokenu ?? kto.email?.split("@")[0] ?? "gracz",
    avatar: profile?.avatar_url ?? kto.avatarZTokenu,
    isAdmin: profile?.role === "admin",
    isBanned: Boolean(profile?.banned_at),
  };
}
