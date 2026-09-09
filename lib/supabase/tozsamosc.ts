import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Kto to jest - bez pytania serwera Auth przy każdym żądaniu.
 *
 * ------------------------------------------------------------------ co było nie tak
 *
 * `auth.getUser()` nie czyta ciasteczka. Wysyła żądanie do `/auth/v1/user` w Supabase
 * i czeka na odpowiedź. Do tej pory robiliśmy to trzy razy na jedno wejście na stronę:
 *
 *   1. w `proxy.ts`, na KAŻDYM żądaniu, które nie jest plikiem statycznym - łącznie
 *      z pobieraniami z wyprzedzeniem, które Next odpala przy najechaniu na każdy link,
 *   2. drugi raz w tym samym proxy, bo `/api/sesja` też przez nie przechodzi,
 *   3. trzeci raz w samym `/api/sesja`, w `getSessionUser`.
 *
 * Zalogowany człowiek klikający po mapie robił z tego kilkanaście podróży po sieci na
 * minutę. Kontener Auth jest najmniejszą częścią projektu i to on wysiada pierwszy.
 *
 * ------------------------------------------------------------------ co robimy zamiast
 *
 * Token dostępu to podpisany JWT. Podpis da się sprawdzić NA MIEJSCU, mając klucz
 * publiczny projektu - i dokładnie to robi `auth.getClaims()`. Klucze leżą pod
 * `/auth/v1/.well-known/jwks.json`; ten projekt podpisuje tokeny algorytmem ES256
 * (sprawdzone), więc weryfikacja idzie przez WebCrypto, bez ani jednego żądania.
 *
 * Klucze trzymamy W MODULE, nie w kliencie. To nie jest mikrooptymalizacja: proxy tworzy
 * nowego klienta Supabase na każde żądanie, a `getClaims` pamięta klucze w kliencie -
 * więc bez tej pamięci każde żądanie ściągałoby zestaw kluczy i zamienilibyśmy jedną
 * podróż po sieci na inną.
 *
 * ------------------------------------------------------------------ czym to płacimy
 *
 * Podpis mówi „ten token wystawił nasz Auth i nikt go nie ruszył". Nie mówi „ta sesja
 * jest wciąż aktywna". Token wylogowany albo odebrany zostaje poprawny do końca swojej
 * ważności (domyślnie godzina). Dla tych dwóch miejsc to bez znaczenia:
 *
 *   - proxy używa identyfikatora tylko do sprawdzenia, czy konto jest na liście testerów;
 *   - `getSessionUser` i tak czyta `profiles` przy każdym wywołaniu, więc blokada konta
 *     (`banned_at`) i odebranie praw administratora działają natychmiast;
 *   - każdy zapis do bazy przechodzi przez polityki RLS, a te sprawdza Postgres na
 *     podstawie tego samego tokenu - jeśli baza go odrzuci, żadna weryfikacja tutaj
 *     tego nie zmieni.
 *
 * Gdyby kiedyś potrzebna była pewność „sesja żyje w tej sekundzie", jest do tego
 * `getUser()` - i wtedy warto go zawołać w tym jednym miejscu, a nie na każdym żądaniu.
 */

/**
 * Zestaw kluczy w postaci, jakiej oczekuje `getClaims`.
 *
 * Typ wyciągamy z podpisu samej metody, zamiast przepisywać kształt JWK z biblioteki -
 * przepisany rozjechałby się przy pierwszej zmianie w Supabase, a rozjazd typu, który
 * służy tylko do przekazania danych dalej, nie dałby o sobie znać niczym poza błędem
 * kompilacji w losowym miejscu.
 */
type Zestaw = NonNullable<
  NonNullable<Parameters<SupabaseClient["auth"]["getClaims"]>[1]>["jwks"]
>;

/**
 * Jak długo trzymamy klucze podpisu.
 *
 * Klucze zmieniają się przy obrocie kluczy w panelu Supabase, czyli raz na nigdy. Dziesięć
 * minut to kompromis: gdyby doszło do obrotu, najstarsza instancja dogoni go po dziesięciu
 * minutach, a do tego czasu `getClaims` po prostu nie znajdzie klucza o danym `kid`
 * i sam pobierze świeży zestaw. Awarii nie ma - jest jedno żądanie więcej.
 */
const KLUCZE_TTL_MS = 10 * 60_000;

let klucze: Zestaw | null = null;
let kluczeDo = 0;
/* jedno pobranie na instancję, nawet gdy dwadzieścia żądań trafi tu jednocześnie */
let wLocie: Promise<Zestaw | null> | null = null;

async function kluczePodpisu(): Promise<Zestaw | null> {
  if (klucze && kluczeDo > Date.now()) return klucze;
  if (wLocie) return wLocie;

  wLocie = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
        headers: { apikey: SUPABASE_ANON_KEY },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const dane = (await res.json()) as Partial<Zestaw>;
      if (!Array.isArray(dane.keys) || !dane.keys.length) return null;

      klucze = { keys: dane.keys };
      kluczeDo = Date.now() + KLUCZE_TTL_MS;
      return klucze;
    } catch {
      /* brak kluczy nie jest awarią - `getClaims` pobierze je sam, tylko drożej */
      return null;
    } finally {
      wLocie = null;
    }
  })();

  return wLocie;
}

/** Nazwa ciasteczka sesji Supabase - `sb-<ref>-auth-token`, czasem pocięta na części. */
const CIASTECZKO_SESJI = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Czy w żądaniu jest w ogóle ciasteczko sesji.
 *
 * Bez niego nie ma czego weryfikować i nie ma po co wołać niczego z klienta Auth.
 * Anonimowy ruch to większość ruchu, więc ten warunek zdejmuje najwięcej pracy - i robi
 * to zanim cokolwiek zostanie policzone.
 */
export function maCiasteczkoSesji(ciasteczka: { name: string }[]) {
  return ciasteczka.some((c) => CIASTECZKO_SESJI.test(c.name));
}

export interface Tozsamosc {
  id: string;
  email: string | null;
  /**
   * Nazwa i avatar wpisane w token przez dostawcę logowania (Google).
   *
   * Zapas na tę jedną chwilę, w której konto już istnieje, a wiersza w `profiles` jeszcze
   * nie ma - profil zakłada wyzwalacz po pierwszym zalogowaniu. Bez tego zapasu człowiek
   * widziałby wtedy w pasku „gracz" zamiast swojego imienia.
   */
  nazwaZTokenu: string | null;
  avatarZTokenu: string | null;
}

/**
 * Tożsamość z tokenu w ciasteczkach - albo null, gdy tokenu nie ma lub jest nieważny.
 *
 * Zwraca wyłącznie to, co stoi w podpisanym tokenie. Nazwa, avatar i rola idą z tabeli
 * `profiles`, bo tylko tam są aktualne (patrz `getSessionUser`).
 */
export async function tozsamosc(supabase: SupabaseClient): Promise<Tozsamosc | null> {
  const zestaw = await kluczePodpisu();

  const { data, error } = await supabase.auth.getClaims(
    undefined,
    zestaw ? { jwks: zestaw } : undefined
  );

  const tekst = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

  let id = tekst(data?.claims?.sub);
  let email = tekst(data?.claims?.email);
  /* `user_metadata` przychodzi z tokenu luźno typowane - domykamy je tu, nie dalej */
  let meta = (data?.claims?.user_metadata ?? {}) as Record<string, unknown>;

  /*
    SIATKA BEZPIECZEŃSTWA.

    Brak sesji i nieudana weryfikacja wyglądają w wyniku tak samo (`data: null`), ale różni
    je `error`: przy zwykłym braku ciasteczka jest null. Jeśli błąd JEST, to znaczy, że coś
    poszło nie tak w samej weryfikacji - zestaw kluczy bez pasującego `kid`, brak WebCrypto
    w środowisku, token, którego nie dało się odświeżyć.

    Wtedy pytamy serwer Auth, czyli płacimy dokładnie tę podróż, którą cały ten moduł miał
    oszczędzić. I bardzo dobrze: pomyłka w weryfikacji bez tego zapasu pokazuje KAŻDEMU
    zalogowanemu, że jest wylogowany - pasek bez konta, puste ulubione, zniknięte
    podpalenia. Jedno żądanie więcej jest tanie, cicha utrata sesji nie jest.
  */
  if (!id && error) {
    const { data: awaryjne } = await supabase.auth.getUser();
    const user = awaryjne?.user;
    if (!user) return null;

    id = user.id;
    email = tekst(user.email);
    meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  }

  if (!id) return null;

  return {
    id,
    email,
    nazwaZTokenu: tekst(meta.full_name),
    avatarZTokenu: tekst(meta.avatar_url),
  };
}
