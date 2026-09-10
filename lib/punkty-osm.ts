import { supabaseBrowser } from "./supabase/client";
import { supabasePublic } from "./supabase/publiczny";

/**
 * Punkty nieodkrytych boisk - szare pinezki na mapie.
 *
 * Miejsca, w których według OpenStreetMap stoi boisko do kosza, a u nas jeszcze go nie ma.
 * Widać je dopiero po mocnym przybliżeniu; klik prowadzi na małą stronę z jednym zdaniem:
 * przyjdź tu i dodaj to boisko. Kto doda boisko bliżej niż pięćdziesiąt metrów, gasi punkt -
 * robi to wyzwalacz w bazie, bez udziału tego kodu.
 *
 * Z OSM biorą się WYŁĄCZNIE WSPÓŁRZĘDNE. Żadnych nazw, nawierzchni, godzin - powody
 * (prawny i produktowy) opisuje `scripts/punkty-osm.mjs` i `supabase/migration-punkty-osm.sql`.
 */

export interface PunktOsm {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Punkty w prostokącie mapy.
 *
 * Nigdy „wszystkie": zapytanie idzie po kadrze i tylko przy dużym przybliżeniu, więc
 * w typowym wywołaniu wraca kilka-kilkanaście wierszy po jakieś sześćdziesiąt bajtów.
 * Baza odmawia kadrów szerszych niż pół stopnia - patrz nota przy `punkty_w_kadrze`.
 */
export async function punktyWKadrze(kadr: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}): Promise<PunktOsm[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("punkty_w_kadrze", {
    in_min_lat: kadr.minLat,
    in_min_lng: kadr.minLng,
    in_max_lat: kadr.maxLat,
    in_max_lng: kadr.maxLng,
  });

  if (error || !Array.isArray(data)) return [];
  return (data as { osm_id: string; lat: number; lng: number }[]).map((r) => ({
    id: r.osm_id,
    lat: r.lat,
    lng: r.lng,
  }));
}

/**
 * „Tu nie ma boiska" - zgłoszenie punktu-widma.
 *
 * Wymaga konta: bez tego jedna osoba wygasiłaby dowolny punkt tyloma zgłoszeniami, ile ma
 * cierpliwości. Punkt nie gaśnie sam po iluś zgłoszeniach - decyzję podejmuje człowiek
 * w panelu, bo trzy konta wystarczyłyby, żeby skasować prawdziwy checkpoint, a odtworzyć
 * go potem nie ma jak.
 */
export async function zglosBrakBoiska(id: string): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Zgłaszanie wymaga podpiętej bazy.");

  const { error } = await supabase.rpc("zglos_brak_boiska", { in_id: id });
  if (error) throw new Error(error.message);
}

export interface SzczegolyPunktu extends PunktOsm {
  ukryty: boolean;
  /** slug boiska, które ten punkt odkryło - null, gdy wciąż jest do wzięcia */
  odkrytePrzez: string | null;
}

/** Jeden punkt po identyfikatorze - dla strony „boisko nieodkryte" (serwer). */
export async function punktOsm(id: string): Promise<SzczegolyPunktu | null> {
  const supabase = supabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("punkt_osm", { in_id: id });
  if (error || !Array.isArray(data) || !data.length) return null;

  const w = data[0] as {
    osm_id: string;
    lat: number;
    lng: number;
    ukryty: boolean;
    odkryte_slug: string | null;
  };

  return {
    id: w.osm_id,
    lat: w.lat,
    lng: w.lng,
    ukryty: w.ukryty,
    odkrytePrzez: w.odkryte_slug,
  };
}
