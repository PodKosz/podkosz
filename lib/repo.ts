import { COURTS } from "./data";
import { Court, CourtPhotoRef, MapCourt, PHOTO_KIND_LABEL, toMapCourt } from "./types";
import { photoUrl, supabaseEnabled } from "./supabase/config";
import { orderPhotos } from "./photos";
import { supabaseServer } from "./supabase/server";
import { supabasePublic } from "./supabase/publiczny";
import { unstable_cache } from "next/cache";
import { czyAutorAnonimowy, slugifyPlace } from "./site";
import { odznaczenia, type IdPoziomu } from "./odznaczenia";
import { statystykiGracza } from "./profil";
import type { CourtRow } from "./supabase/types";

export const COURT_SELECT =
  "*, court_photos(kind, storage_path, sort)";

/** Ziarno do grafik zastępczych - stałe dla danego boiska. */
const seedFromId = (id: string) =>
  Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 97;

export function rowToCourt(row: CourtRow): Court {
  const photos = orderPhotos(
    [...(row.court_photos ?? [])].sort((a, b) => a.sort - b.sort)
  ).map((p) => ({
    kind: p.kind,
    url: photoUrl(p.storage_path),
    caption: PHOTO_KIND_LABEL[p.kind] ?? p.kind,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    voivodeship: row.voivodeship,
    lat: row.lat,
    lng: row.lng,
    type: row.type,
    surface: row.surface,
    hoops: row.hoops,
    lit: row.lit,
    fenced: row.fenced,
    access: row.access,
    hours: row.hours,
    likes: row.likes_count,
    basketApproved: row.basket_approved,
    basketNote: row.basket_note ?? '',
    funny: row.funny ?? false,
    shortsUrl: row.shorts_url ?? '',
    addedBy: row.added_by_name,
    addedAt: row.created_at.slice(0, 10),
    description: row.description,
    photos: photos.length ? photos : [{ kind: "narożnik" as const, caption: "Boisko" }],
    seed: seedFromId(row.id),
  };
}

/**
 * Znacznik pamięci podręcznej dla wszystkiego, co czyta boiska. Panel administratora po
 * publikacji, edycji albo usunięciu wpisu uderza w /api/odswiez, co unieważnia ten znacznik
 * i zmiana widać natychmiast - bez tego czekalibyśmy do końca okresu odświeżania.
 */
export const COURTS_TAG = "courts";

/** Jak długo trzymamy odczyty boisk bez pytania bazy (sekundy). */
const COURTS_TTL = 300;

/**
 * Odczyty publiczne idą przez klient bez ciasteczek, bo tylko takie wyniki wolno trzymać
 * w pamięci podręcznej. Wcześniej każde wejście na stronę - także od robotów - oznaczało
 * zapytanie do Supabase o całą tabelę boisk.
 */
const fetchCourts = unstable_cache(
  async (): Promise<Court[]> => {
    const supabase = supabasePublic();
    if (!supabase) return COURTS;

    const { data, error } = await supabase
      .from("courts")
      .select(COURT_SELECT)
      .order("likes_count", { ascending: false });

    if (error || !data) return [];
    return (data as unknown as CourtRow[]).map(rowToCourt);
  },
  ["courts-lista"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

export async function listCourts(): Promise<Court[]> {
  return fetchCourts();
}

/** Kolumny potrzebne mapie i liście - bez złączenia ze zdjęciami. */
const MAP_SELECT =
  "id, slug, name, city, voivodeship, lat, lng, type, surface, hoops, lit, access, hours, likes_count, basket_approved, funny";

/**
 * Boiska na mapę: same skalary, bez zdjęć i opisów. To jest zapytanie, które musi wytrzymać
 * kilka tysięcy wpisów - stąd osobny, chudy kształt danych zamiast pełnego `Court`.
 */
export const listMapCourts = unstable_cache(
  async (): Promise<MapCourt[]> => {
    const supabase = supabasePublic();
    if (!supabase) return COURTS.map(toMapCourt);

    const { data, error } = await supabase
      .from("courts")
      .select(MAP_SELECT)
      .order("likes_count", { ascending: false });

    if (error || !data) return [];
    return (data as unknown as MapRow[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      voivodeship: row.voivodeship,
      lat: row.lat,
      lng: row.lng,
      type: row.type,
      surface: row.surface,
      hoops: row.hoops,
      lit: row.lit,
      access: row.access,
      hours: row.hours,
      likes: row.likes_count,
      basketApproved: row.basket_approved,
      funny: row.funny ?? false,
      seed: seedFromId(row.id),
    }));
  },
  ["courts-mapa"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

type MapRow = Pick<
  CourtRow,
  | "id"
  | "slug"
  | "name"
  | "city"
  | "voivodeship"
  | "lat"
  | "lng"
  | "type"
  | "surface"
  | "hoops"
  | "lit"
  | "access"
  | "hours"
  | "likes_count"
  | "basket_approved"
  | "funny"
>;

/** Licznik boisk - tanie zapytanie, bez pobierania wierszy. */
export const countCourts = unstable_cache(
  async (): Promise<number> => {
    const supabase = supabasePublic();
    if (!supabase) return COURTS.length;

    const { count } = await supabase
      .from("courts")
      .select("id", { count: "exact", head: true });

    return count ?? 0;
  },
  ["courts-licznik"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

const fetchCourtBySlug = unstable_cache(
  async (slug: string): Promise<Court | null> => {
    const supabase = supabasePublic();
    if (!supabase) return COURTS.find((c) => c.slug === slug) ?? null;

    const { data } = await supabase
      .from("courts")
      .select(COURT_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    return data ? rowToCourt(data as unknown as CourtRow) : null;
  },
  ["courts-slug"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

export async function getCourtBySlug(slug: string): Promise<Court | null> {
  return fetchCourtBySlug(slug);
}

/**
 * Boiska najbliższe podanemu - liczone po odległości w bazie (funkcja `courts_nearby`),
 * a nie po województwie, bo „to samo województwo" potrafiło pokazywać miejsca 150 km dalej.
 *
 * Jeśli migracja z funkcją nie jest jeszcze wgrana, wracamy do starego zachowania -
 * strona nie może się z tego powodu wywalić.
 */
export interface NearbyCourt {
  court: Court;
  /** odległość w metrach; null, gdy nie dało się jej policzyć (tryb testowy, brak migracji) */
  distanceM: number | null;
}

async function fetchNearby(court: Court, limit: number): Promise<NearbyCourt[]> {
  const supabase = supabasePublic();
  if (!supabase) {
    return COURTS.filter((c) => c.id !== court.id && c.voivodeship === court.voivodeship)
      .slice(0, limit)
      .map((c) => ({ court: c, distanceM: null }));
  }

  const { data: near, error } = await supabase.rpc("courts_nearby", {
    in_lat: court.lat,
    in_lng: court.lng,
    in_limit: limit,
    in_skip: court.id,
  });

  if (error || !near?.length) {
    if (error) {
      console.warn("courts_nearby niedostępne, wracam do filtra po województwie", error.message);
    }
    const all = await listCourts();
    return all
      .filter((c) => c.id !== court.id && c.voivodeship === court.voivodeship)
      .slice(0, limit)
      .map((c) => ({ court: c, distanceM: null }));
  }

  const odleglosci = near as { id: string; distance_m: number }[];
  const { data } = await supabase
    .from("courts")
    .select(COURT_SELECT)
    .in("id", odleglosci.map((r) => r.id));

  const byId = new Map(
    ((data ?? []) as unknown as CourtRow[]).map((row) => [row.id, rowToCourt(row)])
  );

  return odleglosci
    .map((r): NearbyCourt | null => {
      const found = byId.get(r.id);
      return found ? { court: found, distanceM: r.distance_m } : null;
    })
    .filter((n): n is NearbyCourt => n !== null);
}

/**
 * Najbliższe boiska trzymamy w pamięci podręcznej pod tym samym znacznikiem co listę:
 * to dane publiczne i zmieniają się tylko wtedy, gdy zmieni się baza boisk.
 * Kluczem jest identyfikator boiska, więc każda karta ma swój wpis.
 */
export async function listNearby(court: Court, limit = 3): Promise<NearbyCourt[]> {
  const cached = unstable_cache(
    () => fetchNearby(court, limit),
    ["courts-nearby", court.id, String(limit)],
    { tags: [COURTS_TAG], revalidate: COURTS_TTL }
  );
  return cached();
}

/** Odległości do boisk zwrócone przez `courts_nearby` - w metrach, po id. */
export async function nearbyDistances(
  lat: number,
  lng: number,
  limit = 3
): Promise<Record<string, number>> {
  const supabase = supabasePublic();
  if (!supabase) return {};
  const { data } = await supabase.rpc("courts_nearby", {
    in_lat: lat,
    in_lng: lng,
    in_limit: limit,
  });
  return Object.fromEntries(
    ((data ?? []) as { id: string; distance_m: number }[]).map((r) => [r.id, r.distance_m])
  );
}

export interface Contributor {
  name: string;
  courts: number;
  likes: number;
}

export const listContributors = unstable_cache(async (): Promise<Contributor[]> => {
  const supabase = supabasePublic();
  if (!supabase) {
    const map = new Map<string, Contributor>();
    for (const c of COURTS) {
      const e = map.get(c.addedBy) ?? { name: c.addedBy, courts: 0, likes: 0 };
      e.courts += 1;
      e.likes += c.likes;
      map.set(c.addedBy, e);
    }
    return [...map.values()].sort((a, b) => b.courts - a.courts || b.likes - a.likes);
  }

  const { data } = await supabase
    .from("contributors")
    .select("name, courts, likes")
    .order("courts", { ascending: false })
    .limit(100);

  return (data ?? []).map((r) => ({ name: r.name, courts: r.courts, likes: r.likes }));
}, ["contributors"], { tags: [COURTS_TAG], revalidate: COURTS_TTL });

/** Lajki i ulubione zalogowanego użytkownika - do podświetlenia przycisków. */
/* ---------------- ranking odkrywców z kadrami ---------------- */

export interface KadrOdkrywcy {
  slug: string;
  name: string;
  photo: CourtPhotoRef;
  seed: number;
  /** podpalenia tego boiska - od nich zależy rozmiar kadru w konstelacji */
  likes: number;
}

export interface OdkrywcaRanking {
  name: string;
  slug: string;
  /** liczba opublikowanych boisk - to ona wyznacza miejsce w rankingu */
  courts: number;
  likes: number;
  avatar: string | null;
  /** zdjęcia tytułowe własnych boisk, od najczęściej podpalanych */
  kadry: KadrOdkrywcy[];
  /** najwyższe zdobyte odznaczenia - tylko dla czołówki, którą rysuje konstelacja */
  plakietki: Plakietka[];
}

export interface Plakietka {
  id: string;
  nazwa: string;
  poziom: IdPoziomu;
  stopien: number;
}

/** Avatary z profili, żeby ranking pokazywał twarze, a nie same nicki. */
const fetchAvatary = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = supabasePublic();
    if (!supabase) return {};

    const { data } = await supabase.from("profiles").select("display_name, avatar_url");
    const out: Record<string, string> = {};
    for (const r of (data ?? []) as { display_name: string | null; avatar_url: string | null }[]) {
      if (r.display_name && r.avatar_url) out[r.display_name] = r.avatar_url;
    }
    return out;
  },
  ["avatary-odkrywcow"],
  { revalidate: COURTS_TTL }
);

/**
 * Ranking odkrywców: kolejność wyznacza liczba opublikowanych boisk (zgłoszenia czekające
 * w kolejce się nie liczą - w tabeli `courts` są tylko te zatwierdzone), a przy równej
 * liczbie decydują zebrane podpalenia.
 *
 * Do każdej osoby dokładamy zdjęcia tytułowe jej boisk, bo ranking rysuje je wokół avatara.
 */
/** Ile pierwszych miejsc dostaje plakietki odznaczeń - tyle, ile rysuje konstelacja. */
const ZE_PLAKIETKAMI = 5;

export async function listRankingOdkrywcow(ile = 25): Promise<OdkrywcaRanking[]> {
  const [odkrywcy, courts, avatary] = await Promise.all([
    listContributors(),
    listCourts(),
    fetchAvatary(),
  ]);

  const lista = odkrywcy
    .filter((o) => !czyAutorAnonimowy(o.name))
    .slice(0, ile)
    .map((o) => {
      /*
        Kadry w konstelacji: bierzemy do czternastu najczęściej podpalanych boisk. Więcej
        pierścień nie zniesie - przy każdym kolejnym zdjęciu muszą się zmniejszać, żeby
        zmieściły się na obwodzie, a poniżej pewnego rozmiaru nie widać już, co jest na
        zdjęciu.
      */
      const moje = courts
        .filter((c) => c.addedBy === o.name)
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 14);

      return {
        name: o.name,
        slug: slugifyPlace(o.name),
        courts: o.courts,
        likes: o.likes,
        avatar: avatary[o.name] ?? null,
        kadry: moje.map((c) => ({
          slug: c.slug,
          name: c.name,
          photo: c.photos[0],
          seed: c.seed,
          likes: c.likes,
        })),
        plakietki: [] as Plakietka[],
      };
    });

  /*
    Odznaczenia dociągamy tylko dla czołówki, którą rysuje konstelacja: każdy wiersz to
    osobne pytanie do bazy, a na liście miejsc 6-25 plakietki i tak się nie pokazują.
  */
  const czolowka = lista.slice(0, ZE_PLAKIETKAMI);
  const statystyki = await Promise.all(czolowka.map((o) => statystykiGracza(o.name)));

  czolowka.forEach((o, i) => {
    o.plakietki = odznaczenia(statystyki[i])
      .filter((od) => od.poziom !== null)
      .sort((a, b) => b.stopien - a.stopien)
      .slice(0, 3)
      .map((od) => ({
        id: od.id,
        nazwa: `${od.nazwa} - ${od.poziom!.nazwa}`,
        poziom: od.poziom!.id,
        stopien: od.stopien,
      }));
  });

  return lista;
}

export async function getUserReactions(
  userId: string | null
): Promise<{ likes: Set<string>; favorites: Set<string> }> {
  const empty = { likes: new Set<string>(), favorites: new Set<string>() };
  if (!userId || !supabaseEnabled) return empty;

  const supabase = await supabaseServer();
  if (!supabase) return empty;

  const [likes, favorites] = await Promise.all([
    supabase.from("likes").select("court_id").eq("user_id", userId),
    supabase.from("favorites").select("court_id").eq("user_id", userId),
  ]);

  return {
    likes: new Set((likes.data ?? []).map((r) => r.court_id)),
    favorites: new Set((favorites.data ?? []).map((r) => r.court_id)),
  };
}

export async function listFavoriteCourts(userId: string): Promise<Court[]> {
  const supabase = await supabaseServer();
  if (!supabase) return [];

  const { data } = await supabase
    .from("favorites")
    .select(`court_id, courts!inner(${COURT_SELECT})`)
    .eq("user_id", userId);

  return ((data ?? []) as unknown as { courts: CourtRow }[])
    .map((r) => r.courts)
    .filter(Boolean)
    .map(rowToCourt);
}

/**
 * Losowy slug boiska. `onlyFunny` zawęża do boisk z limonkową plakietką.
 * PostgREST nie umie sortować losowo, więc ciągniemy same slugi (kilka kB) i losujemy tutaj.
 */
export async function randomCourtSlug(
  onlyFunny = false,
  skipSlug?: string
): Promise<string | null> {
  const supabase = await supabaseServer();
  const pick = (slugs: string[]) => {
    const pool = skipSlug ? slugs.filter((s) => s !== skipSlug) : slugs;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  if (!supabase) {
    const local = (onlyFunny ? COURTS.filter((c) => c.funny) : COURTS).map((c) => c.slug);
    return pick(local);
  }

  let query = supabase.from("courts").select("slug");
  if (onlyFunny) query = query.eq("funny", true);
  const { data } = await query;

  return pick(((data ?? []) as { slug: string }[]).map((r) => r.slug));
}

/* ---------------- podstrony miejscowości i województw ---------------- */

export interface Place {
  /** nazwa w oryginalnej pisowni, np. „Zielona Góra" */
  name: string;
  slug: string;
  courts: number;
  /** województwo miejscowości; dla samego województwa równe nazwie */
  voivodeship: string;
}

/**
 * Miejscowości i województwa wyliczone z bazy boisk. Slug musi być odwracalny w jedną
 * stronę (nazwa → adres), więc dopasowanie w drugą stronę robimy przez tę listę,
 * a nie przez odgadywanie polskich znaków z adresu.
 */
export async function listPlaces(): Promise<{ cities: Place[]; voivodeships: Place[] }> {
  const courts = await listCourts();

  const cities = new Map<string, Place>();
  const voivodeships = new Map<string, Place>();

  for (const court of courts) {
    const citySlug = slugifyPlace(court.city);
    const city = cities.get(citySlug) ?? {
      name: court.city,
      slug: citySlug,
      courts: 0,
      voivodeship: court.voivodeship,
    };
    city.courts += 1;
    cities.set(citySlug, city);

    const vSlug = slugifyPlace(court.voivodeship);
    const voivodeship = voivodeships.get(vSlug) ?? {
      name: court.voivodeship,
      slug: vSlug,
      courts: 0,
      voivodeship: court.voivodeship,
    };
    voivodeship.courts += 1;
    voivodeships.set(vSlug, voivodeship);
  }

  const bySize = (a: Place, b: Place) => b.courts - a.courts || a.name.localeCompare(b.name, "pl");
  return {
    cities: [...cities.values()].sort(bySize),
    voivodeships: [...voivodeships.values()].sort(bySize),
  };
}

/** Boiska w miejscowości albo w województwie, po slugu z adresu. Null = nie ma takiego miejsca. */
export async function listCourtsForPlace(
  kind: "city" | "voivodeship",
  slug: string
): Promise<{ place: Place; courts: Court[] } | null> {
  const courts = await listCourts();
  const field = kind === "city" ? "city" : "voivodeship";
  const matched = courts.filter((c) => slugifyPlace(c[field]) === slug);
  if (!matched.length) return null;

  return {
    place: {
      name: matched[0][field],
      slug,
      courts: matched.length,
      voivodeship: matched[0].voivodeship,
    },
    courts: matched,
  };
}

/* ---------------- profile odkrywców ---------------- */

export interface Author {
  name: string;
  slug: string;
  courts: Court[];
  likes: number;
}

/**
 * Boiska dodane przez jedną osobę, po slugu z adresu. Nazwy autorów nie mają własnej
 * tabeli - siedzą w kolumnie `added_by_name` - więc dopasowujemy je przez ten sam slug,
 * którym budujemy adresy podstron miejsc.
 */
export async function getAuthor(slug: string): Promise<Author | null> {
  const courts = await listCourts();
  const matched = courts.filter((c) => slugifyPlace(c.addedBy) === slug);
  if (!matched.length) return null;

  return {
    name: matched[0].addedBy,
    slug,
    courts: matched,
    likes: matched.reduce((sum, c) => sum + c.likes, 0),
  };
}
