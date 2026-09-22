/**
 * Błąd bazy zamieniony na zdanie dla człowieka.
 *
 * Przyciski podpalenia i ulubionych wrzucały pod siebie `error.message` prosto z
 * PostgREST-a, więc na karcie boiska potrafiło się pokazać
 * „duplicate key value violates unique constraint »favorites_pkey«". To jest komunikat dla
 * kogoś, kto zna schemat bazy - czyli dla nikogo, kto wchodzi na stronę.
 */

/** Naruszenie klucza głównego albo indeksu unikatowego. */
export const DUPLIKAT = "23505";
/** Odmowa polityki RLS - najczęściej wygasła sesja albo zablokowane konto. */
const BRAK_UPRAWNIEN = "42501";
/** Wiersz nadrzędny zniknął - np. boisko skasowano, gdy karta była otwarta. */
const BRAK_POWIAZANIA = "23503";
/**
 * `check_violation` - tym kodem podpisują się NASZE wyzwalacze.
 *
 * Każde `raise exception ... using errcode = 'check_violation'` w migracjach niesie zdanie
 * napisane po polsku i z myślą o człowieku („Najwyżej 12 godzin na jednym boisku",
 * „O 18:00 jesteś już zapisany na boisko X"). Takie komunikaty przepuszczamy bez zmian.
 * Rozpoznajemy je po kodzie, a nie po wyglądzie tekstu, bo kod jest faktem, a nie
 * domysłem - pierwsza wersja tej funkcji zgadywała po tym, czy zdanie zaczyna się małą
 * literą, i wystarczyłby jeden komunikat Postgresa od wielkiej, żeby przeciekł na stronę.
 */
const NASZA_ZASADA = "23514";

export interface BladZapisu {
  code?: string;
  message?: string;
}

export function komunikatZapisu(blad: BladZapisu | null | undefined): string {
  if (!blad) return "Nie udało się zapisać. Spróbuj jeszcze raz.";

  switch (blad.code) {
    case NASZA_ZASADA:
      return blad.message || "Ta operacja jest niedozwolona.";
    case BRAK_UPRAWNIEN:
      return "Nie udało się zapisać - odśwież stronę i zaloguj się jeszcze raz.";
    case BRAK_POWIAZANIA:
      return "Tego boiska już nie ma w bazie.";
    default:
      return "Nie udało się zapisać. Spróbuj jeszcze raz.";
  }
}
