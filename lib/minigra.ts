/**
 * Minigra „rzut do kosza" - easter egg ukryty na mapie.
 *
 * Dwie niebieskie pinezki stoją tam, gdzie żadnego polskiego boiska nie ma i nie będzie:
 * na Venice Beach i na Manhattanie. Kliknięcie w taką pinezkę zabiera do minigry. Każde
 * miejsce ma własne tło i własny ranking - to dwie osobne tablice wyników, nie jedna.
 *
 * Plik jest wspólny dla serwera i przeglądarki: mapa potrzebuje współrzędnych, podstrona
 * gry potrzebuje nazw i opisów, a baza kluczy `miejsce`.
 */

export type IdMiejsca = "venice" | "manhattan";

export interface MiejsceGry {
  id: IdMiejsca;
  slug: string;
  nazwa: string;
  miasto: string;
  /* podpis na pinezce i w nagłówku podstrony */
  opis: string;
  lat: number;
  lng: number;
}

export const MIEJSCA_GRY: MiejsceGry[] = [
  {
    id: "venice",
    slug: "venice-beach",
    nazwa: "Venice Beach",
    miasto: "Los Angeles",
    opis: "Najsłynniejszy asfalt świata, dwa kroki od oceanu.",
    lat: 33.98663,
    lng: -118.47281,
  },
  {
    id: "manhattan",
    slug: "manhattan",
    nazwa: "Manhattan",
    miasto: "Nowy Jork",
    opis: "Kosz między kamienicami, w cieniu mostu.",
    lat: 40.699555,
    lng: -73.999078,
  },
];

export function miejsceZeSlugu(slug: string): MiejsceGry | null {
  return MIEJSCA_GRY.find((m) => m.slug === slug) ?? null;
}

/* ---------------------------------------------------------------- poziomy */

/**
 * Jak gra się zaostrza wraz z serią trafień.
 *
 * Progi są celowo rzadkie na początku: pierwsze dwadzieścia rzutów ma być spokojne, żeby
 * ktoś, kto wpadł tu przez przypadek, zdążył zrozumieć zasady. Dopiero potem kosz zaczyna
 * uciekać - najpierw w jednej osi, potem w dwóch, na końcu szybciej.
 *
 * Piłka zmienia się razem z poziomem i jest to ta sama piłka co w odznaczeniach: żar,
 * iskra, płomień i błękitny ogień na szczycie. Kto dojdzie do czterdziestu trafień pod
 * rząd, rzuca dokładnie tym, co na profilu oznacza najwyższy stopień.
 */
export interface Poziom {
  /* od ilu trafień pod rząd obowiązuje */
  od: number;
  nazwa: string;
  /* plik piłki z public/odznaczenia */
  pilka: "zar" | "iskra" | "plomien" | "niebieski";
  /* wychylenie kosza w bok i w pionie, w ułamku szerokości/wysokości planszy */
  bok: number;
  pion: number;
  /* mnożnik tempa ruchu kosza */
  tempo: number;
}

export const POZIOMY_GRY: Poziom[] = [
  { od: 0, nazwa: "Żar", pilka: "zar", bok: 0, pion: 0, tempo: 1 },
  { od: 20, nazwa: "Iskra", pilka: "iskra", bok: 0.16, pion: 0, tempo: 1 },
  { od: 30, nazwa: "Płomień", pilka: "plomien", bok: 0, pion: 0.09, tempo: 1.1 },
  { od: 40, nazwa: "Ogień", pilka: "niebieski", bok: 0.16, pion: 0.09, tempo: 1.2 },
  { od: 60, nazwa: "Ogień", pilka: "niebieski", bok: 0.2, pion: 0.11, tempo: 1.9 },
];

/** Poziom dla danej serii trafień. */
export function poziomDlaSerii(seria: number): Poziom {
  let wynik = POZIOMY_GRY[0];
  for (const p of POZIOMY_GRY) if (seria >= p.od) wynik = p;
  return wynik;
}

/** Górna granica wyniku przyjmowanego przez bazę - zwykły bezpiecznik. */
export const MAKS_SERIA = 500;
