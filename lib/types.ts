export type CourtType = "otwarty" | "kryty" | "streetball";

export type Surface =
  | "beton"
  | "asfalt"
  | "tartan"
  | "poliuretan"
  | "parkiet"
  | "syntetyk";

export type Access = "24h" | "godziny" | "ograniczony";

export type PhotoKind =
  | "narożnik"
  | "narożnik-2"
  | "kosz-a"
  | "kosz-b"
  | "detal-kosza"
  | "nawierzchnia"
  | "ogólne-1"
  | "ogólne-2";

/** Nazwy kadrów pokazywane w panelu i w podpisach galerii. */
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  "narożnik": "Narożnik TYTUŁOWE",
  "narożnik-2": "Narożnik 2",
  "kosz-a": "Kosz A",
  "kosz-b": "Kosz B",
  "detal-kosza": "Kosz detal",
  nawierzchnia: "Nawierzchnia",
  "ogólne-1": "Ogólne 1",
  "ogólne-2": "Ogólne 2",
};

export interface CourtPhotoRef {
  kind: PhotoKind;
  /** Docelowo URL ze Storage. Brak = render placeholdera. */
  url?: string;
  caption: string;
}

export interface Court {
  id: string;
  slug: string;
  name: string;
  city: string;
  voivodeship: string;
  lat: number;
  lng: number;
  type: CourtType;
  surface: Surface;
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Access;
  /** np. "06:00 - 22:00" albo "całą dobę" */
  hours: string;
  likes: number;
  /** wyróżnienie od administratora */
  basketApproved: boolean;
  /** 2-3 zdania od twórcy, pokazywane w wyróżnionej sekcji */
  basketNote?: string;
  addedBy: string;
  addedAt: string;
  description: string;
  photos: CourtPhotoRef[];
  /** ziarno do generowania placeholderów zdjęć */
  seed: number;
}

export const VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
] as const;

export const SURFACE_LABEL: Record<Surface, string> = {
  beton: "Beton",
  asfalt: "Asfalt",
  tartan: "Tartan",
  poliuretan: "Poliuretan",
  parkiet: "Parkiet",
  syntetyk: "Trawa syntetyczna",
};

export const TYPE_LABEL: Record<CourtType, string> = {
  otwarty: "Otwarty",
  kryty: "Kryty",
  streetball: "Streetball",
};

export const ACCESS_LABEL: Record<Access, string> = {
  "24h": "Całodobowo",
  godziny: "W godzinach",
  ograniczony: "Ograniczony dostęp",
};

export const PHOTO_STEPS: { kind: PhotoKind; title: string; hint: string }[] = [
  {
    kind: "narożnik",
    title: "Całe boisko z narożnika",
    hint: "Stań w rogu boiska. W kadrze ma się zmieścić cała płyta i oba kosze.",
  },
  {
    kind: "kosz-a",
    title: "Na wprost pierwszego kosza",
    hint: "Ustaw się dokładnie naprzeciw tablicy, kosz na środku kadru.",
  },
  {
    kind: "kosz-b",
    title: "Na wprost drugiego kosza",
    hint: "To samo z drugiej strony. Jeśli jest tylko jeden kosz — pomiń ten krok.",
  },
  {
    kind: "detal-kosza",
    title: "Detal kosza",
    hint: "Zbliżenie na obręcz i siatkę — widać stan sprzętu.",
  },
  {
    kind: "ogólne-2",
    title: "Ogólne z innego miejsca",
    hint: "Drugie ujęcie całości, z przeciwnej strony niż zdjęcie nr 1.",
  },
  {
    kind: "nawierzchnia",
    title: "Detal nawierzchni",
    hint: "Kadr z góry na podłoże — widać materiał, spękania i linie.",
  },
];
