"use client";

import { supabaseBrowser } from "./supabase/client";

export interface CheckinSlot {
  hour: number;
  people: number;
}

/** Najdłuższy zakres, jaki wolno zadeklarować - tyle samo pilnuje wyzwalacz w bazie. */
export const MAX_GODZIN = 12;

/**
 * Deklaracje gry na dziś: „idę od 18:00 do 21:00".
 *
 * Zakres trzymamy jako osobny wiersz na każdą godzinę. Wygląda to na rozrzutność, ale
 * dzięki temu pytanie „ile osób jest o 19:00" zostaje zwykłym zliczeniem, bez rozwijania
 * przedziałów, a godziny z przeszłości od razu robią historię gry pod odznaczenia.
 *
 * Czytamy funkcjami zbiorczymi w bazie, więc na zewnątrz nie wychodzi lista osób -
 * tylko godziny i liczby. Własną deklarację widzi wyłącznie jej autor (RLS).
 */
export async function fetchCheckins(courtId: string): Promise<CheckinSlot[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("checkins_for_court", { in_court: courtId });
  if (error || !data) return [];

  return (data as { hour: number; people: number }[]).map((r) => ({
    hour: r.hour,
    people: r.people,
  }));
}

/**
 * Ile różnych osób wybiera się dziś na to boisko.
 *
 * Osobne pytanie, bo sumy z `fetchCheckins` nie wolno dodać: ktoś zapisany na cztery
 * godziny siedzi w czterech wierszach i policzyłby się cztery razy.
 */
export async function fetchOsoby(courtId: string): Promise<number> {
  const supabase = await supabaseBrowser();
  if (!supabase) return 0;

  const { data } = await supabase.rpc("checkins_osoby", { in_court: courtId });
  return typeof data === "number" ? data : 0;
}

/** Godziny, na które zalogowany użytkownik zapisał się dziś na to boisko. */
export async function fetchMyHours(courtId: string): Promise<number[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("checkins")
    .select("hour")
    .eq("court_id", courtId)
    .eq("day", today)
    .order("hour");

  return ((data ?? []) as { hour: number }[]).map((r) => r.hour);
}

/**
 * Zapisuje deklarację na dziś dla zakresu godzin (włącznie z końcem).
 * Nowa deklaracja zastępuje poprzednią na tym boisku.
 */
export async function declareToday(courtId: string, od: number, doGodziny = od): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Brak połączenia z bazą.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Trzeba być zalogowanym.");

  const start = Math.min(od, doGodziny);
  const koniec = Math.max(od, doGodziny);
  if (koniec - start + 1 > MAX_GODZIN) {
    throw new Error(`Najwyżej ${MAX_GODZIN} godzin na jednym boisku w ciągu dnia.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  /* zmiana godzin to skasowanie starych wierszy i wstawienie nowych - bez łatania różnic */
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", today);

  const wiersze = [];
  for (let h = start; h <= koniec; h++) {
    wiersze.push({ court_id: courtId, user_id: user.id, day: today, hour: h });
  }

  const { error } = await supabase.from("checkins").insert(wiersze);
  if (error) throw new Error(error.message);
}

/** Odwołuje własną deklarację na dziś - wszystkie godziny na tym boisku. */
export async function cancelToday(courtId: string): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", today);
}

/** „18:00-21:00" albo „18:00" - do napisu o własnej deklaracji. */
export function opisGodzin(hours: number[]): string {
  if (!hours.length) return "";
  const g = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const od = hours[0];
  const doG = hours[hours.length - 1];
  /* +1, bo deklaracja „18-20" znaczy trzy godziny gry, czyli do 21:00 */
  return od === doG ? g(od) : `${g(od)}-${g(doG + 1)}`;
}

/**
 * Ile osób wybiera się dziś na każde boisko - dla całej mapy naraz.
 *
 * Jedno zapytanie zamiast jednego na pinezkę: przy kilkuset boiskach pytanie po kolei
 * byłoby kilkuset uderzeniami po sieci. Baza oddaje tylko te boiska, na które ktoś się
 * dziś zapisał, więc w typowy dzień to kilka wierszy.
 */
export async function fetchCheckinyDzisiaj(): Promise<Record<string, number>> {
  const supabase = await supabaseBrowser();
  if (!supabase) return {};

  const { data } = await supabase.rpc("checkiny_dzisiaj");
  if (!Array.isArray(data)) return {};

  const wynik: Record<string, number> = {};
  for (const w of data as { court_id: string; osoby: number }[]) {
    if (w?.court_id) wynik[w.court_id] = w.osoby;
  }
  return wynik;
}
