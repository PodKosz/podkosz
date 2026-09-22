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
  poprawki: number;
  nawierzchnie: number;
  typy: number;
  pierwszy_w_miescie: boolean;
}

/** Pusty profil - gdy nie ma bazy albo pod tym nickiem nie ma nikogo. */
function pustyProfil(nick: string): ProfilGracza {
  return { ...PUSTE_STATYSTYKI, userId: null, nick, avatar: null, dolaczyl: null };
}

/** Wiersz z bazy na kształt, którego używa reszta aplikacji. */
function zWiersza(w: WierszStatystyk, nick: string): ProfilGracza {
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
    poprawki: w.poprawki ?? 0,
    nawierzchnie: w.nawierzchnie ?? 0,
    typy: w.typy ?? 0,
    pierwszyWMiescie: w.pierwszy_w_miescie ?? false,
  };
}

export async function statystykiGracza(nick: string): Promise<ProfilGracza> {
  const supabase = supabasePublic();
  if (!supabase) return pustyProfil(nick);

  const { data } = await supabase.rpc("statystyki_gracza", { p_nick: nick });
  const w = (data as WierszStatystyk[] | null)?.[0];
  return w ? zWiersza(w, nick) : pustyProfil(nick);
}

/** Klucz dopasowania - baza porównuje nicki bez wielkości liter i bez spacji po bokach. */
const klucz = (nick: string) => nick.trim().toLowerCase();

/**
 * Statystyki wielu graczy JEDNYM zapytaniem.
 *
 * Ranking pokazuje przy każdym graczu jego piłkę odznaczeń, a ta rysuje się z tych liczb.
 * Pytanie o każdego z osobna znaczyło dwadzieścia pięć podróży przez sieć na jedno
 * zbudowanie strony; `statystyki_graczy` odpytuje wszystkich naraz.
 *
 * Wynik dobieramy PO NAZWIE, nie po pozycji: baza nie obiecuje kolejności wierszy, a przy
 * dobieraniu po indeksie pomyłka byłaby cicha - ranking pokazałby cudze odznaczenia przy
 * czyjejś twarzy i nikt by tego nie zauważył.
 *
 * Gdy funkcji jeszcze nie ma (kod wgrany przed migracją `migration-statystyki-zbiorczo.sql`),
 * cofamy się do pytania o każdego osobno. Wolniej, ale strona działa - a wdrożenie i migracja
 * nigdy nie dzieją się w tej samej sekundzie.
 */
export async function statystykiGraczy(nicki: string[]): Promise<Map<string, ProfilGracza>> {
  const unikalne = [...new Map(nicki.map((n) => [klucz(n), n])).values()];
  const wynik = new Map<string, ProfilGracza>();
  if (!unikalne.length) return wynik;

  const supabase = supabasePublic();
  if (!supabase) {
    for (const n of unikalne) wynik.set(klucz(n), pustyProfil(n));
    return wynik;
  }

  const { data, error } = await supabase.rpc("statystyki_graczy", { p_nicki: unikalne });

  if (error || !Array.isArray(data)) {
    const osobno = await Promise.all(unikalne.map((n) => statystykiGracza(n)));
    unikalne.forEach((n, i) => wynik.set(klucz(n), osobno[i]));
    return wynik;
  }

  for (const w of data as WierszStatystyk[]) wynik.set(klucz(w.nick), zWiersza(w, w.nick));
  /* Nazwy, których baza nie zwróciła, dostają pusty profil - wołający ma dostać komplet. */
  for (const n of unikalne) if (!wynik.has(klucz(n))) wynik.set(klucz(n), pustyProfil(n));
  return wynik;
}

/**
 * Nick pasujący do adresu profilu.
 *
 * Adresy budujemy ze zeslugowanego nicku (`/gracz/basket`), a polskich znaków nie da się
 * odwrócić: z „basket" nie wynika, czy w bazie stoi „Basket" czy „Bąsket". Slug jest więc
 * kolumną liczoną przez bazę tą samą regułą co `slugifyPlace` i ma indeks
 * (`migration-slug-profilu.sql`) - wejście na profil to jedno trafienie w indeks.
 *
 * Wcześniej ta funkcja ŚCIĄGAŁA WSZYSTKIE NICKI i szukała pasującego w JavaScripcie,
 * z komentarzem „kont jest na tyle mało". To prawda dokładnie do chwili, w której
 * przestaje nią być - a wołane jest to dwa razy na wejście: raz dla metadanych strony,
 * raz dla samej strony.
 *
 * Profil ma też ktoś, kto nie dodał jeszcze żadnego boiska - jego strona istnieje od
 * chwili założenia konta.
 */
export async function nickZeSlugu(slug: string): Promise<string | null> {
  const supabase = supabasePublic();
  if (!supabase) return null;

  /*
    `limit(1)`, nie `maybeSingle()`: dwa różne nicki mogą zeslugować się do tego samego
    adresu („Basket" i „Bąsket"), a wtedy `maybeSingle` zwróciłoby BŁĄD zamiast wiersza
    i profil odpowiedziałby 404. Pierwszy z brzegu to to samo, co robił stary przegląd
    listy - migracja ma zapytanie kontrolne, które takie zbiegi wypisuje.
  */
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("slug", slug)
    .limit(1);

  if (!error) {
    return ((data ?? []) as { display_name: string | null }[])[0]?.display_name ?? null;
  }

  /*
    ZAPAS NA CZAS PRZED MIGRACJĄ. Zapytanie o nieistniejącą kolumnę wraca błędem, a nie
    pustką - i to jest ta różnica, po której poznajemy „nie ma kolumny" (wtedy stary
    przegląd listy) od „nie ma takiego profilu" (wtedy null wyżej). Do usunięcia, gdy
    kolumna stoi na produkcji.
  */
  const { data: wszystkie } = await supabase.from("profiles").select("display_name");
  const nicki = (wszystkie ?? []) as { display_name: string | null }[];

  return (
    nicki.find((p) => p.display_name && slugifyPlace(p.display_name) === slug)?.display_name ??
    null
  );
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
