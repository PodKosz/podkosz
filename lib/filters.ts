import { Access, CourtType, MapCourt, Siatka, Surface } from "./types";

/**
 * Liczba koszy w filtrze: jeden, dwa albo trzy i więcej. Powyżej dwóch dokładna liczba
 * nikomu nie jest potrzebna - liczy się, że gra się na kilku połowach naraz.
 */
export type KoszeFiltr = "1" | "2" | "3";

export const KOSZE_FILTR: [KoszeFiltr, string][] = [
  ["1", "1 kosz"],
  ["2", "2 kosze"],
  ["3", "3 i więcej"],
];

/** Kolejność i podpisy jak w pytaniu gracza: siatka, łańcuch, bez siatki. */
export const SIATKI_FILTR: [Siatka, string][] = [
  ["siatka", "Siatka"],
  ["lancuch", "Łańcuch"],
  ["brak", "Bez siatki"],
];

/**
 * Kto gra dziś: wszystkie boiska, tylko te, na które ktoś się dziś zapisał, albo tylko puste.
 * Źródłem są zapisy „Idę zagrać” na dziś - te same, od których płonie pinezka na mapie.
 */
export type KtoGra = "" | "gra" | "pusto";

export interface Filters {
  q: string;
  types: Record<CourtType, boolean>;
  surfaces: Surface[];
  voivodeship: string;
  minLikes: number;
  access: Access | "";
  onlyLit: boolean;
  siatki: Siatka[];
  kosze: KoszeFiltr[];
  ktoGra: KtoGra;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  types: { otwarty: true, kryty: true, streetball: true },
  surfaces: [],
  voivodeship: "",
  minLikes: 0,
  access: "",
  onlyLit: false,
  siatki: [],
  kosze: [],
  ktoGra: "",
};

const DIACRITICS: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

export function normalize(s: string) {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c);
}

const koszePasuja = (hoops: number, wybrane: KoszeFiltr[]) =>
  wybrane.some((k) => (k === "3" ? hoops >= 3 : hoops === Number(k)));

/**
 * `osoby` - ile osób zapisało się dziś na które boisko (tylko boiska z zapisami). Potrzebne
 * wyłącznie filtrowi „kto gra”; bez tej mapy każde boisko liczy się jako puste.
 */
export function applyFilters<T extends MapCourt>(
  courts: T[],
  f: Filters,
  osoby: Record<string, number> = {}
): T[] {
  const q = normalize(f.q.trim());
  return courts.filter((c) => {
    if (!f.types[c.type]) return false;
    if (f.surfaces.length && !f.surfaces.includes(c.surface)) return false;
    if (f.voivodeship && c.voivodeship !== f.voivodeship) return false;
    if (c.likes < f.minLikes) return false;
    if (f.access && c.access !== f.access) return false;
    if (f.onlyLit && !c.lit) return false;
    /* boisko, przy którym nikt nie podał siatki, nie pasuje do żadnej - nie zgadujemy */
    if (f.siatki.length && !(c.siatka && f.siatki.includes(c.siatka))) return false;
    if (f.kosze.length && !koszePasuja(c.hoops, f.kosze)) return false;
    if (f.ktoGra) {
      const ktosGra = (osoby[c.id] ?? 0) > 0;
      if (f.ktoGra === "gra" ? !ktosGra : ktosGra) return false;
    }
    if (q) {
      const hay = normalize(
        `${c.name} ${c.city} ${c.voivodeship} ${c.surface} ${c.type}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
