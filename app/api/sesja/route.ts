import { getUserReactions } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";

/**
 * Wszystko, co zależy od konkretnego użytkownika: kto jest zalogowany, co podpalił i co ma
 * w ulubionych.
 *
 * Strony pytają o to z przeglądarki (patrz `lib/sesja.ts`), bo gdyby te dane wchodziły do HTML
 * na serwerze, żadna podstrona nie mogłaby być cache'owana - odczyt ciasteczek wymusza
 * renderowanie przy każdym wejściu. Odpowiedź jest prywatna i nigdy nie trafia do cache.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const { likes, favorites } = await getUserReactions(user?.id ?? null);

  return Response.json(
    {
      user: user ? { name: user.name, avatar: user.avatar, isAdmin: user.isAdmin } : null,
      likes: [...likes],
      favorites: [...favorites],
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
