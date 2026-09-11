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
 * ------------------------------------------------------------------ dlaczego nie ma tu
 * ------------------------------------------------------------------ funkcji „daj wszystkie boiska"
 *
 * Była. Nazywała się `listCourts()`, ciągnęła całą tabelę razem ze wszystkimi zdjęciami
 * i obsługiwała ośmiu odbiorców, z których każdy brał z tego ułamek: ranking rysował
 * dwadzieścia pięć pierwszych, sitemapa potrzebowała pięciu kolumn i zera zdjęć, strona
 * miasta brała boiska z jednego miasta, a dostawała wszystkie z Polski.
 *
 * Zmierzone na produkcji: pełny wiersz ze zdjęciami waży 1554 bajty, a pamięć podręczna
 * Vercela odmawia zapisania wpisu większego niż 2 MB - i nie zgłasza tego, po prostu nie
 * zapisuje. Ściana wypadała przy 1349 boiskach i była niewidoczna: strona działała dalej,
 * tyle że każde wejście na każdą z tych stron odpytywało bazę od zera.
 *
 * Dlatego funkcji „daj wszystkie" tu nie ma i celowo nie wraca. Każdy odbiorca ma niżej
 * własne zapytanie, pobierające wyłącznie to, czego naprawdę używa. Ile to daje:
 *
 *     kształt                     bajtów na boisko      próg 2 MB
 *     pełny, ze zdjęciami                    1554           1 349   ← było, dla wszystkich
 *     sitemapa (pięć kolumn)                  171          12 264
 *     same slugi                               52          40 329
 *     czołówka rankingu / po id            stały koszt      bez progu
 *
 * Gdyby kiedyś znów kusiło pobranie wszystkiego i odfiltrowanie w JavaScripcie: to jest
 * dokładnie ten ruch, który tworzy takie ściany. Filtr po mieście, województwie i autorze
 * ma w bazie swoją kolumnę ze slugiem i indeks - patrz `migration-boiska-bez-pelnej-listy.sql`.
 */

/** Same slugi - do listy adresów przy przebudowie stron. Pięćdziesiąt dwa bajty na boisko. */
export const slugiBoisk = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = supabasePublic();
    if (!supabase) return COURTS.map((c) => c.slug);

    const { data, error } = await supabase.from("courts").select("slug");
    if (error || !data) return [];
    return (data as { slug: string }[]).map((r) => r.slug);
  },
  ["boiska-slugi"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

export interface BoiskoWSitemapie {
  slug: string;
  addedAt: string;
  city: string;
  voivodeship: string;
  addedBy: string;
}

/** Pięć kolumn, których używa spis adresów dla wyszukiwarek. Żadnych zdjęć ani opisów. */
export const boiskaDoSitemapy = unstable_cache(
  async (): Promise<BoiskoWSitemapie[]> => {
    const supabase = supabasePublic();
    if (!supabase)
      return COURTS.map((c) => ({
        slug: c.slug,
        addedAt: c.addedAt,
        city: c.city,
        voivodeship: c.voivodeship,
        addedBy: c.addedBy,
      }));

    const { data, error } = await supabase
      .from("courts")
      .select("slug, city, voivodeship, added_by_name, created_at");

    if (error || !data) return [];
    return (
      data as {
        slug: string;
        city: string;
        voivodeship: string;
        added_by_name: string;
        created_at: string;
      }[]
    ).map((r) => ({
      slug: r.slug,
      addedAt: r.created_at.slice(0, 10),
      city: r.city,
      voivodeship: r.voivodeship,
      addedBy: r.added_by_name,
    }));
  },
  ["boiska-sitemapa"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

/**
 * Czołówka rankingu - dokładnie tyle boisk, ile strona rysuje.
 *
 * Wcześniej ranking pobierał wszystkie boiska ze zdjęciami, sortował i wyrzucał wszystko
 * poza pierwszą dwudziestką piątką. Liczbę podaje wołający, a źródłem prawdy jest stała
 * z komponentu - żeby zapytanie i widok nie mogły się rozjechać.
 */
export async function topBoiska(ile: number): Promise<Court[]> {
  const cached = unstable_cache(
    async (): Promise<Court[]> => {
      const supabase = supabasePublic();
      if (!supabase) return [...COURTS].sort((a, b) => b.likes - a.likes).slice(0, ile);

      const { data, error } = await supabase
        .from("courts")
        .select(COURT_SELECT)
        .order("likes_count", { ascending: false })
        .limit(ile);

      if (error || !data) return [];
      return (data as unknown as CourtRow[]).map(rowToCourt);
    },
    ["boiska-top", String(ile)],
    { tags: [COURTS_TAG], revalidate: COURTS_TTL }
  );
  return cached();
}

/** Ile identyfikatorów mieści się w jednym zapytaniu - dalej adres robi się za długi. */
const PACZKA_ID = 100;

/**
 * Boiska po identyfikatorach, zwrócone mapą - dla ulubionych, historii gry i kadrów
 * w konstelacji odkrywców. Wszystkie te miejsca znają identyfikatory i potrzebują nazw
 * oraz zdjęć; wcześniej dobierały je z pełnej listy wszystkich boisk w Polsce.
 */
export async function boiskaPoId(ids: string[]): Promise<Map<string, Court>> {
  const unikalne = [...new Set(ids)];
  if (!unikalne.length) return new Map();

  const supabase = supabasePublic();
  if (!supabase)
    return new Map(COURTS.filter((c) => unikalne.includes(c.id)).map((c) => [c.id, c]));

  const paczki: string[][] = [];
  for (let i = 0; i < unikalne.length; i += PACZKA_ID)
    paczki.push(unikalne.slice(i, i + PACZKA_ID));

  const wyniki = await Promise.all(
    paczki.map((paczka) => supabase.from("courts").select(COURT_SELECT).in("id", paczka))
  );

  const mapa = new Map<string, Court>();
  for (const { data, error } of wyniki) {
    if (error || !data) continue;
    for (const row of data as unknown as CourtRow[]) mapa.set(row.id, rowToCourt(row));
  }
  return mapa;
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
    /*
      Zapas po województwie, nie po całej Polsce. Ta ścieżka włącza się tylko wtedy, gdy
      zawiedzie liczenie odległości w bazie - ale i wtedy nie ma powodu pobierać wszystkiego:
      wystarczy tyle wierszy, ile karta pokaże, plus jeden na odsianie samego siebie.
    */
    const { data: zapas } = await supabase
      .from("courts")
      .select(COURT_SELECT)
      .eq("voivodeship_slug", slugifyPlace(court.voivodeship))
      .neq("id", court.id)
      .order("likes_count", { ascending: false })
      .limit(limit);

    return ((zapas ?? []) as unknown as CourtRow[])
      .map((row) => ({ court: rowToCourt(row), distanceM: null }));
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

/**
 * Avatary WYMIENIONYCH osób - żeby ranking pokazywał twarze, a nie same nicki.
 *
 * Nicki wchodzą listą, a nie „daj wszystkie": wcześniej ta funkcja czytała CAŁĄ tabelę
 * profili i trzymała ją w pamięci podręcznej. Przy kilkudziesięciu kontach to nic, przy
 * tysiącach - kilka megabajtów przepisywane co pięć minut po to, żeby wyjąć z nich
 * dwadzieścia pięć twarzy do rankingu i jedną do podpisu pod opisem boiska.
 *
 * Argumenty wchodzą do klucza pamięci podręcznej, więc każdy zestaw nicków ma własny wpis.
 * Dla karty boiska to jeden nick i jeden wiersz; dla rankingu - dwadzieścia pięć.
 */
const fetchAvatary = unstable_cache(
  async (nicki: string[]): Promise<Record<string, string>> => {
    if (!nicki.length) return {};

    const supabase = supabasePublic();
    if (!supabase) return {};

    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .in("display_name", nicki);

    const out: Record<string, string> = {};
    for (const r of (data ?? []) as { display_name: string | null; avatar_url: string | null }[]) {
      if (r.display_name && r.avatar_url) out[r.display_name] = r.avatar_url;
    }
    return out;
  },
  ["avatary-odkrywcow"],
  { revalidate: COURTS_TTL, tags: [COURTS_TAG] }
);

/** Avatar jednej osoby, po nicku - pod podpis autora na karcie boiska. */
export async function avatarAutora(nick: string): Promise<string | null> {
  if (czyAutorAnonimowy(nick)) return null;
  const avatary = await fetchAvatary([nick]);
  return avatary[nick] ?? null;
}

/**
 * Ranking odkrywców: kolejność wyznacza liczba opublikowanych boisk (zgłoszenia czekające
 * w kolejce się nie liczą - w tabeli `courts` są tylko te zatwierdzone), a przy równej
 * liczbie decydują zebrane podpalenia.
 *
 * Do każdej osoby dokładamy zdjęcia tytułowe jej boisk, bo ranking rysuje je wokół avatara.
 */
/** Ile pierwszych miejsc dostaje plakietki odznaczeń - tyle, ile rysuje konstelacja. */
const ZE_PLAKIETKAMI = 5;

/** Ile kadrów mieści pierścień konstelacji przy jednym odkrywcy. */
const KADROW_NA_ODKRYWCE = 14;

export async function listRankingOdkrywcow(ile = 25): Promise<OdkrywcaRanking[]> {
  const odkrywcy = await listContributors();

  /*
    Najpierw kto jest na liście, dopiero potem ich twarze. Kolejność, nie równoległość:
    zapytanie o avatary musi wiedzieć, o kogo pytać - inaczej wracamy do czytania całej
    tabeli profili. Jedna podróż więcej w ścieżce, która i tak leci z pamięci podręcznej
    przez pięć minut.
  */
  const wybrani = odkrywcy.filter((o) => !czyAutorAnonimowy(o.name)).slice(0, ile);
  const nazwiska = wybrani.map((o) => o.name);

  /*
    Kadry w konstelacji: do czternastu najczęściej podpalanych boisk na osobę. Więcej
    pierścień nie zniesie - przy każdym kolejnym zdjęciu muszą się zmniejszać, żeby zmieścić
    się na obwodzie, a poniżej pewnego rozmiaru nie widać już, co jest na zdjęciu.

    Wybór robi baza (`kadry_odkrywcow`) i oddaje SAME IDENTYFIKATORY, po których dobieramy
    boiska jednym zapytaniem. Wcześniej brało się to z pełnej listy boisk w Polsce: przy
    dwudziestu pięciu osobach po kilkaset boisk każda oznaczało to pobranie kilku tysięcy
    wierszy ze zdjęciami po to, żeby zostawić po czternaście.
  */
  const supabase = supabasePublic();
  const { data: kadry } = supabase
    ? await supabase.rpc("kadry_odkrywcow", {
        in_nazwiska: nazwiska,
        in_ile: KADROW_NA_ODKRYWCE,
      })
    : { data: null };

  const pary = (Array.isArray(kadry) ? kadry : []) as { autor: string; court_id: string }[];
  const boiska = await boiskaPoId(pary.map((p) => p.court_id));

  const poAutorze = new Map<string, Court[]>();
  for (const para of pary) {
    const boisko = boiska.get(para.court_id);
    if (!boisko) continue;
    const lista = poAutorze.get(para.autor) ?? [];
    lista.push(boisko);
    poAutorze.set(para.autor, lista);
  }

  const avatary = await fetchAvatary(nazwiska);

  const lista = wybrani
    .map((o) => {
      /* kolejność wierszy z bazy nie jest obiecana - porządek nadajemy tutaj */
      const moje = (poAutorze.get(o.name) ?? [])
        .sort((a, b) => b.likes - a.likes)
        .slice(0, KADROW_NA_ODKRYWCE);

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
const wgWielkosci = (a: Place, b: Place) =>
  b.courts - a.courts || a.name.localeCompare(b.name, "pl");

/** Ta sama lista policzona z danych wbudowanych - gdy baza nie jest podpięta. */
function miejscaZDanychLokalnych(): { cities: Place[]; voivodeships: Place[] } {
  const cities = new Map<string, Place>();
  const voivodeships = new Map<string, Place>();

  for (const court of COURTS) {
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

  return {
    cities: [...cities.values()].sort(wgWielkosci),
    voivodeships: [...voivodeships.values()].sort(wgWielkosci),
  };
}

/**
 * Liczenie robi baza jednym `group by`, a nie my z pełnej listy boisk.
 *
 * Wcześniej, żeby pokazać „Bydgoszcz: 12 boisk", trzeba było pobrać te dwanaście boisk
 * razem ze zdjęciami - i tak samo wszystkie pozostałe w Polsce. Teraz wraca jeden wiersz
 * na miejscowość: nazwa, slug i licznik.
 */
export const listPlaces = unstable_cache(
  async (): Promise<{ cities: Place[]; voivodeships: Place[] }> => {
    const supabase = supabasePublic();
    if (!supabase) return miejscaZDanychLokalnych();

    const { data, error } = await supabase.rpc("miejsca_boisk");
    if (error || !Array.isArray(data)) return { cities: [], voivodeships: [] };

    const wiersze = data as {
      rodzaj: "miasto" | "wojewodztwo";
      nazwa: string;
      slug: string;
      wojewodztwo: string;
      ile: number;
    }[];

    const zRodzaju = (rodzaj: "miasto" | "wojewodztwo") =>
      wiersze
        .filter((w) => w.rodzaj === rodzaj)
        .map((w) => ({
          name: w.nazwa,
          slug: w.slug,
          courts: Number(w.ile),
          voivodeship: w.wojewodztwo,
        }))
        .sort(wgWielkosci);

    return { cities: zRodzaju("miasto"), voivodeships: zRodzaju("wojewodztwo") };
  },
  ["boiska-miejsca"],
  { tags: [COURTS_TAG], revalidate: COURTS_TTL }
);

/** Boiska w miejscowości albo w województwie, po slugu z adresu. Null = nie ma takiego miejsca. */
export async function listCourtsForPlace(
  kind: "city" | "voivodeship",
  slug: string
): Promise<{ place: Place; courts: Court[] } | null> {
  const pole = kind === "city" ? "city" : "voivodeship";

  const cached = unstable_cache(
    async (): Promise<Court[]> => {
      const supabase = supabasePublic();
      /* bez bazy zostaje filtr po danych wbudowanych - tych jest garść */
      if (!supabase) return COURTS.filter((c) => slugifyPlace(c[pole]) === slug);

      /*
        Filtr idzie po kolumnie ze slugiem, którą liczy baza (patrz
        `migration-boiska-bez-pelnej-listy.sql`). Wcześniej to samo robił JavaScript -
        ale żeby odfiltrować dwanaście boisk z Bydgoszczy, musiał najpierw pobrać
        wszystkie boiska w Polsce razem ze zdjęciami.
      */
      const { data, error } = await supabase
        .from("courts")
        .select(COURT_SELECT)
        .eq(kind === "city" ? "city_slug" : "voivodeship_slug", slug)
        .order("likes_count", { ascending: false });

      if (error || !data) return [];
      return (data as unknown as CourtRow[]).map(rowToCourt);
    },
    ["boiska-miejsce", kind, slug],
    { tags: [COURTS_TAG], revalidate: COURTS_TTL }
  );

  const matched = await cached();
  if (!matched.length) return null;

  return {
    place: {
      name: matched[0][pole],
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
  const cached = unstable_cache(
    async (): Promise<Court[]> => {
      const supabase = supabasePublic();
      if (!supabase) return COURTS.filter((c) => slugifyPlace(c.addedBy) === slug);

      /* kolumna ze slugiem autora liczona przez bazę - ta sama reguła, co `slugifyPlace` */
      const { data, error } = await supabase
        .from("courts")
        .select(COURT_SELECT)
        .eq("added_by_slug", slug)
        .order("likes_count", { ascending: false });

      if (error || !data) return [];
      return (data as unknown as CourtRow[]).map(rowToCourt);
    },
    ["boiska-autora", slug],
    { tags: [COURTS_TAG], revalidate: COURTS_TTL }
  );

  const matched = await cached();
  if (!matched.length) return null;

  return {
    name: matched[0].addedBy,
    slug,
    courts: matched,
    likes: matched.reduce((sum, c) => sum + c.likes, 0),
  };
}
