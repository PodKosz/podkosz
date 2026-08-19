import { supabaseBrowser } from "./supabase/client";

export interface NearbyMatch {
  id: string;
  slug: string;
  name: string;
  city: string;
  distanceM: number;
}

/**
 * Boiska stojące praktycznie w tym samym miejscu co podane współrzędne.
 *
 * Duplikaty są przy publicznym kreatorze najczęstszym śmieciem w kolejce moderacji:
 * ktoś fotografuje boisko, które ktoś inny dodał tydzień wcześniej. Zamiast odrzucać
 * takie zgłoszenie po fakcie, pokazujemy je autorowi od razu przy pinezce.
 *
 * Promień 120 m: pełnowymiarowa płyta ma 28 m, więc to zapas na niedokładny GPS,
 * a jednocześnie za mało, żeby złapać sąsiednie boisko w tym samym parku.
 */
export async function findNearbyCourts(
  lat: number,
  lng: number,
  radiusM = 120
): Promise<NearbyMatch[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("courts_in_radius", {
    in_lat: lat,
    in_lng: lng,
    in_radius_m: radiusM,
  });

  // brak migracji albo błąd sieci nie może blokować zgłaszania boiska
  if (error || !data) return [];

  return (data as { id: string; slug: string; name: string; city: string; distance_m: number }[]).map(
    (r) => ({ id: r.id, slug: r.slug, name: r.name, city: r.city, distanceM: r.distance_m })
  );
}
