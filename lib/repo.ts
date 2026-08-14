import { COURTS } from "./data";
import { Court } from "./types";
import { photoUrl, supabaseEnabled } from "./supabase/config";
import { supabaseServer } from "./supabase/server";
import type { CourtRow } from "./supabase/types";

const COURT_SELECT =
  "*, court_photos(kind, storage_path, sort)";

function rowToCourt(row: CourtRow): Court {
  const photos = [...(row.court_photos ?? [])]
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ kind: p.kind, url: photoUrl(p.storage_path), caption: p.kind }));

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
    addedBy: row.added_by_name,
    addedAt: row.created_at.slice(0, 10),
    description: row.description,
    photos: photos.length ? photos : [{ kind: "narożnik", caption: "Boisko" }],
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

/** Lajki i ulubione zalogowanego użytkownika — do podświetlenia przycisków. */
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
