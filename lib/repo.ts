import { COURTS } from "./data";
import { Court, PHOTO_KIND_LABEL } from "./types";
import { photoUrl, supabaseEnabled } from "./supabase/config";
import { orderPhotos } from "./photos";
import { supabaseServer } from "./supabase/server";
import { slugifyPlace } from "./site";
import type { CourtRow } from "./supabase/types";

const COURT_SELECT =
  "*, court_photos(kind, storage_path, sort)";

function rowToCourt(row: CourtRow): Court {
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
    seed: Math.abs([...row.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 97,
  };
}

export async function listCourts(): Promise<Court[]> {
  const supabase = await supabaseServer();
  if (!supabase) return COURTS;

  const { data, error } = await supabase
    .from("courts")
    .select(COURT_SELECT)
    .order("likes_count", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as CourtRow[]).map(rowToCourt);
}

/** Licznik boisk - tanie zapytanie, bez pobierania wierszy. */
export async function countCourts(): Promise<number> {
  const supabase = await supabaseServer();
  if (!supabase) return COURTS.length;

  const { count } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true });

  return count ?? 0;
}

export async function getCourtBySlug(slug: string): Promise<Court | null> {
  const supabase = await supabaseServer();
  if (!supabase) return COURTS.find((c) => c.slug === slug) ?? null;

  const { data } = await supabase
    .from("courts")
    .select(COURT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  return data ? rowToCourt(data as unknown as CourtRow) : null;
}

export async function listNearby(court: Court): Promise<Court[]> {
  const all = await listCourts();
  return all.filter((c) => c.id !== court.id && c.voivodeship === court.voivodeship).slice(0, 3);
}

export interface Contributor {
  name: string;
  courts: number;
  likes: number;
}

export async function listContributors(): Promise<Contributor[]> {
  const supabase = await supabaseServer();
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
}

/** Lajki i ulubione zalogowanego użytkownika - do podświetlenia przycisków. */
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
