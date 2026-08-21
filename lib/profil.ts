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
