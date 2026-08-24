import { supabasePublic } from "./supabase/publiczny";
import { PUSTE_STATYSTYKI, type StatystykiGracza } from "./odznaczenia";
import { slugifyPlace } from "./site";

/**
 * Liczby jednego gracza pod profil i odznaczenia.
 *
 * Wszystko idzie jedną funkcją w bazie (`statystyki_gracza`), bo część źródeł - lajki,
 * ulubione, zapisy na grę - jest zamknięta politykami i widoczna tylko dla właściciela.
 * Funkcja zwraca same sumy, więc profil może je pokazać publicznie, a nikt nie dowie się
 * z niej, które konkretnie boiska ktoś polubił ani gdzie bywa.
 */
export interface ProfilGracza extends StatystykiGracza {
  /** null, gdy pod tym nickiem nie ma konta (np. stare wpisy redakcyjne) */
  userId: string | null;
  nick: string;
  avatar: string | null;
  dolaczyl: string | null;
}

interface WierszStatystyk {
  user_id: string | null;
  nick: string;
  avatar: string | null;
  dolaczyl: string | null;
  boiska: number;
  podpalenia_zebrane: number;
  podpalenia_dane: number;
  ulubione: number;
  godziny: number;
  dni: number;
  miasta: number;
  wojewodztwa: number;
  zdjecia: number;
  nocne: boolean;
  ranne: boolean;
  pionier: boolean;
  weekend: boolean;
  maraton: boolean;
  seria: number;
  zima: boolean;
  oswietlone: boolean;
  approved: boolean;
  smieszne: boolean;
  komplet: boolean;
  nawierzchnie: number;
  typy: number;
  pierwszy_w_miescie: boolean;
}

export async function statystykiGracza(nick: string): Promise<ProfilGracza> {
  const puste: ProfilGracza = {
    ...PUSTE_STATYSTYKI,
    userId: null,
    nick,
    avatar: null,
    dolaczyl: null,
  };

  const supabase = supabasePublic();
  if (!supabase) return puste;

  const { data } = await supabase.rpc("statystyki_gracza", { p_nick: nick });
  const w = (data as WierszStatystyk[] | null)?.[0];
  if (!w) return puste;

  return {
    userId: w.user_id,
    nick: w.nick || nick,
    avatar: w.avatar,
    dolaczyl: w.dolaczyl,
    boiska: w.boiska,
    podpaleniaZebrane: w.podpalenia_zebrane,
    podpaleniaDane: w.podpalenia_dane,
    ulubione: w.ulubione,
    godziny: w.godziny,
    dni: w.dni,
    miasta: w.miasta,
    wojewodztwa: w.wojewodztwa,
    zdjecia: w.zdjecia,
    nocne: w.nocne,
    ranne: w.ranne,
    pionier: w.pionier,
    /*
      Nowe pola dochodzą razem z migracją `migration-wyroznienia.sql`. Dopóki jej nie ma,
      funkcja zwraca undefined - stąd wartości zapasowe, żeby profil nie wywalał się
      między wgraniem kodu a wgraniem migracji.
    */
    weekend: w.weekend ?? false,
    maraton: w.maraton ?? false,
    seria: w.seria ?? 0,
    zima: w.zima ?? false,
    oswietlone: w.oswietlone ?? false,
    approved: w.approved ?? false,
    smieszne: w.smieszne ?? false,
    komplet: w.komplet ?? false,
    nawierzchnie: w.nawierzchnie ?? 0,
    typy: w.typy ?? 0,
    pierwszyWMiescie: w.pierwszy_w_miescie ?? false,
  };
}

/**
 * Nick pasujący do adresu profilu.
 *
 * Adresy budujemy ze zeslugowanego nicku (`/gracz/basket`), a polskich znaków nie da się
 * odwrócić w SQL-u. Dlatego dopasowujemy po stronie serwera: kont jest na tyle mało, że
 * jedno zapytanie o nicki jest tańsze niż trzymanie osobnej kolumny ze slugiem.
 *
 * Dzięki temu profil ma też ktoś, kto nie dodał jeszcze żadnego boiska - jego strona
 * istnieje od chwili założenia konta.
 */
export async function nickZeSlugu(slug: string): Promise<string | null> {
  const supabase = supabasePublic();
  if (!supabase) return null;

  const { data } = await supabase.from("profiles").select("display_name");
  const nicki = (data ?? []) as { display_name: string | null }[];

  return nicki.find((p) => p.display_name && slugifyPlace(p.display_name) === slug)?.display_name ?? null;
}

/**
 * Ulubione boiska gracza (identyfikatory) i historia jego gier.
 *
 * Obie tabele są zamknięte politykami, więc czytamy je funkcjami `security definer`, które
 * zwracają tylko identyfikatory i daty. Nazwy, miasta i zdjęcia dokłada strona z publicznej
 * listy boisk - dzięki temu profil nie robi ani jednego dodatkowego zapytania o treści,
 * które i tak są w pamięci podręcznej.
 */
export async function ulubioneGracza(nick: string): Promise<string[]> {
  const supabase = supabasePublic();
  if (!supabase) return [];

  const { data } = await supabase.rpc("ulubione_gracza", { p_nick: nick });
  return ((data ?? []) as { court_id: string }[]).map((r) => r.court_id);
}

export interface WizytaGracza {
  day: string;
  courtId: string;
}

export async function historiaGracza(nick: string): Promise<WizytaGracza[]> {
  const supabase = supabasePublic();
  if (!supabase) return [];

  const { data } = await supabase.rpc("historia_gracza", { p_nick: nick });
  return ((data ?? []) as { day: string; court_id: string }[]).map((r) => ({
    day: r.day,
    courtId: r.court_id,
  }));
}
