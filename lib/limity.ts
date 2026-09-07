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
 */

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
