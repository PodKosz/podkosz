"use client";

import { komunikatZapisu } from "./bledy-zapisu";
import { supabaseBrowser } from "./supabase/client";

export interface CheckinSlot {
  hour: number;
  people: number;
}

/** Najdłuższy zakres, jaki wolno zadeklarować - tyle samo pilnuje wyzwalacz w bazie. */
export const MAX_GODZIN = 12;

/** Na ile dni naprzód można się zapisać: dziś i sześć kolejnych - tyle samo pilnuje baza. */
export const DNI_NAPRZOD = 7;

/**
 * Dzisiejsza data jako „RRRR-MM-DD", liczona tak samo jak w bazie (UTC).
 *
 * To tylko punkt wyjścia do pierwszego zapytania - panel oddaje potem `dzis` z bazy i pasek
 * dni buduje się od niego. Koło północy zegar przeglądarki i bazy mogą wskazywać różne dni,
 * a o tym, który dzień jest „dziś", ma rozstrzygać baza, bo to ona pilnuje zasad.
 */
export function dzisiaj(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Data przesunięta o `ile` dni, w tym samym formacie. */
export function dodajDni(dzien: string, ile: number): string {
  const d = new Date(`${dzien}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ile);
  return d.toISOString().slice(0, 10);
}

const DNI_KROTKO = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
const DNI_W = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];
const DNI_NA = ["na niedzielę", "na poniedziałek", "na wtorek", "na środę", "na czwartek", "na piątek", "na sobotę"];
const DNI_PELNE = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

/**
 * Nazwy dnia do panelu. „Dziś" i „jutro" zamiast dat, bo tak się umawia; dalej dzień
 * tygodnia - nikt nie mówi „idę 27.09", mówi „idę w sobotę".
 */
export function opisDnia(dzien: string, dzis: string) {
  const d = new Date(`${dzien}T12:00:00Z`);
  const t = d.getUTCDay();
  const za = Math.round((d.getTime() - new Date(`${dzis}T12:00:00Z`).getTime()) / 86_400_000);
  const data = `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    /** „Dziś", „Jutro", „So" - na pasek dni */
    krotko: za === 0 ? "Dziś" : za === 1 ? "Jutro" : DNI_KROTKO[t],
    /** numer dnia miesiąca pod skrótem */
    numer: d.getUTCDate(),
    /** „dziś", „jutro", „w sobotę" - do zdań w rodzaju „idziesz w sobotę" */
    kiedy: za === 0 ? "dziś" : za === 1 ? "jutro" : DNI_W[t],
    /** „na dziś", „na jutro", „na sobotę" */
    naKiedy: za === 0 ? "na dziś" : za === 1 ? "na jutro" : DNI_NA[t],
    /** „sobota 27.09" - do nagłówka wyboru godzin */
    pelna: `${DNI_PELNE[t]} ${data}`,
    dzis: za === 0,
  };
}

/**
 * Deklaracje gry: „idę w sobotę od 18:00 do 21:00".
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

/** Ile różnych osób idzie na boisko danego dnia - jeden dzień paska. */
export interface DzienTygodnia {
  day: string;
  osoby: number;
}

/** Dzień, na który sam się tu zapisałem, z godzinami. */
export interface MojDzien {
  day: string;
  godziny: number[];
}

/**
 * Cały panel deklaracji jednym zapytaniem.
 *
 * Wcześniej karta boiska dociągała to czterema osobnymi wywołaniami - godziny, liczba
 * osób, moje godziny i powód blokady. Cztery pełne żądania przez PostgREST na jedno
 * wejście na stronę, przy stronie, która sama leci z pamięci podręcznej.
 *
 * `null` znaczy „nie udało się" - wtedy komponent spada na cztery stare wywołania.
 */
export interface PanelDeklaracji {
  /** dzień, którego dotyczą godziny, osoby i blokada */
  dzien: string;
  /** dzisiejsza data według bazy - od niej zaczyna się pasek dni */
  dzis: string;
  slots: CheckinSlot[];
  osoby: number;
  moje: number[];
  /**
   * Godziny zajęte tego dnia na INNYM boisku.
   *
   * Nikt nie gra w dwóch miejscach naraz, więc te godziny są tu niewybieralne. Lista
   * celowo nie obejmuje własnych godzin na TYM boisku - te siedzą w `moje` i mają
   * zostać wybieralne, bo przesunięcie własnego zakresu w miejscu to nie kolizja.
   */
  zajete: number[];
  blokada: string | null;
  /**
   * Siedem dni z liczbą osób. `null`, gdy baza nie zna jeszcze deklaracji na tydzień
   * (migracja `migration-deklaracje-tydzien.sql` nie uruchomiona) - wtedy panel pokazuje
   * sam dzisiejszy dzień, jak dawniej.
   */
  tydzien: DzienTygodnia[] | null;
  mojeDni: MojDzien[];
}

type SurowyPanel = {
  dzis?: string;
  dzien?: string;
  godziny?: { hour: number; people: number }[];
  osoby?: number;
  moje?: number[];
  zajete?: number[];
  blokada?: string | null;
  tydzien?: DzienTygodnia[] | null;
  moje_dni?: MojDzien[] | null;
};

const zSurowego = (w: SurowyPanel, dzien: string): PanelDeklaracji => ({
  dzien: w.dzien ?? dzien,
  /* stary panel nie podaje daty - wtedy „dziś" z zegara, nigdy wybrany dzień */
  dzis: w.dzis ?? dzisiaj(),
  slots: (w.godziny ?? []).map((r) => ({ hour: r.hour, people: r.people })),
  osoby: typeof w.osoby === "number" ? w.osoby : 0,
  moje: w.moje ?? [],
  zajete: w.zajete ?? [],
  blokada: typeof w.blokada === "string" && w.blokada ? w.blokada : null,
  tydzien: Array.isArray(w.tydzien) ? w.tydzien : null,
  mojeDni: Array.isArray(w.moje_dni) ? w.moje_dni : [],
});

export async function fetchPanel(courtId: string, dzien: string): Promise<PanelDeklaracji | null> {
  const supabase = await supabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("checkin_panel", { in_court: courtId, in_day: dzien });
  if (!error && data && typeof data === "object") return zSurowego(data as SurowyPanel, dzien);

  /*
    Baza bez migracji tygodniowej: jest tylko panel na dziś. Pytamy o niego - pasek dni
    się wtedy nie pokaże (`tydzien: null`), a reszta działa po staremu.
  */
  const stary = await supabase.rpc("checkin_panel", { in_court: courtId });
  if (stary.error || !stary.data || typeof stary.data !== "object") return null;
  return zSurowego({ ...(stary.data as SurowyPanel), tydzien: null, moje_dni: null }, dzisiaj());
}

/**
 * Godziny, na które zalogowany użytkownik zapisał się dziś na INNE boiska.
 *
 * Używane tylko przez zapasową ścieżkę panelu, tę z czterema osobnymi wywołaniami.
 * Zwykle ta sama lista przychodzi jednym zapytaniem, w `fetchPanel`.
 */
export async function fetchZajete(courtId: string): Promise<number[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("checkin_zajete", { in_court: courtId });
  return !error && Array.isArray(data) ? (data as number[]) : [];
}

/** Godziny, na które zalogowany użytkownik zapisał się danego dnia na to boisko. */
export async function fetchMyHours(courtId: string, dzien = dzisiaj()): Promise<number[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data } = await supabase
    .from("checkins")
    .select("hour")
    .eq("court_id", courtId)
    .eq("day", dzien)
    .order("hour");

  return ((data ?? []) as { hour: number }[]).map((r) => r.hour);
}

/**
 * Czy ta osoba może się danego dnia zapisać na to boisko - a jeśli nie, to dlaczego.
 *
 * Deklaracja mówi, gdzie ktoś faktycznie będzie, więc dziennie wolno wskazać najwyżej
 * dwa boiska i oba w tym samym województwie. Bez tego jedna osoba zapalała pół mapy i
 * w minutę wyklikiwała odznaczenia za bywanie na boiskach.
 *
 * Zasady pilnuje wyzwalacz w bazie - tabela jest zapisywalna z przeglądarki, więc
 * sprawdzenie tutaj jest wyłącznie po to, żeby powiedzieć to człowiekowi ZANIM kliknie.
 */
export async function fetchBlokada(courtId: string, dzien = dzisiaj()): Promise<string | null> {
  const supabase = await supabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("checkin_blokada", { in_court: courtId, in_day: dzien });
  if (!error) return typeof data === "string" && data ? data : null;

  /* baza bez migracji tygodniowej zna tylko wersję na dziś */
  if (dzien !== dzisiaj()) return null;
  const stary = await supabase.rpc("checkin_blokada", { in_court: courtId });
  return !stary.error && typeof stary.data === "string" && stary.data ? stary.data : null;
}

/**
 * Zapisuje deklarację na dany dzień dla zakresu godzin (włącznie z końcem).
 * Nowa deklaracja zastępuje poprzednią na tym boisku w tym dniu; inne dni zostają.
 */
export async function zapiszDeklaracje(
  courtId: string,
  dzien: string,
  od: number,
  doGodziny = od,
  /**
   * Godziny zajęte tego dnia gdzie indziej. Podaje je panel, który i tak je zna.
   *
   * Sprawdzenie tutaj nie jest zaporą - zaporą jest indeks unikatowy `(user_id, day,
   * hour)` w bazie, bo tabela jest zapisywalna z przeglądarki. Tu chodzi o to, żeby nie
   * skasować poprzedniej deklaracji przed zderzeniem, którego dało się uniknąć.
   */
  zajete: number[] = []
): Promise<void> {
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

  const kolizje = zajete.filter((h) => h >= start && h <= koniec).sort((a, b) => a - b);
  if (kolizje.length) {
    const g = (h: number) => `${String(h).padStart(2, "0")}:00`;
    throw new Error(
      kolizje.length === 1
        ? `O ${g(kolizje[0])} jesteś już na innym boisku.`
        : `Na innym boisku jesteś już w godzinach ${kolizje.map(g).join(", ")}.`
    );
  }

  /*
    Pytamy o limit przed skasowaniem starych godzin. Zapis to „skasuj i wstaw", więc
    odbicie się od wyzwalacza dopiero przy wstawianiu zostawiłoby człowieka bez
    poprzedniej deklaracji i bez nowej.
  */
  const blokada = await fetchBlokada(courtId, dzien);
  if (blokada) throw new Error(blokada);

  /* zmiana godzin to skasowanie starych wierszy i wstawienie nowych - bez łatania różnic */
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", dzien);

  const wiersze = [];
  for (let h = start; h <= koniec; h++) {
    wiersze.push({ court_id: courtId, user_id: user.id, day: dzien, hour: h });
  }

  const { error } = await supabase.from("checkins").insert(wiersze);
  /*
    Komunikaty z naszych wyzwalaczy (limity deklaracji, „nie da się grać w dwóch miejscach
    naraz") idą do człowieka bez zmian - rozpoznaje je po kodzie `komunikatZapisu`.
    Surowe błędy silnika zamienia na jedno zdanie, zamiast pokazywać nazwę indeksu.
  */
  if (error) throw new Error(komunikatZapisu(error));
}

/** Odwołuje własną deklarację na dany dzień - wszystkie godziny na tym boisku. */
export async function odwolajDeklaracje(courtId: string, dzien: string): Promise<void> {
  const supabase = await supabaseBrowser();
  if (!supabase) return;
  await supabase.from("checkins").delete().eq("court_id", courtId).eq("day", dzien);
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
