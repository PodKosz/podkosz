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
