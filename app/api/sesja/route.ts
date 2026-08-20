import { getSessionUser } from "@/lib/supabase/server";

/**
 * Kto jest zalogowany - na potrzeby paska nawigacji.
 *
 * Pasek dociąga to sobie po wczytaniu strony, bo gdyby dane o użytkowniku wchodziły do HTML
 * z układu strony, żadna podstrona nie mogłaby być cache'owana (odczyt ciasteczek wymusza
 * renderowanie na żądanie). Odpowiedź jest prywatna i nigdy nie trafia do cache.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();

  return Response.json(
    { user: user ? { name: user.name, avatar: user.avatar, isAdmin: user.isAdmin } : null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
