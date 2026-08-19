"use client";

import { supabaseBrowser } from "./supabase/client";

export interface CheckinSlot {
  hour: number;
  people: number;
}

/**
 * Deklaracje gry na dziś: „idę o 18:00".
 *
 * Czytamy je funkcją zbiorczą w bazie, więc na zewnątrz nie wychodzi lista osób -
 * tylko godziny i liczby. Własną deklarację widzi wyłącznie jej autor (RLS).
 */
export async function fetchCheckins(courtId: string): Promise<CheckinSlot[]> {
  const supabase = supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("checkins_for_court", { in_court: courtId });
  if (error || !data) return [];

  return (data as { hour: number; people: number }[]).map((r) => ({
    hour: r.hour,
    people: r.people,
  }));
}

/** Godzina, na którą zalogowany użytkownik zapisał się dziś na to boisko (albo null). */
export async function fetchMySlot(courtId: string): Promise<number | null> {
  const supabase = supabaseBrowser();
  if (!supabase) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("checkins")
    .select("hour")
    .eq("court_id", courtId)
    .eq("day", today)
    .maybeSingle();

  return (data as { hour: number } | null)?.hour ?? null;
}

/** Zapisuje deklarację na dziś. Druga deklaracja na tym boisku nadpisuje pierwszą. */
export async function declareToday(courtId: string, hour: number): Promise<void> {
  const supabase = supabaseBrowser();
  if (!supabase) throw new Error("Brak połączenia z bazą.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Trzeba być zalogowanym.");

  const today = new Date().toISOString().slice(0, 10);

  // ograniczenie unikalności (boisko, osoba, dzień) pilnuje, że jest jedna deklaracja;
  // zmiana godziny to usunięcie starej i wstawienie nowej
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", today);

  const { error } = await supabase
    .from("checkins")
    .insert({ court_id: courtId, user_id: user.id, day: today, hour });

  if (error) throw new Error(error.message);
}

/** Odwołuje własną deklarację na dziś. */
export async function cancelToday(courtId: string): Promise<void> {
  const supabase = supabaseBrowser();
  if (!supabase) return;
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", today);
}
