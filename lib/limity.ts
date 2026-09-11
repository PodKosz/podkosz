/**
 * Limity zapytań - licznik w pamięci instancji.
 *
 * Po co, skoro Vercel ma własną zaporę: bo do tej pory NIE BYŁO ŻADNEGO limitu i każda
 * publiczna trasa dawała się walić w pętli. To nie jest teoria, każda z tych rzeczy była
 * do zrobienia jednym `for` w bashu:
 *
 *   - `/api/geo` szeregował żądania po 1,1 s (tak każe regulamin OSM), a kolejka nie miała
 *     końca - setne żądanie czekało 110 sekund. Wystarczyło kilkaset żądań, żeby zająć
 *     wszystkie instancje funkcji na kilka minut i rozłożyć wyszukiwarkę adresów dla
 *     wszystkich naraz. Przy okazji każde nowe pytanie leciało do Nominatim, który za
 *     przekraczanie limitu blokuje po adresie IP - i to bez ostrzeżenia.
 *   - `/api/zapis-na-otwarcie` wysyła list na KAŻDY nowy adres. Powtórki nie wysyłają nic,
 *     ale tysiąc różnych adresów to tysiąc listów z naszej domeny do obcych ludzi -
 *     maszynka do zasypywania cudzych skrzynek i do spalenia reputacji domeny.
 *   - `/api/wizyta` i `/api/obecnosc` dopisują wiersz na skrót adresu IP - czyli rosną.
 *
 * ------------------------------------------------------------------ czego to NIE robi
 *
 * Licznik żyje w pamięci JEDNEJ instancji funkcji, a Vercel trzyma ich kilka naraz
 * i wygasza po bezczynności. Prawdziwy limit rozproszony jest w bazie
 * (`limit_zapytan`) i tam idą rzeczy rzadkie i drogie - poczta. Tutaj zostaje to, co
 * musi być darmowe: odsianie jednego źródła walącego w pętli. Przy N instancjach limit
 * jest N razy luźniejszy, więc ustawiam go tak, żeby N-krotność wciąż była nieszkodliwa.
 *
 * ------------------------------------------------------------------ pierwsza zapora stoi wyżej
 *
 * Od 11 września 2026 przed tym wszystkim stoi reguła w Cloudflare: więcej niż 50 żądań
 * na `/api/` w 10 sekund z jednego adresu IP = blokada tego adresu na 10 sekund.
 *
 * To jest ważniejsze, niż wygląda, bo limity w tym pliku i te w bazie już kosztują.
 * Zanim któryś z nich powie „za dużo", żądanie przeszło przez funkcję na Vercelu i zwykle
 * też przez zapytanie do Supabase - czyli policzyło się na obu rachunkach. Reguła
 * w Cloudflare odbija ruch na brzegu, zanim dotknie czegokolwiek naszego.
 *
 * Darmowy plan Cloudflare daje DOKŁADNIE JEDNĄ taką regułę i zawęża ją do jednego
 * kształtu: charakterystyka tylko po IP, okno tylko 10 sekund, blokada tylko 10 sekund,
 * akcja tylko „zablokuj" (żadnego łagodnego wyzwania). Stąd próg z zapasem: twarda
 * blokada, która trafi nie tego, kogo trzeba, jest gorsza niż przepuszczenie paru żądań,
 * a pod jednym adresem IP potrafi siedzieć całe osiedle albo pół sieci komórkowej.
 *
 * Sprawdzone po wdrożeniu na produkcji:
 *   - 200 żądań w 2,6 s → 71 przeszło, 129 odbitych (429),
 *   - w trakcie blokady `/api/` oddaje 429, ale strony (`/`, `/wkrotce`) dalej 200,
 *   - po 15 sekundach wszystko wraca samo,
 *   - tempo 13 żądań na 10 s (grubo powyżej tego, co robi człowiek) → 40 na 40 przeszło.
 */

import { supabasePublic } from "./supabase/publiczny";

interface Kubelek {
  /** numer okna czasowego */
  okno: number;
  ile: number;
}

/*
  Mapa musi mieć sufit, bo inaczej sama byłaby dziurą: dość podać za każdym żądaniem inny
  klucz, żeby zjeść pamięć instancji. Przy przepełnieniu czyścimy ją całą - limity na
  chwilę puszczają, ale pamięć nie rośnie. Klucz to adres IP, a tych realnych jest garść,
  więc do sufitu dochodzi tylko atak.
*/
const MAKS_KLUCZY = 20_000;
const liczniki = new Map<string, Kubelek>();

export interface Przepustka {
  ok: boolean;
  /** ile sekund do zwolnienia okna */
  poczekaj: number;
}

/**
 * Czy wolno wykonać żądanie.
 *
 * Okno stałe, nie przesuwne: przy przesuwnym trzeba trzymać listę znaczników czasu na
 * każdy klucz, czyli tyle pamięci, ile ruchu. Stałe okno kosztuje dwie liczby i różni się
 * tylko tym, że na styku dwóch okien przepuszcza do dwóch porcji - przy limitach z takim
 * zapasem jak tutaj to bez znaczenia.
 */
export function przepustka(
  kubelek: string,
  klucz: string | null,
  ile: number,
  oknoS: number
): Przepustka {
  /* nie da się przypisać żądania do nikogo - lepiej przepuścić niż rozliczać wszystkich razem */
  if (!klucz) return { ok: true, poczekaj: 0 };

  const teraz = Date.now();
  const okno = Math.floor(teraz / (oknoS * 1000));
  const id = `${kubelek}|${klucz}`;

  if (liczniki.size > MAKS_KLUCZY) liczniki.clear();

  const wpis = liczniki.get(id);
  if (!wpis || wpis.okno !== okno) {
    liczniki.set(id, { okno, ile: 1 });
    return { ok: true, poczekaj: 0 };
  }

  wpis.ile += 1;
  if (wpis.ile > ile) {
    const koniec = (okno + 1) * oknoS * 1000;
    return { ok: false, poczekaj: Math.max(1, Math.ceil((koniec - teraz) / 1000)) };
  }

  return { ok: true, poczekaj: 0 };
}

/**
 * Limit WSPÓLNY dla wszystkich instancji - licznik stoi w bazie.
 *
 * Limit z pamięci wyżej ma wadę, której nie da się z niego usunąć: im większy ruch, tym
 * więcej instancji trzyma Vercel, tym luźniejszy limit. Przy jednej instancji trzydzieści
 * zapytań na minutę, przy dziesięciu - trzysta.
 *
 * Dla większości tras to akceptowalne, bo koszt przekroczenia ponosimy my i jest
 * policzalny. Jest jedna trasa, gdzie koszt ponosi ktoś inny: `/api/geo` pośredniczy do
 * Nominatim, a regulamin OSM liczy zapytania NA ŹRÓDŁO - źródłem jesteśmy my, jednym
 * adresem IP. Za przekroczenie Nominatim blokuje po adresie, bez ostrzeżenia i bez
 * terminu. Tego nie da się odkupić, więc tam limit musi znać wszystkie instancje naraz.
 *
 * ------------------------------------------------------------------ przepuszcza po awarii
 *
 * Gdy baza nie odpowie, funkcja mówi „wolno". Odwrotna decyzja zamieniłaby chwilową
 * niedostępność bazy w niedostępność wyszukiwarki adresów - a limit z pamięci i tak
 * stoi obok i łapie najgorszy przypadek. Zapora, która przy własnej awarii zamyka drzwi
 * na klucz, jest gorsza od tej, która ich wtedy nie pilnuje.
 */
export async function przepustkaWspolna(
  kubelek: string,
  klucz: string | null,
  ile: number,
  oknoS: number
): Promise<Przepustka> {
  if (!klucz) return { ok: true, poczekaj: 0 };

  const supabase = supabasePublic();
  if (!supabase) return { ok: true, poczekaj: 0 };

  try {
    const { data, error } = await supabase.rpc("przepustka_wspolna", {
      p_kubelek: kubelek,
      p_klucz: klucz,
      p_ile: ile,
      p_okno_s: oknoS,
    });

    /* brak funkcji (migracja nie puszczona) wygląda jak każdy inny błąd - przepuszczamy */
    if (error || typeof data !== "number") return { ok: true, poczekaj: 0 };

    return data > 0 ? { ok: false, poczekaj: data } : { ok: true, poczekaj: 0 };
  } catch {
    return { ok: true, poczekaj: 0 };
  }
}

/** Odpowiedź na przekroczony limit - z nagłówkiem, po którym klient wie, kiedy wrócić. */
export function zaDuzo(poczekaj: number, powod = "Za dużo żądań. Spróbuj za chwilę.") {
  return Response.json(
    { blad: powod, poczekaj },
    {
      status: 429,
      headers: {
        "Retry-After": String(poczekaj),
        "Cache-Control": "no-store",
      },
    }
  );
}
