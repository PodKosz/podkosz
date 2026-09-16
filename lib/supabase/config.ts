export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Dopóki brak kluczy, aplikacja chodzi na danych testowych + localStorage. */
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const PHOTO_BUCKET = "court-photos";

/**
 * Skąd zdjęcia czyta przeglądarka.
 *
 * Od 16 września 2026 z Cloudflare R2 przez własną domenę, a nie z magazynu Supabase.
 * Powód jest prosty: darmowy Supabase daje 1 GB, czyli jakieś 240 boisk przy 4,2 MB na
 * boisko. R2 daje 10 GB za darmo, potem półtora centa za gigabajt i ZERO opłat za transfer
 * wychodzący - przy dziesięciu tysiącach boisk to jakieś 63 centy miesięcznie.
 *
 * Domena jest w tej samej strefie Cloudflare co serwis, więc skalowanie obrazków
 * (`/cdn-cgi/image/...`) czyta z niej bez dodatkowej konfiguracji.
 */
export const ZDJECIA_BAZA = (process.env.NEXT_PUBLIC_ZDJECIA_BAZA ?? "https://zdjecia.podkosz.pl")
  .trim()
  .replace(/\/+$/, "");

export function photoUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http")) return path;
  return `${ZDJECIA_BAZA}/${path}`;
}
