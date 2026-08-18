"use client";

/**
 * Geokodowanie na OpenStreetMap Nominatim: z pinezki na miasto i województwo,
 * z nazwy miasta na województwo. Używa tego panel administratora i kreator zgłoszeń.
 */

export interface PlaceHit {
  label: string;
  lat: number;
  lng: number;
}

export async function searchPlace(query: string): Promise<PlaceHit[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pl&limit=5&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { "Accept-Language": "pl" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return json.map((h) => ({
    label: h.display_name,
    lat: Number(h.lat),
    lng: Number(h.lon),
  }));
}

const cleanVoivodeship = (state?: string) =>
  (state ?? "")
    .toLowerCase()
    .replace(/^wojew[oó]dztwo\s+/, "")
    .trim();

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string; voivodeship: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "Accept-Language": "pl" } });
  if (!res.ok) return null;

  const json = (await res.json()) as { address?: Record<string, string> };
  const a = json.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";

  return { city, voivodeship: cleanVoivodeship(a.state) };
}

/**
 * Województwo po samej nazwie miasta — do automatycznego uzupełniania formularza.
 * Bierzemy pierwsze trafienie z Nominatim ograniczone do Polski i miejscowości.
 */
export async function voivodeshipForCity(city: string): Promise<string | null> {
  const query = city.trim();
  if (query.length < 3) return null;

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pl&limit=1" +
    "&addressdetails=1&featureType=settlement&city=" +
    encodeURIComponent(query);

  const res = await fetch(url, { headers: { "Accept-Language": "pl" } });
  if (!res.ok) return null;

  const json = (await res.json()) as { address?: Record<string, string> }[];
  const found = cleanVoivodeship(json[0]?.address?.state);
  return found || null;
}
