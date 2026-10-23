"use client";

import { komunikatZapisu } from "./bledy-zapisu";
import { supabaseBrowser } from "./supabase/client";

/**
 * Opinie graczy o boisku (tabela `opinie`, migracja `migration-opinie.sql`).
 *
 * Ocena 1-5 jest jedyną rzeczą wymaganą - tagi i tekst są dodatkiem, żeby wystawienie opinii
 * zajmowało jedno dotknięcie, a nie wypełnianie formularza. Jedna opinia na osobę i boisko:
 * druga próba to edycja pierwszej.
 *
 * Tagi, długość tekstu i limit dobowy pilnuje baza. Tu jest tylko to, co trzeba powiedzieć
 * człowiekowi ZANIM kliknie.
 */

/** Klucze tagów w kolejności wyświetlania - te same, co w `opinie_dozwolone_tagi()` w bazie. */
export const TAGI_OPINII = {
  dobre_obrecze: "Dobre obręcze",
  rowna_nawierzchnia: "Równa nawierzchnia",
  wysoki_poziom: "Wysoki poziom gry",
  swietny_klimat: "Świetny klimat",
  pusto_rano: "Pusto rano",
  blisko_komunikacji: "Blisko komunikacji",
  tloczno_weekend: "Tłoczno w weekend",
  slisko_po_deszczu: "Ślisko po deszczu",
  ciemno_wieczorem: "Ciemno wieczorem",
  krzywe_obrecze: "Krzywe obręcze",
  zniszczona_nawierzchnia: "Zniszczona nawierzchnia",
  malo_miejsca: "Mało miejsca",
} as const;

export type TagOpinii = keyof typeof TAGI_OPINII;

export const MAKS_TAGOW = 6;
export const MAKS_ZNAKOW = 500;

/** Słowo pod gwiazdkami - ocena bez słowa jest liczbą, a nie zdaniem. */
export const SLOWO_OCENY = ["", "Słabe", "Takie sobie", "W porządku", "Dobre", "Świetne"];

export interface Opinia {
  id: string;
  ocena: number;
  tagi: TagOpinii[];
  tekst: string | null;
  dodana: string;
  zmieniona: string;
  nick: string;
  avatar: string | null;
  pomocne: number;
  moja: boolean;
  pomocnaDlaMnie: boolean;
}

export interface ListaOpinii {
  /**
   * `false`, gdy baza nie zna jeszcze opinii (migracja nie uruchomiona). Karta pokazuje wtedy
   * samą przypiętą opinię autora wpisu i nie zaprasza do oceniania, które i tak by nie przeszło.
   */
  dostepne: boolean;
  lista: Opinia[];
}

type Wiersz = {
  id: string;
  ocena: number;
  tagi: string[] | null;
  tekst: string | null;
  created_at: string;
  updated_at: string;
  nick: string | null;
  avatar: string | null;
  pomocne: number | null;
  moja: boolean | null;
  pomocna_dla_mnie: boolean | null;
};

export async function pobierzOpinie(courtId: string): Promise<ListaOpinii> {
  const supabase = await supabaseBrowser();
  if (!supabase) return { dostepne: false, lista: [] };

  const { data, error } = await supabase.rpc("opinie_boiska", { in_court: courtId });
  if (error || !Array.isArray(data)) return { dostepne: false, lista: [] };

  return {
    dostepne: true,
    lista: (data as Wiersz[]).map((w) => ({
      id: w.id,
      ocena: w.ocena,
      tagi: (w.tagi ?? []).filter((t): t is TagOpinii => t in TAGI_OPINII),
      tekst: w.tekst,
      dodana: w.created_at,
      zmieniona: w.updated_at,
      nick: w.nick || "gracz",
      avatar: w.avatar,
      pomocne: w.pomocne ?? 0,
      moja: Boolean(w.moja),
      pomocnaDlaMnie: Boolean(w.pomocna_dla_mnie),
    })),
  };
}

export interface NowaOpinia {
  ocena: number;
  tagi: TagOpinii[];
  tekst: string;
}

/**
 * Dodaje opinię albo poprawia własną. Bez `upsert`: konto ma prawo zmieniać w swojej opinii
 * tylko ocenę, tagi i tekst, a `upsert` próbuje nadpisać przy konflikcie wszystkie podane
 * kolumny - razem z boiskiem i autorem - i baza go odrzuca.
 */
export async function zapiszOpinie(courtId: string, opinia: NowaOpinia, istniejaca?: string): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Opinie ruszą po podpięciu bazy.");

  const tresc = {
    ocena: opinia.ocena,
    tagi: opinia.tagi.slice(0, MAKS_TAGOW),
    tekst: opinia.tekst.trim().slice(0, MAKS_ZNAKOW) || null,
  };

  if (istniejaca) {
    const { error } = await supabase.from("opinie").update(tresc).eq("id", istniejaca);
    if (error) throw new Error(komunikatZapisu(error));
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Trzeba być zalogowanym.");

  const { error } = await supabase.from("opinie").insert({ ...tresc, court_id: courtId, user_id: user.id });
  if (error) throw new Error(komunikatZapisu(error));
}

export async function usunOpinie(id: string): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("opinie").delete().eq("id", id);
  if (error) throw new Error(komunikatZapisu(error));
}

/** „Pomocne" pod cudzą opinią - przełącznik, jedno na osobę. */
export async function ustawPomocne(id: string, pomocna: boolean): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Trzeba być zalogowanym.");

  const { error } = pomocna
    ? await supabase.from("opinie_pomocne").insert({ opinia_id: id, user_id: user.id })
    : await supabase.from("opinie_pomocne").delete().eq("opinia_id", id).eq("user_id", user.id);
  /* duplikat znaczy, że „pomocne" już jest - a o to chodziło */
  if (error && error.code !== "23505") throw new Error(komunikatZapisu(error));
}

export interface Statystyki {
  liczba: number;
  /** średnia z dokładnością do jednego miejsca; `null` bez opinii */
  srednia: number | null;
  /** ile opinii z oceną 1..5 (indeks = ocena) */
  rozklad: [number, number, number, number, number, number];
}

export function statystyki(lista: Opinia[]): Statystyki {
  const rozklad: Statystyki["rozklad"] = [0, 0, 0, 0, 0, 0];
  for (const o of lista) rozklad[o.ocena] += 1;
  const suma = lista.reduce((s, o) => s + o.ocena, 0);
  return {
    liczba: lista.length,
    srednia: lista.length ? Math.round((suma / lista.length) * 10) / 10 : null,
    rozklad,
  };
}

/** „4,4" - przecinek dziesiętny po polsku. */
export const ocenaTekstem = (n: number) => n.toFixed(1).replace(".", ",");
