import { supabaseBrowser } from "./supabase/client";
import { supabasePublic } from "./supabase/publiczny";

/**
 * Wydarzenia na boiskach - turnieje, treningi otwarte, streetball.
 *
 * Zakłada je administrator (patrz `migration-wydarzenia.sql`), a mapa i karta boiska
 * tylko je pokazują. Wydarzenie żyje w oknie czasu: zaczyna być widoczne z góry
 * (`WIDOCZNE_OD_DNI` przed startem) i przestaje samo, gdy się skończy - nikt nie musi
 * niczego sprzątać, bo najgorsza wersja tej funkcji to plakat po turnieju, który wisi
 * jeszcze pół roku.
 */

export interface Wydarzenie {
  id: string;
  courtId: string;
  nazwa: string;
  opis: string;
  /** ISO */
  poczatek: string;
  /** ISO */
  koniec: string;
  /** ścieżka w buckecie zdjęć albo null */
  zdjecie: string | null;
}

/** Na ile dni przed startem wydarzenie zapala pinezkę. */
export const WIDOCZNE_OD_DNI = 30;

const WYBOR = "id, court_id, nazwa, opis, poczatek, koniec, zdjecie";

interface Wiersz {
  id: string;
  court_id: string;
  nazwa: string;
  opis: string | null;
  poczatek: string;
  koniec: string;
  zdjecie: string | null;
}

function zWiersza(w: Wiersz): Wydarzenie {
  return {
    id: w.id,
    courtId: w.court_id,
    nazwa: w.nazwa,
    opis: w.opis ?? "",
    poczatek: w.poczatek,
    koniec: w.koniec,
    zdjecie: w.zdjecie,
  };
}

/**
 * Wydarzenia do pokazania na mapie, po identyfikatorze boiska.
 *
 * Pobierane z przeglądarki, nie z serwera razem z boiskami - i to jest przemyślane:
 * lista boisk na mapę jest trzymana w pamięci podręcznej na godziny (`listMapCourts`),
 * więc świeżo założone wydarzenie czekałoby na wygaśnięcie tej pamięci. Tu obowiązuje
 * ta sama zasada, co przy deklaracjach „zagram dziś": rzeczy, które zmieniają się
 * w ciągu dnia, dociągamy osobno.
 */
export async function pobierzWydarzenia(): Promise<Record<string, Wydarzenie>> {
  const supabase = await supabaseBrowser();
  if (!supabase) return {};

  const teraz = new Date();
  const granica = new Date(teraz.getTime() + WIDOCZNE_OD_DNI * 86_400_000);

  const { data } = await supabase
    .from("wydarzenia")
    .select(WYBOR)
    .gt("koniec", teraz.toISOString())
    .lt("poczatek", granica.toISOString())
    .order("poczatek", { ascending: true });

  const mapa: Record<string, Wydarzenie> = {};
  for (const w of (data ?? []) as Wiersz[]) {
    /* jedno boisko, jedno wydarzenie na pinezce - bierzemy najbliższe w czasie */
    if (!mapa[w.court_id]) mapa[w.court_id] = zWiersza(w);
  }
  return mapa;
}

/** Najbliższe wydarzenie danego boiska - dla strony boiska (serwer). */
export async function wydarzenieBoiska(courtId: string): Promise<Wydarzenie | null> {
  const supabase = supabasePublic();
  if (!supabase) return null;

  const { data } = await supabase
    .from("wydarzenia")
    .select(WYBOR)
    .eq("court_id", courtId)
    .gt("koniec", new Date().toISOString())
    .order("poczatek", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ? zWiersza(data as Wiersz) : null;
}

/* ---------------------------------------------------------------- czas */

export type StanWydarzenia = "trwa" | "dzis" | "wkrotce" | "minelo";

export function stanWydarzenia(w: Wydarzenie, teraz = Date.now()): StanWydarzenia {
  const od = Date.parse(w.poczatek);
  const do_ = Date.parse(w.koniec);
  if (teraz >= do_) return "minelo";
  if (teraz >= od) return "trwa";

  const dzisiaj = new Date(teraz);
  const start = new Date(od);
  const tenSamDzien =
    dzisiaj.getFullYear() === start.getFullYear() &&
    dzisiaj.getMonth() === start.getMonth() &&
    dzisiaj.getDate() === start.getDate();

  return tenSamDzien ? "dzis" : "wkrotce";
}

const DATA = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });
const GODZINA = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
const DZIEN_TYGODNIA = new Intl.DateTimeFormat("pl-PL", { weekday: "long" });

/** Godziny trwania: „18:00-21:00". */
export function godziny(w: Wydarzenie) {
  return `${GODZINA.format(new Date(w.poczatek))}-${GODZINA.format(new Date(w.koniec))}`;
}

/**
 * Kiedy, po ludzku: „trwa teraz", „dziś 18:00-21:00", „sobota, 12 października, 10:00-14:00".
 *
 * Godzina bez daty jest bezużyteczna („18:00" - dziś? w piątek?), a data bez dnia tygodnia
 * wymaga sprawdzenia w kalendarzu. Dzień tygodnia jest tym, po czym ludzie planują.
 */
export function kiedy(w: Wydarzenie, teraz = Date.now()) {
  const stan = stanWydarzenia(w, teraz);
  if (stan === "trwa") return `trwa teraz, do ${GODZINA.format(new Date(w.koniec))}`;
  if (stan === "minelo") return "już się skończyło";

  const start = new Date(w.poczatek);
  if (stan === "dzis") return `dziś ${godziny(w)}`;

  const jutro = new Date(teraz + 86_400_000);
  const tenSam =
    jutro.getFullYear() === start.getFullYear() &&
    jutro.getMonth() === start.getMonth() &&
    jutro.getDate() === start.getDate();
  if (tenSam) return `jutro ${godziny(w)}`;

  return `${DZIEN_TYGODNIA.format(start)}, ${DATA.format(start)}, ${godziny(w)}`;
}

/** Krótka plakietka stanu - na wizytówkę nad pinezką. */
export function plakietka(w: Wydarzenie, teraz = Date.now()) {
  const stan = stanWydarzenia(w, teraz);
  if (stan === "trwa") return "trwa teraz";
  if (stan === "dzis") return "dziś";
  const dni = Math.ceil((Date.parse(w.poczatek) - teraz) / 86_400_000);
  if (dni <= 1) return "jutro";
  return `za ${dni} dni`;
}
