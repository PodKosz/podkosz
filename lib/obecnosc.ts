/**
 * Warunek obecności: boisko dodaje się stojąc na nim.
 *
 * Do tej pory kreator brał pozycję z GPS-u, ale zaraz pod spodem stały pola na ręczne
 * wpisanie współrzędnych - więc równie dobrze dało się dodać boisko z drugiego końca kraju,
 * z mapy w drugiej karcie. A zgłoszenie robione na miejscu jest warte więcej: pinezka trafia
 * tam, gdzie naprawdę są kosze, zdjęcia są z tego samego dnia, a nazwa i godziny biorą się
 * z tabliczki na bramie, a nie z domysłu.
 *
 * Reguła ma dwa warunki i oba muszą być spełnione:
 *
 *   1. Odczyt GPS musi być na tyle dokładny, żeby cokolwiek znaczył. Przy niepewności
 *      rzędu dwustu metrów zdanie „jesteś nie dalej niż 25 m od pinezki" nie jest ani
 *      prawdziwe, ani fałszywe - jest bez treści.
 *   2. Pinezka może odejść od odczytu najwyżej o `PROMIEN_OBECNOSCI_M`. Ręczna poprawka
 *      zostaje, bo bywa potrzebna - stoi się przy siatce, a pinezka ma trafić na środek
 *      płyty - ale dalej niż na drugą stronę boiska nie sięgnie.
 *
 * Czym to NIE jest: dowodem. Pozycję z przeglądarki da się podmienić w narzędziach
 * deweloperskich i żadne sprawdzenie po naszej stronie tego nie wykryje - serwer dostaje
 * dwie liczby i musi im uwierzyć. To jest próg wysiłku, nie zamek. Zatrzyma dodawanie
 * boisk „z Google Maps przy kawie", nie zatrzyma kogoś, kto się uprze.
 */

/** Ile metrów od odczytu GPS może stać pinezka. */
export const PROMIEN_OBECNOSCI_M = 25;

/**
 * Powyżej tylu metrów niepewności odczyt uznajemy za bezużyteczny.
 *
 * Telefon na otwartym boisku podaje zwykle 5-15 m. Czterdzieści to zapas na gorszy sprzęt
 * i drzewa nad głową; przy większych wartościach jesteśmy zwykle na pozycji z sieci
 * komórkowej albo z Wi-Fi, a ta potrafi minąć się z prawdą o kilometr.
 */
export const MAKS_NIEPEWNOSC_M = 40;

export interface OdczytGps {
  lat: number;
  lng: number;
  /** `coords.accuracy` z przeglądarki, w metrach */
  dokladnosc: number;
}

/** Odległość między dwoma punktami w metrach (wzór haversine, promień średni Ziemi). */
export function odlegloscM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type OcenaObecnosci =
  | { ok: true; odleglosc: number }
  | { ok: false; powod: "brak-odczytu" | "za-slaby-sygnal" | "za-daleko"; komunikat: string; odleglosc?: number };

/**
 * Czy z tym odczytem i tą pinezką wolno dodać boisko.
 *
 * Zwraca gotowy komunikat, a nie sam kod błędu: to samo zdanie ma się pojawić i pod
 * przyciskiem, i przy polach ze współrzędnymi, więc nie ma powodu układać go dwa razy.
 */
export function ocenObecnosc(
  odczyt: OdczytGps | null,
  pin: { lat: number; lng: number } | null
): OcenaObecnosci {
  if (!odczyt || !pin) {
    return {
      ok: false,
      powod: "brak-odczytu",
      komunikat: "Pobierz lokalizację - boisko dodajesz, stojąc na nim.",
    };
  }

  if (odczyt.dokladnosc > MAKS_NIEPEWNOSC_M) {
    return {
      ok: false,
      powod: "za-slaby-sygnal",
      komunikat:
        `Sygnał jest za słaby (±${Math.round(odczyt.dokladnosc)} m), żeby potwierdzić, ` +
        "że stoisz na boisku. Wyjdź na otwartą przestrzeń i pobierz lokalizację jeszcze raz.",
    };
  }

  const odleglosc = odlegloscM(odczyt, pin);
  if (odleglosc > PROMIEN_OBECNOSCI_M) {
    return {
      ok: false,
      powod: "za-daleko",
      odleglosc,
      komunikat:
        `Pinezka stoi ${Math.round(odleglosc)} m od Ciebie, a może odejść najwyżej ` +
        `o ${PROMIEN_OBECNOSCI_M} m. Podejdź na boisko i pobierz lokalizację jeszcze raz.`,
    };
  }

  return { ok: true, odleglosc };
}

/* ------------------------------------------------------------------ */
/*  Ocena śladu GPS w panelu moderacji                                 */
/* ------------------------------------------------------------------ */

/**
 * Poniżej tylu metrów niepewności odczyt jest zbyt dobry, żeby być prawdziwy.
 *
 * Telefon z porządnym widokiem nieba podaje 4-8 m i to jest jego sufit; jednego metra
 * nie osiąga sprzęt, który ludzie noszą w kieszeni. Za to podmiana pozycji w narzędziach
 * deweloperskich wpisuje w to pole to, co się jej podało - najczęściej zero albo jedynkę,
 * bo nikt nie zgaduje, jak wygląda wiarygodna niepewność.
 */
const PODEJRZANIE_DOKLADNY_M = 2;

export type StanSladu = "ok" | "podejrzane" | "brak";

export interface OcenaSladu {
  stan: StanSladu;
  /** jedno zdanie dla administratora - dlaczego taki stan */
  powod: string;
}

/**
 * Co panel ma powiedzieć o śladzie GPS zgłoszenia.
 *
 * To ocena, nie wyrok. Sprawdzenie obecności działa w przeglądarce, więc każdą liczbę,
 * która tu przychodzi, można było podstawić - żadna wartość niczego nie dowodzi.
 * Sensowne jest tylko jedno pytanie: czy te liczby wyglądają jak z telefonu stojącego
 * na boisku, czy jak wpisane ręcznie. Odpowiedź „podejrzane" znaczy „popatrz uważniej",
 * a nie „odrzuć".
 *
 * Brak danych jest osobnym stanem, nie podejrzeniem. Zgłoszenia sprzed wprowadzenia
 * pomiaru obecności nie mają czego pokazać i nie ma w tym niczyjej winy.
 */
export function ocenSlad(dokladnosc?: number, odleglosc?: number): OcenaSladu {
  if (dokladnosc === undefined && odleglosc === undefined) {
    return {
      stan: "brak",
      powod: "Zgłoszenie bez śladu GPS - sprzed pomiaru obecności albo z pominięciem kreatora.",
    };
  }

  if (dokladnosc === undefined) {
    return { stan: "podejrzane", powod: "Brak dokładności odczytu, choć odległość jest zapisana." };
  }

  if (dokladnosc > MAKS_NIEPEWNOSC_M) {
    return {
      stan: "podejrzane",
      powod: `Odczyt ±${Math.round(dokladnosc)} m - kreator takiego nie przepuszcza (próg ${MAKS_NIEPEWNOSC_M} m).`,
    };
  }

  if (dokladnosc < PODEJRZANIE_DOKLADNY_M) {
    return {
      stan: "podejrzane",
      powod: `Odczyt ±${Math.round(dokladnosc)} m jest zbyt dokładny na telefon - tak wygląda pozycja podstawiona.`,
    };
  }

  if (odleglosc !== undefined && odleglosc > PROMIEN_OBECNOSCI_M) {
    return {
      stan: "podejrzane",
      powod: `Pinezka ${Math.round(odleglosc)} m od odczytu - kreator puszcza najwyżej ${PROMIEN_OBECNOSCI_M} m.`,
    };
  }

  if (odleglosc === undefined) {
    return {
      stan: "brak",
      powod: "Jest dokładność, nie ma odległości pinezki - zgłoszenie sprzed pomiaru obecności.",
    };
  }

  return {
    stan: "ok",
    powod:
      `Odczyt ±${Math.round(dokladnosc)} m, pinezka ${Math.round(odleglosc)} m od niego - ` +
      "liczby wyglądają jak z telefonu na miejscu.",
  };
}
