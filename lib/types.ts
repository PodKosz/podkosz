export type CourtType = "otwarty" | "kryty" | "streetball";

export type Surface =
  | "beton"
  | "asfalt"
  | "poliuretan"
  | "plytki"
  | "parkiet"
  | "syntetyk";

export type Access = "24h" | "godziny" | "ograniczony";

/**
 * Kadry w kolejności, w jakiej się je robi i w jakiej lecą na karcie boiska.
 * Sześć pierwszych to zestaw obowiązkowy (kosz B wolno pominąć), trzy ostatnie
 * to dodatkowe ujęcia ogólne - nazwy `narożnik-2` i `ogólne-1` zostają, bo takie
 * kadry mają już zdjęcia wgrane wcześniej z panelu.
 */
export type PhotoKind =
  | "narożnik"
  | "kosz-a"
  | "kosz-b"
  | "detal-kosza"
  | "nawierzchnia"
  | "ogólne-2"
  | "narożnik-2"
  | "ogólne-1"
  | "ogólne-3";

/** Nazwy kadrów pokazywane w panelu i w podpisach galerii. */
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  "narożnik": "Całe boisko z narożnika",
  "kosz-a": "Kosz A",
  "kosz-b": "Kosz B",
  "detal-kosza": "Detal kosza",
  nawierzchnia: "Detal nawierzchni",
  "ogólne-2": "Całe boisko z drugiej strony",
  "narożnik-2": "Ogólne dodatkowe 1",
  "ogólne-1": "Ogólne dodatkowe 2",
  "ogólne-3": "Ogólne dodatkowe 3",
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
  /** limonkowa plakietka „Śmieszne boisko” */
  funny?: boolean;
  /** link do filmiku YouTube Shorts z boiska */
  shortsUrl?: string;
  /** 2-3 zdania od twórcy, pokazywane w wyróżnionej sekcji */
  basketNote?: string;
  addedBy: string;
  addedAt: string;
  description: string;
  photos: CourtPhotoRef[];
  /** ziarno do generowania placeholderów zdjęć */
  seed: number;
}

/**
 * Boisko w wersji na mapę i listę wyników: same wartości skalarne, bez zdjęć, opisu i
 * komentarzy. Przy kilku tysiącach wpisów zdjęcia stanowią większość wagi odpowiedzi
 * (kilka adresów po ~150 znaków na boisko), a mapa ani filtry ich nie potrzebują -
 * galeria dociąga się dopiero na karcie boiska albo w wizytówce nad pinezką.
 */
export type MapCourt = Pick<
  Court,
  | "id"
  | "slug"
  | "name"
  | "city"
  | "voivodeship"
  | "lat"
  | "lng"
  | "type"
  | "surface"
  | "hoops"
  | "lit"
  | "access"
  | "hours"
  | "likes"
  | "basketApproved"
  | "funny"
  | "seed"
>;

/** Zawężenie pełnego boiska do wersji mapowej - używane w trybie testowym bez bazy. */
export function toMapCourt(court: Court): MapCourt {
  return {
    id: court.id,
    slug: court.slug,
    name: court.name,
    city: court.city,
    voivodeship: court.voivodeship,
    lat: court.lat,
    lng: court.lng,
    type: court.type,
    surface: court.surface,
    hoops: court.hoops,
    lit: court.lit,
    access: court.access,
    hours: court.hours,
    likes: court.likes,
    basketApproved: court.basketApproved,
    funny: court.funny ?? false,
    seed: court.seed,
  };
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
  poliuretan: "Poliuretan",
  plytki: "Płytki modułowe",
  parkiet: "Parkiet",
  syntetyk: "Trawa syntetyczna",
};

/** Podpis nawierzchni odporny na wartości spoza listy (np. stary „tartan” w bazie). */
export const surfaceLabel = (surface: string) =>
  SURFACE_LABEL[surface as Surface] ?? surface.charAt(0).toUpperCase() + surface.slice(1);

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

export interface PhotoStep {
  kind: PhotoKind;
  title: string;
  /** jedno zdanie pod kafelkiem z przykładowym kadrem */
  hint: string;
  /** dłuższa podpowiedź - leci na ekran w trakcie robienia zdjęcia */
  tip: string;
  /** kadr do pominięcia jednym kliknięciem (boisko z jednym koszem) */
  skippable?: boolean;
  /** ponad obowiązkowy zestaw - użytkownik może dorzucić, ale nie musi */
  extra?: boolean;
}

/**
 * Ścieżka robienia zdjęć. Kolejność jest jednocześnie kolejnością na karcie boiska:
 * całość → kosz A → kosz B → detal kosza → nawierzchnia → całość z drugiej strony,
 * a na końcu do trzech dodatkowych ujęć ogólnych.
 */
export const PHOTO_STEPS: PhotoStep[] = [
  {
    kind: "narożnik",
    title: "Całe boisko z narożnika",
    hint: "Cała płyta i oba kosze w jednym kadrze - to zdjęcie tytułowe.",
    tip: "Cofnij się do samego rogu płyty i trzymaj telefon poziomo. Linia boczna powinna prowadzić w głąb kadru, a oba kosze zmieścić się w środku. To zdjęcie widać na mapie i na górze karty boiska.",
  },
  {
    kind: "kosz-a",
    title: "Kosz A na wprost",
    hint: "Na wprost tablicy, cały kosz ze słupkiem w kadrze.",
    tip: "Stań kilka metrów przed tablicą, dokładnie na jej środku. W kadrze ma być cała tablica, obręcz i słupek aż do ziemi - po tym poznać, czy kosz jest prosty i na jakiej wysokości.",
  },
  {
    kind: "kosz-b",
    title: "Kosz B na wprost",
    hint: "To samo z drugiej strony boiska.",
    tip: "Przejdź na drugą połowę i powtórz kadr. Jeśli boisko ma tylko jeden kosz, pomiń ten krok przyciskiem „boisko ma jeden kosz”.",
    skippable: true,
  },
  {
    kind: "detal-kosza",
    title: "Detal kosza",
    hint: "Zbliżenie na obręcz i siatkę.",
    tip: "Podejdź pod tablicę i skieruj telefon w górę tak, żeby obręcz wypełniła kadr. Najważniejsze jest to, czy siatka jest cała, czy to łańcuszek, czy sama obręcz.",
  },
  {
    kind: "nawierzchnia",
    title: "Detal nawierzchni",
    hint: "Kadr w dół na podłoże, z linią boiska.",
    tip: "Stań na linii i skieruj telefon w dół z wysokości pasa. Ma być widać fakturę, spękania i stan malowania - po tym ludzie oceniają, czy da się tu grać.",
  },
  {
    kind: "ogólne-2",
    title: "Całe boisko z drugiej strony",
    hint: "Drugie ujęcie całości - z przeciwnej strony niż kadr 1.",
    tip: "Przejdź na przeciwną stronę i zrób całość jeszcze raz. Dzięki temu widać otoczenie i to, co zasłaniało pierwsze zdjęcie: ogrodzenie, ławki, wejście.",
  },
  {
    kind: "narożnik-2",
    title: "Ogólne dodatkowe 1",
    hint: "Cokolwiek, co warto pokazać: otoczenie, wejście, oświetlenie.",
    tip: "Zestaw obowiązkowy masz już kompletny. Dodatkowe ujęcie to bonus - otoczenie boiska, wejście, lampy, ławki albo widok z drugiego narożnika.",
    extra: true,
  },
  {
    kind: "ogólne-1",
    title: "Ogólne dodatkowe 2",
    hint: "Drugi bonusowy kadr, jeśli masz co pokazać.",
    tip: "Kolejne dodatkowe ujęcie. Przydaje się, gdy boisko jest częścią większego kompleksu albo ma coś nietypowego.",
    extra: true,
  },
  {
    kind: "ogólne-3",
    title: "Ogólne dodatkowe 3",
    hint: "Ostatni bonusowy kadr.",
    tip: "Ostatnie dodatkowe ujęcie - więcej niż trzech bonusów nie zbieramy, żeby karty boisk zostały porównywalne.",
    extra: true,
  },
];

/** Kadry, bez których zgłoszenie nie przechodzi dalej (kosz B można pominąć). */
export const REQUIRED_PHOTO_STEPS = PHOTO_STEPS.filter((s) => !s.extra);

/** Dodatkowe ujęcia ogólne - do trzech, całkowicie opcjonalne. */
export const EXTRA_PHOTO_STEPS = PHOTO_STEPS.filter((s) => s.extra);
