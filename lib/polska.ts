/**
 * Czy punkt leży w Polsce.
 *
 * Serwis jest o polskich boiskach i dodawanie ma być możliwe tylko tutaj - z jednym
 * wyjątkiem: administrator dodaje wszędzie (na mapie stoją już Venice Beach i Manhattan
 * z minigrą, a i pierwsze boisko z wakacji ktoś kiedyś doda).
 *
 * ------------------------------------------------------------------ dwa sprawdzenia
 *
 * KRAJ Z GEOKODERA jest rozstrzygający, bo zna granicę. Polska nie jest prostokątem:
 * prostokąt obejmujący cały kraj bierze przy okazji kawał Czech, Słowacji, Litwy, obwodu
 * kaliningradzkiego i wschodniej Brandenburgii. Ktoś stojący na boisku w Ostrawie
 * zmieściłby się w prostokącie bez trudu.
 *
 * PROSTOKĄT jest zapasem na wypadek, gdy geokoder nie odpowie (limit zapytań, brak sieci,
 * zablokowany Nominatim). Wtedy lepiej wpuścić kogoś tuż za granicą niż odrzucić wszystkich
 * w Polsce - a odrzucenie i tak zostaje po stronie bazy, gdzie ten sam prostokąt pilnuje
 * zapisu (patrz `migration-brama-i-polska.sql`). Prostokąt jest z zapasem, żeby żadne
 * polskie boisko nie wypadło z niego przez zaokrąglenie.
 */

export const PROSTOKAT_POLSKI = {
  latOd: 48.9,
  latDo: 55.05,
  lngOd: 13.9,
  lngDo: 24.35,
};

export function wProstokacie(lat: number, lng: number) {
  return (
    lat >= PROSTOKAT_POLSKI.latOd &&
    lat <= PROSTOKAT_POLSKI.latDo &&
    lng >= PROSTOKAT_POLSKI.lngOd &&
    lng <= PROSTOKAT_POLSKI.lngDo
  );
}

export interface OcenaMiejsca {
  /** czy wolno tu dodać boisko */
  wolno: boolean;
  /** kod kraju, jeśli udało się go ustalić - do komunikatu */
  kraj: string | null;
  /** czy decyzja opiera się na geokoderze (pewna), czy na prostokącie (zapasowa) */
  pewne: boolean;
}

/**
 * Ocena miejsca na podstawie współrzędnych i - jeśli jest - kodu kraju z geokodera.
 *
 * `kraj` pusty albo `null` znaczy „nie wiem": wtedy decyduje prostokąt.
 */
export function ocenMiejsce(lat: number, lng: number, kraj?: string | null): OcenaMiejsca {
  const kod = (kraj ?? "").trim().toLowerCase();

  if (kod) return { wolno: kod === "pl", kraj: kod, pewne: true };

  return { wolno: wProstokacie(lat, lng), kraj: null, pewne: false };
}

/** Nazwy krajów sąsiednich po polsku - do komunikatu, żeby nie pokazywać kodu „ua". */
const NAZWY: Record<string, string> = {
  de: "Niemczech",
  cz: "Czechach",
  sk: "Słowacji",
  ua: "Ukrainie",
  by: "Białorusi",
  lt: "Litwie",
  ru: "Rosji",
};

/** Komunikat dla kogoś, kto stoi poza Polską. */
export function komunikatPozaPolska(kraj: string | null) {
  const gdzie = kraj && NAZWY[kraj] ? ` (wygląda na to, że jesteś w ${NAZWY[kraj]})` : "";
  return `Na razie działamy tylko w Polsce${gdzie}. Boiska spoza kraju dodamy, kiedy rozszerzymy mapę.`;
}
