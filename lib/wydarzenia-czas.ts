/**
 * Wydarzenie i jego czas - same reguły, bez ani jednego odwołania do bazy i przeglądarki.
 *
 * Osobny plik od `lib/wydarzenia.ts` z tego samego powodu, co `lib/gra/fizyka.ts` obok
 * planszy gry: tamten ciągnie klienta Supabase, więc nie da się go wczytać w Node, a to
 * są funkcje, które WARTO sprawdzać liczbami. Opisy czasu („jutro", „za 3 dni") to
 * arytmetyka na kalendarzu w konkretnej strefie i najłatwiejsze miejsce na cichą pomyłkę
 * o jeden dzień.
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
  /**
   * Proporcja plakatu (szerokość / wysokość) albo `null`, gdy nieznana.
   *
   * Od niej zależy układ boxa na karcie boiska: pion dostaje wysoką kartę w prawej
   * kolumnie, poziom - szeroki pas nad kafelkami. Liczba jest zapisywana przy wgrywaniu
   * pliku, bo karta boiska powstaje na serwerze i nie może czekać z układem na to, aż
   * przeglądarka wczyta obrazek.
   */
  proporcje: number | null;
}

/** Czy plakat jest „wysoki" - pion albo kwadrat. Próg 0,95, bo 1:1 czyta się jak poziom. */
export function wysokiPlakat(w: Wydarzenie) {
  return w.zdjecie !== null && w.proporcje !== null && w.proporcje < 0.95;
}

/* ---------------------------------------------------------------- czas */

export type StanWydarzenia = "trwa" | "dzis" | "wkrotce" | "minelo";

/*
  WSZYSTKO LICZYMY W CZASIE WARSZAWSKIM, jawnie.

  Te same funkcje wołane są na serwerze (karta boiska, treść listu) i w przeglądarce
  (wizytówka na mapie, panel). Serwer Vercela chodzi w UTC, więc bez wskazania strefy
  turniej od 18:00 pojawiłby się w mailu jako „16:00", a wydarzenie zaczynające się
  o 1:00 w nocy wypadałoby w mailu na dzień wcześniej. Strefa jest tu więc częścią
  poprawności, nie ustawieniem regionalnym.
*/
const STREFA = "Europe/Warsaw";

const DATA = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", timeZone: STREFA });
const GODZINA = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STREFA,
});
const DZIEN_TYGODNIA = new Intl.DateTimeFormat("pl-PL", { weekday: "long", timeZone: STREFA });
/** „2026-10-12" w czasie warszawskim - do porównywania dni bez pomyłki o strefę */
const DZIEN = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: STREFA,
});

function dzien(t: number) {
  return DZIEN.format(new Date(t));
}

export function stanWydarzenia(w: Wydarzenie, teraz = Date.now()): StanWydarzenia {
  const od = Date.parse(w.poczatek);
  const do_ = Date.parse(w.koniec);
  if (teraz >= do_) return "minelo";
  if (teraz >= od) return "trwa";

  return dzien(od) === dzien(teraz) ? "dzis" : "wkrotce";
}

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
  if (stan === "dzis") return `dziś ${godziny(w)}`;

  const od = Date.parse(w.poczatek);
  if (dzien(od) === dzien(teraz + 86_400_000)) return `jutro ${godziny(w)}`;

  const start = new Date(od);
  return `${DZIEN_TYGODNIA.format(start)}, ${DATA.format(start)}, ${godziny(w)}`;
}

/**
 * Krótka plakietka stanu - na wizytówkę nad pinezką i na box.
 *
 * Dni liczymy KALENDARZOWO, a nie w ułamkach doby, i to jest naprawa widocznej
 * niespójności: wydarzenie zaczynające się nazajutrz o 16:00, oglądane po południu dnia
 * poprzedniego, jest w odległości 26 godzin - czyli „za 2 dni" po zaokrągleniu w górę,
 * podczas gdy zdanie obok mówiło „jutro 16:00-19:00". Człowiek nie liczy dobami od teraz,
 * tylko przewraca kartki kalendarza, więc plakietka musi robić to samo.
 */
export function plakietka(w: Wydarzenie, teraz = Date.now()) {
  const stan = stanWydarzenia(w, teraz);
  if (stan === "trwa") return "trwa teraz";
  if (stan === "dzis") return "dziś";

  const dni = roznicaDni(teraz, Date.parse(w.poczatek));
  return dni <= 1 ? "jutro" : `za ${dni} dni`;
}

/** Ile kartek kalendarza (warszawskiego) między dwiema chwilami. */
function roznicaDni(od: number, do_: number) {
  const a = Date.parse(`${dzien(od)}T00:00:00Z`);
  const b = Date.parse(`${dzien(do_)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
