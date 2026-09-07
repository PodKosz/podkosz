import { supabaseBrowser } from "./supabase/client";
import type { Wydarzenie } from "./wydarzenia-czas";
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

/* Reguły czasu stoją osobno (dają się sprawdzić w Node) - tu je tylko podajemy dalej,
   żeby reszta kodu miała jedno miejsce, z którego bierze wszystko o wydarzeniach. */
export * from "./wydarzenia-czas";
