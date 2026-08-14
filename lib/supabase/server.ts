import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

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
          // W komponentach serwerowych ciasteczek nie da się ustawić — odświeża je middleware.
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
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    name:
      profile?.display_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "gracz",
    avatar:
      profile?.avatar_url ?? ((user.user_metadata?.avatar_url as string | undefined) ?? null),
    isAdmin: profile?.role === "admin",
  };
}
