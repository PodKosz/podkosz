import { getUserReactions } from "@/lib/repo";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { tozsamosc } from "@/lib/supabase/tozsamosc";

/**
 * Wszystko, co zależy od konkretnego użytkownika: kto jest zalogowany, co podpalił i co ma
 * w ulubionych.
 *
 * Strony pytają o to z przeglądarki (patrz `lib/sesja.ts`), bo gdyby te dane wchodziły do HTML
 * na serwerze, żadna podstrona nie mogłaby być cache'owana - odczyt ciasteczek wymusza
 * renderowanie przy każdym wejściu. Odpowiedź jest prywatna i nigdy nie trafia do cache.
 *
 * ------------------------------------------------------------------ ile to kosztuje
 *
 * To jest najczęściej wołana trasa w całym serwisie: raz na każde wejście na każdą stronę,
 * od każdego. Dlatego liczy się tu każda podróż po sieci, a były trzy: pytanie do serwera
 * Auth o użytkownika, potem `profiles`, potem `likes` i `favorites`.
 *
 * Teraz jest jedna. Tożsamość bierze się ze sprawdzonego na miejscu podpisu tokenu
 * (`lib/supabase/tozsamosc.ts`), a wszystkie trzy odczyty składa jedna funkcja w bazie
 * (`sesja_uzytkownika`, migracja `migration-sesja-jednym-zapytaniem.sql`).
 */
export const dynamic = "force-dynamic";

interface WierszSesji {
  nick: string | null;
  avatar: string | null;
  admin: boolean;
  zbanowany: boolean;
  podpalenia: string[] | null;
  ulubione: string[] | null;
}

export async function GET() {
  const supabase = await supabaseServer();

  if (supabase) {
    const kto = await tozsamosc(supabase);
    if (!kto) return odpowiedz(null, [], []);

    const { data, error } = await supabase.rpc("sesja_uzytkownika");

    if (!error && data) {
      const w = data as WierszSesji;
      return odpowiedz(
        {
          name: w.nick ?? kto.nazwaZTokenu ?? kto.email?.split("@")[0] ?? "gracz",
          avatar: w.avatar ?? kto.avatarZTokenu,
          isAdmin: w.admin,
          isBanned: w.zbanowany,
        },
        w.podpalenia ?? [],
        w.ulubione ?? []
      );
    }
  }

  /*
    ZAPAS NA CZAS PRZED MIGRACJĄ.

    Kod bywa wdrożony wcześniej niż uruchomiona migracja, a ta trasa decyduje o tym, czy
    człowiek widzi się jako zalogowany. Bez tego zapasu okno między jednym i drugim
    znaczyłoby dla KAŻDEGO zalogowanego: pasek bez konta, puste ulubione, zniknięte
    podpalenia - czyli objaw wyglądający jak zepsute logowanie.

    Do usunięcia, gdy funkcja stoi na produkcji.
  */
  const user = await getSessionUser();
  const { likes, favorites } = await getUserReactions(user?.id ?? null);

  return odpowiedz(
    user
      ? { name: user.name, avatar: user.avatar, isAdmin: user.isAdmin, isBanned: user.isBanned }
      : null,
    [...likes],
    [...favorites]
  );
}

function odpowiedz(
  user: { name: string; avatar: string | null; isAdmin: boolean; isBanned: boolean } | null,
  likes: string[],
  favorites: string[]
) {
  return Response.json(
    { user, likes, favorites },
    { headers: { "cache-control": "private, no-store" } }
  );
}
