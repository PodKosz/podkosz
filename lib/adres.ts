"use client";

import { CourtType, MapCourt, Surface, Access } from "./types";
import { DEFAULT_FILTERS, Filters } from "./filters";
import { supabaseBrowser } from "./supabase/client";

/**
 * Stan widoku w adresie strony.
 *
 * Do tej pory filtry i położenie mapy żyły tylko w pamięci: nie dało się wysłać komuś
 * linku „mapa Krakowa, tylko oświetlone", a odświeżenie strony wracało do widoku całej
 * Polski. Zapisujemy je przez history.replaceState, więc adres się aktualizuje bez
 * przeładowania i bez wpisów w historii przeglądarki.
 */
export interface MapaWidok {
  lat: number;
  lng: number;
  zoom: number;
}

const TYPES: CourtType[] = ["otwarty", "kryty", "streetball"];

/** Filtry odczytane z adresu; brakujące klucze zostają domyślne. */
export function czytajFiltry(sp: URLSearchParams): Partial<Filters> {
  const out: Partial<Filters> = {};

  const q = sp.get("q");
  if (q) out.q = q;

  const typ = sp.get("typ");
  if (typ) {
    const wybrane = typ.split(",").filter((t): t is CourtType => TYPES.includes(t as CourtType));
    if (wybrane.length) {
      out.types = { otwarty: false, kryty: false, streetball: false };
      for (const t of wybrane) out.types[t] = true;
    }
  }

  const naw = sp.get("naw");
  if (naw) out.surfaces = naw.split(",") as Surface[];

  const woj = sp.get("woj");
  if (woj) out.voivodeship = woj;

  const dostep = sp.get("dostep");
  if (dostep) out.access = dostep as Access;

  if (sp.get("swiatlo") === "1") out.onlyLit = true;

  const lajki = Number(sp.get("lajki"));
  if (Number.isFinite(lajki) && lajki > 0) out.minLikes = lajki;

  return out;
}

/** Filtry zamienione na klucze adresu. null = klucz do usunięcia. */
export function filtryDoAdresu(f: Filters): Record<string, string | null> {
  const wszystkieTypy = TYPES.every((t) => f.types[t]);
  return {
    q: f.q.trim() || null,
    typ: wszystkieTypy ? null : TYPES.filter((t) => f.types[t]).join(",") || null,
    naw: f.surfaces.length ? f.surfaces.join(",") : null,
    woj: f.voivodeship || null,
    dostep: f.access || null,
    swiatlo: f.onlyLit ? "1" : null,
    /*
      Do adresu wpisujemy próg zaokrąglony w górę, a nie surową pozycję uchwytu. Uchwyt
      sunie ułamkami, żeby ruch był płynny, ale w adresie „lajki=1.24" wyglądałoby jak
      pomyłka - a filtruje i tak dopiero od dwóch.
    */
    lajki: f.minLikes > 0 ? String(Math.ceil(f.minLikes)) : null,
  };
}

/** Filtry startowe: domyślne uzupełnione tym, co jest w adresie. */
export function filtryStartowe(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  return { ...DEFAULT_FILTERS, ...czytajFiltry(new URLSearchParams(window.location.search)) };
}

/** Położenie mapy z adresu (`m=lat,lng,zoom`). */
export function czytajWidok(): MapaWidok | null {
  if (typeof window === "undefined") return null;
  const m = new URLSearchParams(window.location.search).get("m");
  if (!m) return null;

  const [lat, lng, zoom] = m.split(",").map(Number);
  if (![lat, lng, zoom].every(Number.isFinite)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || zoom < 3 || zoom > 20) return null;

  return { lat, lng, zoom };
}

/** Aktualizuje wskazane klucze adresu, zostawiając pozostałe bez zmian. */
export function zapiszAdres(patch: Record<string, string | null>) {
  if (typeof window === "undefined") return;

  const sp = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
  }

  const query = sp.toString();
  const adres = `${window.location.pathname}${query ? `?${query}` : ""}`;
  // replaceState, a nie router.push: nie chcemy przeładowania ani wpisu w historii
  // przy każdym przesunięciu mapy
  window.history.replaceState(null, "", adres);
}

/** Zapisuje położenie mapy w adresie. */
export function zapiszWidok(view: MapaWidok) {
  zapiszAdres({
    m: `${view.lat.toFixed(4)},${view.lng.toFixed(4)},${view.zoom.toFixed(1)}`,
  });
}

/**
 * Od tylu boisk szukanie przenosimy do bazy. Poniżej progu filtrowanie w przeglądarce
 * jest szybsze niż zapytanie po sieci, a wyniki są identyczne.
 */
export const SZUKANIE_W_BAZIE_OD = 300;

/**
 * Szukanie po stronie bazy: zwraca identyfikatory w kolejności trafności.
 * Puste, gdy migracja `courts_search` nie jest wgrana - wtedy zostaje filtr w przeglądarce.
 */
export async function szukajWBazie(q: string, limit = 50): Promise<string[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("courts_search", { in_q: q, in_limit: limit });
  if (error || !data) return [];
  return (data as { id: string }[]).map((r) => r.id);
}

/** Porządkuje boiska według kolejności z bazy. */
export function wedlugTrafnosci<T extends MapCourt>(courts: T[], ids: string[]): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return courts
    .filter((c) => rank.has(c.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}
