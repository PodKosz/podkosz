import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dzienny sufit wysyłki poczty - i jedyne miejsce, przez które listy wychodzą.
 *
 * ------------------------------------------------------------------ czego Resend nie umie
 *
 * W kokpicie stało „ustawić dzienny limit wysyłki w Resend". Takiego ustawienia tam NIE MA.
 * Ich dokumentacja (Usage Limits) mówi wprost dwie rzeczy:
 *
 *   - limit tempa to 10 żądań na sekundę na zespół i podnosi się go na prośbę,
 *     a nie obniża w panelu;
 *   - dzienny limit jest WŁAŚCIWOŚCIĄ PLANU, nie przełącznikiem: „The daily quota applies
 *     only to the Free plan (...) Paid sending plans have no daily quota, only the
 *     monthly limit".
 *
 * Czyli dziś pilnuje nas cudzy limit darmowego planu - sto listów na dobę - a w dniu
 * przejścia na plan płatny ta ochrona znika. Dokładnie wtedy, gdy zaczyna być potrzebna,
 * bo to wtedy rachunek przestaje mieć górną granicę. Stąd ten plik.
 *
 * ------------------------------------------------------------------ dlaczego wszystko idzie tędy
 *
 * Bo sufit założony w pięciu z sześciu miejsc nie jest sufitem. Adresów `api.resend.com`
 * w tym repozytorium było sześć i każdy robił swoje `fetch`; żeby dało się powiedzieć
 * „najwyżej tyle listów na dobę", musi istnieć jedno przejście, którego nie da się
 * ominąć przez nieuwagę. Nowa wysyłka dodana kiedyś w siódmym miejscu ma trafić na to,
 * że `fetch` do Resend jest tutaj i nigdzie indziej.
 */

/**
 * Ile listów wolno wysłać w ciągu doby UTC.
 *
 * Liczba wzięta z planu, nie z sufitu: Resend Pro to 50 000 listów miesięcznie, czyli
 * jakieś 1600 na dobę średnio. Tysiąc pięćset znaczy więc „jedna zwariowana noc nie
 * zje całego miesiąca" - a to jest dokładnie to, przed czym sufit ma chronić.
 *
 * Dziś, na planie darmowym, ten sufit jest jeszcze nieczynny: Resend odetnie nas wcześniej,
 * na swoich stu listach na dobę. I dobrze - ta liczba jest przygotowana na dzień, w którym
 * tamta ochrona zniknie, a nie na dziś.
 *
 * Rozesłanie wiadomości o otwarciu serwisu policzy się do tego samego sufitu i to jest
 * zamierzone. Trasa `/api/mail-otwarcie` wysyła porcjami i mówi panelowi, ile zostało,
 * więc trafienie w sufit znaczy „dokończysz jutro", a nie „nie wyszło".
 */
export const SUFIT_NA_DOBE = 1500;

/** Największa porcja, jaką przyjmuje `api.resend.com/emails/batch`. */
const PORCJA_BATCH = 100;

export interface WynikPoczty {
  ok: boolean;
  /** kod odpowiedzi Resend; 0, gdy w ogóle nie wysyłaliśmy */
  status: number;
  powod?: string;
  /** ile listów zostało dziś do wykorzystania, jeśli baza zdążyła powiedzieć */
  zostalo?: number;
}

interface Przepustka {
  wolno: boolean;
  uzyte: number;
  sufit: number;
  zostalo: number;
  powod?: string;
}

/**
 * Rezerwuje miejsce na `ile` listów.
 *
 * PRZEPUSZCZA, GDY BAZA MILCZY. To jest wybór, nie przeoczenie. Sufit ma zatrzymać
 * wysyłkę, która się zapętliła - a taka wysyłka dzieje się przy działającej bazie, bo
 * baza jest częścią każdego z tych przepływów. Awaria, przy której RPC nie odpowiada,
 * zwykle i tak wywraca to, co miało wyprodukować listy. Zamknięcie się przy takiej
 * awarii kosztowałoby nas pewne wyłączenie całej poczty w zamian za ochronę przed
 * przypadkiem, który się przy niej nie zdarza.
 *
 * Cena jest taka, że nieuruchomiona migracja znaczy „sufitu nie ma" i nikt tego nie
 * zauważy patrząc na stronę. Dlatego zostawiamy ślad w dzienniku - to jedyne miejsce,
 * w którym da się to zobaczyć.
 */
async function zarezerwuj(
  supabase: SupabaseClient,
  sekret: string,
  ile: number
): Promise<Przepustka | null> {
  const { data, error } = await supabase.rpc("poczta_przepustka", {
    p_sekret: sekret,
    p_ile: ile,
    p_sufit: SUFIT_NA_DOBE,
  });

  if (error) {
    console.warn(
      `[poczta] sufit nie odpowiada, przepuszczam ${ile} listów bez sprawdzenia: ${error.message}`
    );
    return null;
  }

  return data as Przepustka;
}

/**
 * Oddaje rezerwację, gdy listy jednak nie poszły.
 *
 * Bez tego każda odmowa dostawcy zjadałaby sufit na stałe - porcja policzona, listy
 * niewysłane, a licznik do północy pamięta je jako wysłane. Przy kilku nieudanych
 * próbach wysyłki hurtowej wystarczyłoby to, żeby zablokować sobie dzień samemu.
 */
async function zwroc(supabase: SupabaseClient, sekret: string, ile: number) {
  const { error } = await supabase.rpc("poczta_zwrot", { p_sekret: sekret, p_ile: ile });
  if (error) console.warn(`[poczta] nie udało się oddać ${ile} miejsc: ${error.message}`);
}

/**
 * Wysyła jeden list albo porcję listów przez Resend, pilnując dziennego sufitu.
 *
 * Jedna wiadomość idzie na `/emails`, lista na `/emails/batch` - tak samo jak wcześniej
 * robiły to wywołania rozsiane po trasach. Wołający dostaje `ok` i kod odpowiedzi, czyli
 * dokładnie to, czego używał z `Response`; nikt z nich nie czytał ciała odpowiedzi.
 *
 * Rezerwacja idzie PRZED wysłaniem. Odwrotna kolejność - policzyć po fakcie - znaczyłaby,
 * że porcja dziewięćdziesięciu listów przekracza sufit i dowiadujemy się o tym, gdy już
 * poszły.
 */
export async function wyslijPrzezResend(
  supabase: SupabaseClient | null,
  klucz: string,
  wiadomosci: unknown | unknown[]
): Promise<WynikPoczty> {
  const lista = Array.isArray(wiadomosci) ? wiadomosci : null;
  const ile = lista ? lista.length : 1;

  if (ile === 0) return { ok: true, status: 0, powod: "nie ma czego wysyłać" };
  if (lista && ile > PORCJA_BATCH) {
    return { ok: false, status: 0, powod: `porcja większa niż ${PORCJA_BATCH} listów` };
  }

  /*
    Bez bazy nie ma jak liczyć, a poczta ma działać - patrz nota przy `zarezerwuj`.
    Taki przypadek jest dziś tylko teoretyczny: wszystkie trasy wysyłkowe mają klienta.
  */
  const przepustka = supabase ? await zarezerwuj(supabase, klucz, ile) : null;

  if (przepustka && !przepustka.wolno) {
    return {
      ok: false,
      status: 0,
      zostalo: przepustka.zostalo,
      powod:
        przepustka.powod === "porcja większa niż cały sufit"
          ? `porcja ${ile} listów nie zmieści się w dziennym suficie (${przepustka.sufit})`
          : `dzienny sufit wysyłki wyczerpany (${przepustka.uzyte}/${przepustka.sufit}) - ` +
            "zeruje się o północy UTC",
    };
  }

  const res = await fetch(
    lista ? "https://api.resend.com/emails/batch" : "https://api.resend.com/emails",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${klucz}`, "Content-Type": "application/json" },
      body: JSON.stringify(wiadomosci),
    }
  ).catch(() => null);

  if (!res?.ok) {
    if (supabase && przepustka) await zwroc(supabase, klucz, ile);
    return {
      ok: false,
      status: res?.status ?? 0,
      zostalo: przepustka?.zostalo,
      powod: res ? `poczta odmówiła (${res.status})` : "poczta nie odpowiedziała",
    };
  }

  return { ok: true, status: res.status, zostalo: przepustka?.zostalo };
}
