"use client";

import { useCallback, useEffect, useState } from "react";
import { Surface } from "./types";
import { supabaseBrowser } from "./supabase/client";

/**
 * Kandydaci na boiska z OpenStreetMap. Baza OSM ma w Polsce ponad 8 tysięcy obiektów
 * `leisure=pitch` + `sport=basketball` - to gotowa lista miejsc do sprawdzenia.
 * Nie bierzemy nic z Google Maps: ich regulamin zabrania budowania własnej bazy miejsc
 * na podstawie wyników, a OSM (licencja ODbL) wprost na to pozwala przy podaniu źródła.
 */

const OVERPASS_HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OVERPASS_QUERY = `[out:json][timeout:600];
area["ISO3166-1"="PL"][admin_level=2]->.pl;
nwr["leisure"="pitch"]["sport"~"basketball"](area.pl);
out center tags;`;

export type LeadStatus = "new" | "added" | "rejected";

export interface Lead {
  id: string;
  osm_type: string;
  osm_id: number;
  name: string;
  lat: number;
  lng: number;
  surface: string | null;
  hoops: number | null;
  lit: boolean | null;
  access_hint: string | null;
  tags: Record<string, string>;
  status: LeadStatus;
  court_id: string | null;
  created_at: string;
}

/** Lekki punkt do rysowania na mapie - bez tagów, żeby nie ciągnąć megabajtów. */
export interface LeadPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Nawierzchnie z OSM przełożone na nasz słownik. Reszta zostaje pusta. */
const SURFACE_FROM_OSM: Record<string, Surface> = {
  asphalt: "asfalt",
  paved: "asfalt",
  chipseal: "asfalt",
  concrete: "beton",
  concrete_plates: "beton",
  paving_stones: "beton",
  sett: "beton",
  tartan: "poliuretan",
  rubber: "poliuretan",
  acrylic: "poliuretan",
  polyurethane: "poliuretan",
  synthetic: "poliuretan",
  artificial_turf: "syntetyk",
  grass: "syntetyk",
  wood: "parkiet",
};

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toRow(el: OsmElement) {
  const lat = el.center?.lat ?? el.lat;
  const lng = el.center?.lon ?? el.lon;
  if (lat == null || lng == null) return null;

  const tags = el.tags ?? {};
  const hoops = Number.parseInt(tags.hoops ?? "", 10);

  return {
    osm_type: el.type,
    osm_id: el.id,
    name: tags.name ?? "",
    lat,
    lng,
    surface: SURFACE_FROM_OSM[tags.surface ?? ""] ?? null,
    hoops: Number.isFinite(hoops) ? hoops : null,
    lit: tags.lit === "yes" ? true : tags.lit === "no" ? false : null,
    access_hint: ["private", "customers", "no", "permit"].includes(tags.access ?? "")
      ? tags.access
      : null,
    tags,
    status: "new" as LeadStatus,
  };
}

async function askOverpass(): Promise<OsmElement[]> {
  let lastError = "";
  for (const host of OVERPASS_HOSTS) {
    try {
      const res = await fetch(host, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
      });
      if (!res.ok) {
        lastError = `${host}: HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastError = `${host}: ${(e as Error).message}`;
    }
  }
  throw new Error(`Nie udało się pobrać danych z OpenStreetMap (${lastError}).`);
}

/**
 * Zaciąga wszystkie boiska z OSM i dopisuje nowe do tabeli `court_leads`.
 * Powtórne uruchomienie nie duplikuje wpisów (klucz osm_type + osm_id) i nie rusza
 * statusów tych już przejrzanych.
 */
export async function importOsmLeads(onStep: (msg: string) => void) {
  const supabase = supabaseBrowser();
  if (!supabase) throw new Error("Import wymaga podpiętej bazy.");

  onStep("Pytam OpenStreetMap o boiska w Polsce… to trwa do dwóch minut.");
  const elements = await askOverpass();
  const rows = elements.map(toRow).filter((r): r is NonNullable<typeof r> => !!r);
  onStep(`OSM zwrócił ${elements.length} obiektów, z czego ${rows.length} ma współrzędne.`);

  const chunk = 400;
  let saved = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error } = await supabase
      .from("court_leads")
      .upsert(part, { onConflict: "osm_type,osm_id", ignoreDuplicates: true });
    if (error) throw new Error(`Zapis kandydatów przerwany: ${error.message}`);
    saved += part.length;
    onStep(`Zapisuję… ${Math.min(saved, rows.length)} / ${rows.length}`);
  }

  const { count } = await supabase
    .from("court_leads")
    .select("id", { count: "exact", head: true });

  onStep(`Gotowe. W bazie kandydatów: ${count ?? "?"}.`);
  return { fetched: rows.length, total: count ?? 0 };
}

/* ------------------------------------------------------------------ */
/*  Odczyt                                                             */
/* ------------------------------------------------------------------ */

/** Punkty do szarych pinezek: tylko nieprzejrzane. */
export async function listLeadPoints(): Promise<LeadPoint[]> {
  const supabase = supabaseBrowser();
  if (!supabase) return [];
  const rows: LeadPoint[] = [];
  const page = 1000;

  // PostgREST domyślnie ucina odpowiedź, więc lecimy stronami aż do końca.
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("court_leads")
      .select("id, name, lat, lng")
      .eq("status", "new")
      .order("created_at")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as LeadPoint[];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = supabaseBrowser();
  if (!supabase) return null;
  const { data, error } = await supabase.from("court_leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Lead) ?? null;
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const supabase = supabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("court_leads").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Po publikacji boiska z kandydata: znika z mapy i wskazuje na wpis. */
export async function markLeadAdded(leadId: string, courtSlug: string) {
  const supabase = supabaseBrowser();
  if (!supabase) return;
  const { data } = await supabase.from("courts").select("id").eq("slug", courtSlug).maybeSingle();
  await supabase
    .from("court_leads")
    .update({ status: "added", court_id: (data as { id: string } | null)?.id ?? null })
    .eq("id", leadId);
}

export interface LeadCounts {
  new: number;
  added: number;
  rejected: number;
}

async function countBy(status: LeadStatus) {
  const supabase = supabaseBrowser();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("court_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

/** Lista do panelu - z limitem, bo kandydatów są tysiące. */
export function useLeads(status: LeadStatus, limit = 60) {
  const [items, setItems] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<LeadCounts>({ new: 0, added: 0, rejected: 0 });
  const [loading, setLoading] = useState(() => !!supabaseBrowser());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    try {
      const [list, n, a, r] = await Promise.all([
        supabase
          .from("court_leads")
          .select("*")
          .eq("status", status)
          .order("name", { ascending: false })
          .limit(limit),
        countBy("new"),
        countBy("added"),
        countBy("rejected"),
      ]);
      setError(list.error ? list.error.message : null);
      setItems((list.data ?? []) as Lead[]);
      setCounts({ new: n, added: a, rejected: r });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  // setState siedzi w callbackach obietnicy wewnątrz `reload` - synchroniczne
  // wywołanie w ciele efektu jest w tym projekcie zgłaszane przez lintera.
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { items, counts, loading, error, reload };
}
