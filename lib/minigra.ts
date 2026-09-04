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

export type IdMiejsca = "venice" | "manhattan" | "chicago";

/**
 * Która gra stoi pod pinezką.
 *
 * Dwie różne gry, nie dwa poziomy jednej: „rzut" mierzy celność, „kozłowanie" rytm.
 * Rodzaj wybiera komponent planszy i tekst na ekranie tytułowym - poza tym reszta
 * (pełny ekran, tablica wyników, zapis rekordu) jest wspólna, bo to ta sama oprawa.
 */
export type RodzajGry = "rzut" | "kozlowanie";

/*
  Nazwa jest tym, co stoi na ekranie tytułowym, więc mówi wprost, w co się gra: „Minigra
  Rzuty" i „Minigra Kozły". Wspólny przedrostek trzyma je razem jako jedną rodzinę, a
  drugie słowo je rozdziela - i to ono zostaje w pamięci.
*/
export const NAZWY_GIER: Record<RodzajGry, { nazwa: string; jak: string }> = {
  rzut: {
    nazwa: "Minigra Rzuty",
    jak: "Pociągnij od piłki w stronę kosza - kierunek to kierunek rzutu, długość to siła. Kropki pokazują tor.",
  },
  kozlowanie: {
    nazwa: "Minigra Kozły",
    jak: "Stukaj w rytm piłki - liczy się uderzenie, gdy piłka dochodzi do przerywanej linii. Nietrafione stuknięcie podnosi ją z parkietu i zeruje serię. Masz minutę.",
  },
};

export interface MiejsceGry {
  id: IdMiejsca;
  rodzaj: RodzajGry;
  slug: string;
  nazwa: string;
  miasto: string;
  lat: number;
  lng: number;
}

export const MIEJSCA_GRY: MiejsceGry[] = [
  {
    id: "venice",
    rodzaj: "rzut",
    slug: "venice-beach",
    nazwa: "Venice Beach",
    miasto: "Los Angeles",
    lat: 33.98663,
    lng: -118.47281,
  },
  {
    id: "manhattan",
    rodzaj: "rzut",
    slug: "manhattan",
    nazwa: "Manhattan",
    miasto: "Nowy Jork",
    lat: 40.699555,
    lng: -73.999078,
  },
  {
    id: "chicago",
    rodzaj: "kozlowanie",
    slug: "chicago",
    nazwa: "Chicago",
    miasto: "Chicago",
    lat: 41.880706,
    lng: -87.674225,
  },
];

/** Ile sekund trwa runda kozłowania. */
export const CZAS_KOZLOWANIA = 60;

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
