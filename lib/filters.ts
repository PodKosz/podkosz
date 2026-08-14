import { Access, Court, CourtType, Surface } from "./types";

export interface Filters {
  q: string;
  types: Record<CourtType, boolean>;
  surfaces: Surface[];
  voivodeship: string;
  minLikes: number;
  access: Access | "";
  onlyLit: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  types: { otwarty: true, kryty: true, streetball: true },
  surfaces: [],
  voivodeship: "",
  minLikes: 0,
  access: "",
  onlyLit: false,
};

const DIACRITICS: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

export function normalize(s: string) {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c);
}

export function applyFilters(courts: Court[], f: Filters): Court[] {
  const q = normalize(f.q.trim());
  return courts.filter((c) => {
    if (!f.types[c.type]) return false;
    if (f.surfaces.length && !f.surfaces.includes(c.surface)) return false;
    if (f.voivodeship && c.voivodeship !== f.voivodeship) return false;
    if (c.likes < f.minLikes) return false;
    if (f.access && c.access !== f.access) return false;
    if (f.onlyLit && !c.lit) return false;
    if (q) {
      const hay = normalize(
        `${c.name} ${c.city} ${c.voivodeship} ${c.surface} ${c.type}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function countByType(courts: Court[]): Record<CourtType, number> {
  return courts.reduce(
    (acc, c) => ({ ...acc, [c.type]: acc[c.type] + 1 }),
    { otwarty: 0, kryty: 0, streetball: 0 } as Record<CourtType, number>
  );
}
