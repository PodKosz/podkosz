"use client";

import { Access, CourtType, PhotoKind, Surface } from "./types";
import { slugify } from "./slug";
import { fileToJpeg } from "./images";
import { orderPhotos } from "./photos";
import { photoUrl } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";
import type { CourtRow } from "./supabase/types";

export interface CourtValues {
  name: string;
  city: string;
  voivodeship: string;
  lat: number;
  lng: number;
  type: CourtType;
  surface: Surface;
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Access;
  hours: string;
  description: string;
  basketApproved: boolean;
  basketNote: string;
  /** limonkowa plakietka „dziwne boisko” */
  funny: boolean;
  /** link do filmiku YouTube Shorts */
  shortsUrl: string;
  addedByName: string;
}

/** Zdjęcie w formularzu: albo świeży plik z dysku, albo już wgrany wpis. */
export type FormPhoto =
  | { key: string; kind: PhotoKind; file: File; previewUrl: string }
  | { key: string; kind: PhotoKind; storagePath: string; previewUrl: string };

export function isNewPhoto(
  p: FormPhoto
): p is { key: string; kind: PhotoKind; file: File; previewUrl: string } {
  return "file" in p;
}

function client() {
  const supabase = supabaseBrowser();
  if (!supabase) throw new Error("Brak połączenia z bazą — uzupełnij .env.local");
  return supabase;
}

async function uniqueSlug(base: string, ignoreId?: string) {
  const supabase = client();
  let slug = base || "boisko";
  for (let n = 2; n < 60; n++) {
    const { data } = await supabase.from("courts").select("id").eq("slug", slug).maybeSingle();
    if (!data || (ignoreId && (data as { id: string }).id === ignoreId)) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/** Tworzy albo aktualizuje boisko razem z galerią. Zwraca slug. */
export async function saveCourt(
  values: CourtValues,
  photos: FormPhoto[],
  courtId?: string
): Promise<string> {
  const supabase = client();
  const slug = await uniqueSlug(
    `${slugify(values.city)}-${slugify(values.name)}`.replace(/^-|-$/g, ""),
    courtId
  );

  const payload = {
    slug,
    name: values.name,
    city: values.city,
    voivodeship: values.voivodeship,
    lat: values.lat,
    lng: values.lng,
    type: values.type,
    surface: values.surface,
    hoops: values.hoops,
    lit: values.lit,
    fenced: values.fenced,
    access: values.access,
    hours: values.hours,
    description: values.description,
    basket_approved: values.basketApproved,
    basket_note: values.basketNote ?? '',
    funny: values.funny,
    shorts_url: values.shortsUrl?.trim() ?? '',
    added_by_name: values.addedByName || "Basket",
  };

  let id = courtId;
  if (id) {
    const { error } = await supabase.from("courts").update(payload).eq("id", id);
    if (error) throw new Error(`Zapis boiska nie przeszedł: ${error.message}`);
  } else {
    const { data, error } = await supabase.from("courts").insert(payload).select("id").single();
    if (error) throw new Error(`Zapis boiska nie przeszedł: ${error.message}`);
    id = (data as { id: string }).id;
  }

  // Ścieżki zdjęć w kolejności z formularza — nowe pliki lądują w Storage.
  const paths: { kind: PhotoKind; storage_path: string }[] = [];
  for (const [i, photo] of photos.entries()) {
    if (isNewPhoto(photo)) {
      const blob = await fileToJpeg(photo.file);
      const path = `boiska/${id}/${Date.now()}-${i + 1}-${slugify(photo.kind)}.jpg`;
      const up = await supabase.storage
        .from("court-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw new Error(`Zdjęcie ${i + 1}: ${up.error.message}`);
      paths.push({ kind: photo.kind, storage_path: path });
    } else {
      paths.push({ kind: photo.kind, storage_path: photo.storagePath });
    }
  }

  // Galerię odtwarzamy w całości — prościej i zawsze zgodnie z kolejnością na ekranie.
  await supabase.from("court_photos").delete().eq("court_id", id);
  if (paths.length) {
    const { error } = await supabase.from("court_photos").insert(
      paths.map((p, i) => ({ court_id: id, kind: p.kind, storage_path: p.storage_path, sort: i }))
    );
    if (error) throw new Error(`Galeria nie zapisała się: ${error.message}`);
  }

  return slug;
}

export async function deleteCourt(courtId: string) {
  const supabase = client();
  const { data } = await supabase
    .from("court_photos")
    .select("storage_path")
    .eq("court_id", courtId);

  const files = ((data ?? []) as { storage_path: string }[]).map((r) => r.storage_path);

  // Pliki kasujemy przed wierszem boiska — inaczej stracilibyśmy ścieżki i zostałyby sieroty.
  // Brakujący plik nie blokuje usunięcia wpisu; blokuje wyłącznie realny błąd Storage.
  if (files.length) {
    const { error: storageError } = await supabase.storage.from("court-photos").remove(files);
    if (storageError) throw new Error(`Zdjęcia zostały w Storage: ${storageError.message}`);
  }

  const { error } = await supabase.from("courts").delete().eq("id", courtId);
  if (error) throw new Error(`Nie udało się usunąć: ${error.message}`);
}

export interface AdminCourt extends CourtValues {
  id: string;
  slug: string;
  likes: number;
  photos: { key: string; kind: PhotoKind; storagePath: string; previewUrl: string }[];
}

export async function listCourtsForAdmin(): Promise<AdminCourt[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("courts")
    .select("*, court_photos(kind, storage_path, sort)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as CourtRow[]).map((row) => ({
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
    description: row.description,
    basketApproved: row.basket_approved,
    basketNote: row.basket_note ?? '',
    funny: row.funny ?? false,
    shortsUrl: row.shorts_url ?? '',
    addedByName: row.added_by_name,
    likes: row.likes_count,
    // w edytorze pokazujemy tę samą kolejność, którą zobaczy odwiedzający
    photos: orderPhotos([...(row.court_photos ?? [])].sort((a, b) => a.sort - b.sort)).map(
      (p, i) => ({
        key: `${row.id}-${i}`,
        kind: p.kind,
        storagePath: p.storage_path,
        previewUrl: photoUrl(p.storage_path),
      })
    ),
  }));
}

/* ---------- pomocnicze: adres <-> współrzędne ---------- */

export { searchPlace, reverseGeocode, voivodeshipForCity } from "./geo";
export type { PlaceHit } from "./geo";
