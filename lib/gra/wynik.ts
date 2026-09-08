"use client";

import { MAKS_SERIA, type IdMiejsca } from "@/lib/minigra";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Rozmowa minigry z bazą: otwarcie rundy i zapis wyniku.
 *
 * Wspólne dla obu gier, bo obie mają ten sam problem: wynik powstaje w przeglądarce,
 * więc sam z siebie nie jest niczym więcej niż liczbą, którą ktoś podał. Baza
 * (`minigra_zapisz`) przyjmuje go tylko wtedy, gdy jest OTWARTA RUNDA i gdy wynik da
 * się w niej fizycznie zdobyć - stąd `rozpocznijRunde`, wołane na początku każdej
 * rozgrywki.
 *
 * Runda gaśnie po zapisie, więc każdy wynik potrzebuje świeżej. Kolejność ma znaczenie
 * i dlatego zapis CZEKA na otwarcie: bez tego pierwszy wynik wysłany przy wolnej sieci
 * mógłby wyprzedzić otwarcie rundy i baza słusznie by go odrzuciła. Trzymamy więc
 * obietnicę otwarcia i zapis się na niej zatrzymuje.
 */

/** Sufit, który obowiązywał przed migracją `migration-minigra-sufit.sql`. */
const STARY_SUFIT = 500;

let otwieranie: Promise<void> | null = null;

/** Otwiera rundę. Wołać przy każdym starcie rozgrywki - nie szkodzi wołać częściej. */
export function rozpocznijRunde(miejsce: IdMiejsca) {
  otwieranie = (async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;
    await supabase.rpc("minigra_start", { p_miejsce: miejsce });
  })();

  /* obietnica jest tylko do zaczekania - błąd sieci nie może wywalić gry */
  void otwieranie.catch(() => {});
}

/**
 * Zapisuje wynik. Zwraca `null`, gdy nie było czego zapisać albo baza odmówiła -
 * gra nigdy nie zatrzymuje się z powodu zapisu.
 */
export async function zapiszWynik(miejsce: IdMiejsca, wynik: number): Promise<number | null> {
  if (wynik <= 0) return null;

  const supabase = await supabaseBrowser();
  if (!supabase) return null;

  if (otwieranie) {
    try {
      await otwieranie;
    } catch {
      /* nieudane otwarcie i tak skończy się odmową zapisu - próbujemy dalej */
    }
  }

  const doZapisu = Math.min(wynik, MAKS_SERIA);
  let { data, error } = await supabase.rpc("minigra_zapisz", {
    p_miejsce: miejsce,
    p_seria: doZapisu,
  });

  /*
    ZAPASOWA PRÓBA NA STARY SUFIT.

    Górna granica wyniku stoi w trzech miejscach: tutaj, w warunku kolumny i w funkcji
    bazy. Podniesienie jej wymaga więc i wydania nowej wersji strony, i uruchomienia
    migracji - a to dwie osobne czynności, między którymi jest okno. W tym oknie nowa
    strona wysyłałaby wynik, którego stara baza nie przyjmie, i wynik przepadałby
    W CAŁOŚCI - czyli gorzej niż przed poprawką, gdzie zapisywał się przycięty.

    Runda przeżywa odmowę (funkcja bazy zdejmuje ją dopiero przy udanym zapisie, a wyjątek
    wycofuje całą transakcję), więc druga próba ma z czego korzystać. Po uruchomieniu
    migracji ta gałąź przestaje się wykonywać sama z siebie.
  */
  if (error && doZapisu > STARY_SUFIT) {
    const zapas = await supabase.rpc("minigra_zapisz", {
      p_miejsce: miejsce,
      p_seria: STARY_SUFIT,
    });
    data = zapas.data;
    error = zapas.error;
  }

  /*
    Zapis zużył rundę, a gra idzie dalej - w rzutach seria zaczyna się od nowa
    natychmiast po pudle, w kozłach po dotknięciu planszy. Otwieramy więc następną
    rundę od razu, żeby żadna gra nie musiała o tym pamiętać.
  */
  rozpocznijRunde(miejsce);

  return error ? null : ((data as number | null) ?? null);
}
