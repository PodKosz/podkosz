"use client";

/**
 * Geokodowanie na OpenStreetMap Nominatim: z pinezki na miasto i województwo,
 * z nazwy miasta na województwo. Używa tego panel administratora i kreator zgłoszeń.
 *
 * Zapytania idą przez `/api/geo`, a nie wprost z przeglądarki. Powód siedzi w regulaminie
 * OSM: żądanie musi się przedstawiać nagłówkiem `User-Agent`, a limit to jedno zapytanie
 * na sekundę z jednego źródła - obu tych rzeczy nie da się dopilnować w przeglądarce.
 * Nominatim za łamanie tych zasad blokuje po adresie IP, bez ostrzeżenia.
 */

export interface PlaceHit {
  label: string;
  lat: number;
  lng: number;
}

async function pytaj<T>(tryb: "search" | "reverse", parametry: Record<string, string>) {
  const adres = new URL("/api/geo", window.location.origin);
  adres.searchParams.set("tryb", tryb);
  for (const [k, v] of Object.entries(parametry)) adres.searchParams.set(k, v);

  const res = await fetch(adres);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function searchPlace(query: string): Promise<PlaceHit[]> {
  const json = await pytaj<{ display_name: string; lat: string; lon: string }[]>("search", {
    countrycodes: "pl",
    limit: "5",
    q: query,
  });
  if (!Array.isArray(json)) return [];

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
  const json = await pytaj<{ address?: Record<string, string> }>("reverse", {
    lat: String(lat),
    lon: String(lng),
  });
  if (!json) return null;

  const a = json.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";

  return { city, voivodeship: cleanVoivodeship(a.state) };
}

/**
 * Województwo po samej nazwie miasta - do automatycznego uzupełniania formularza.
 * Bierzemy pierwsze trafienie z Nominatim ograniczone do Polski i miejscowości.
 */
export async function voivodeshipForCity(city: string): Promise<string | null> {
  const query = city.trim();
  if (query.length < 3) return null;

  const json = await pytaj<{ address?: Record<string, string> }[]>("search", {
    countrycodes: "pl",
    limit: "1",
    addressdetails: "1",
    featureType: "settlement",
    city: query,
  });
  if (!Array.isArray(json)) return null;

  const found = cleanVoivodeship(json[0]?.address?.state);
  return found || null;
}
