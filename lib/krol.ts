"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Król Boiska, propsy i „Teraz na boisku” - rozmowa z bazą (migration-krol-boiska.sql).
 *
 * Obecność jest potwierdzana GPS-em po otwarciu karty boiska na miejscu, ważna 2 godziny
 * od ostatniego potwierdzenia. Props można dać tylko komuś, kto był na boisku w tym samym
 * czasie - to on, a nie sam GPS, jest prawdziwym potwierdzeniem obecności.
 */

/** Promień meldunku - musi zgadzać się z `zamelduj()` w bazie (60 m). */
export const PROMIEN_MELDUNKU_M = 60;

export interface GraczNaBoisku {
  id: string;
  nick: string;
  avatar: string | null;
  slug: string | null;
  /** od kiedy jest na boisku (ISO) */
  od: string;
  krol: boolean;
  /** czy dałem mu już dziś propsa */
  props: boolean;
}

export interface StanNaBoisku {
  jestem: boolean;
  od?: string;
  wazneDo?: string;
  /** zgoda na widoczność: null - jeszcze nie pytaliśmy */
  pokaz: boolean | null;
  gracze: GraczNaBoisku[];
}

export interface Bywalec {
  id: string;
  nick: string;
  avatar: string | null;
  slug: string | null;
  punkty: number;
  dni: number;
  propsy: number;
}

export type WynikMeldunku =
  | { ok: true; pokaz: boolean | null }
  | { ok: false; powod: "konto" | "blokada" | "za-slaby-sygnal" | "za-daleko" | "za-szybko" | "brak-boiska" | "brak-bazy"; odleglosc?: number };

export async function zamelduj(courtId: string, odczyt: { lat: number; lng: number; dokladnosc: number }): Promise<WynikMeldunku> {
  const supabase = await supabaseBrowser();
  if (!supabase) return { ok: false, powod: "brak-bazy" };
  const { data, error } = await supabase.rpc("zamelduj", {
    in_court: courtId,
    in_lat: odczyt.lat,
    in_lng: odczyt.lng,
    in_dokladnosc: odczyt.dokladnosc,
  });
  if (error || !data) return { ok: false, powod: "brak-bazy" };
  const d = data as { ok: boolean; powod?: string; pokaz?: boolean | null; odleglosc?: number };
  return d.ok
    ? { ok: true, pokaz: d.pokaz ?? null }
    : ({ ok: false, powod: (d.powod ?? "brak-bazy") as Exclude<WynikMeldunku, { ok: true }>["powod"], odleglosc: d.odleglosc });
}

export async function wymelduj(courtId: string) {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  await supabase.rpc("wymelduj", { in_court: courtId });
}

export async function naBoisku(courtId: string): Promise<StanNaBoisku> {
  const pusto: StanNaBoisku = { jestem: false, pokaz: null, gracze: [] };
  const supabase = await supabaseBrowser();
  if (!supabase) return pusto;
  const { data, error } = await supabase.rpc("na_boisku", { in_court: courtId });
  if (error || !data) return pusto;
  const d = data as { jestem: boolean; od?: string; wazne_do?: string; pokaz?: boolean | null; gracze?: GraczNaBoisku[] };
  return { jestem: d.jestem, od: d.od, wazneDo: d.wazne_do, pokaz: d.pokaz ?? null, gracze: d.gracze ?? [] };
}

export async function dajProps(courtId: string, komu: string): Promise<boolean> {
  const supabase = await supabaseBrowser();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("daj_props", { in_court: courtId, in_do: komu });
  return !error && Boolean((data as { ok?: boolean } | null)?.ok);
}

export async function ustawWidocznosc(pokaz: boolean) {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  await supabase.rpc("ustaw_widocznosc_na_boisku", { in_pokaz: pokaz });
}

export async function bywalcyBoiska(courtId: string, ile = 5): Promise<Bywalec[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("krol_boiska", { in_court: courtId, in_limit: ile });
  if (error || !Array.isArray(data)) return [];
  return (data as { user_id: string; nick: string; avatar: string | null; slug: string | null; punkty: number; dni: number; propsy: number }[]).map(
    (r) => ({ id: r.user_id, nick: r.nick, avatar: r.avatar, slug: r.slug, punkty: r.punkty, dni: r.dni, propsy: r.propsy })
  );
}

/** Komunikat dla odmowy meldunku - te same rozróżnienia co przy dodawaniu boiska. */
export function powodOdmowy(w: Exclude<WynikMeldunku, { ok: true }>): string {
  switch (w.powod) {
    case "za-daleko":
      return `Wygląda na to, że nie ma Cię na tym boisku - jesteś jakieś ${w.odleglosc ?? "?"} m od niego.`;
    case "za-slaby-sygnal":
      return "Sygnał GPS jest za słaby, żeby potwierdzić, że stoisz na boisku. Wyjdź na otwartą przestrzeń i spróbuj jeszcze raz.";
    case "za-szybko":
      return "Przed chwilą byłeś zameldowany na innym boisku - spróbuj za kilka minut.";
    case "konto":
      return "Meldunek wymaga konta.";
    case "blokada":
      return "Twoje konto jest zablokowane.";
    default:
      return "Nie udało się zameldować - spróbuj jeszcze raz.";
  }
}
