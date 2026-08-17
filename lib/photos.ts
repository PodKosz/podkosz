import { PhotoKind } from "./types";

/**
 * Kolejność zdjęć na stronie — niezależna od tego, w jakiej kolejności trafiły do bazy.
 * Jest identyczna z kolejnością robienia zdjęć w kreatorze (PHOTO_STEPS): najpierw całość
 * z narożnika (kadr tytułowy — leci też do dymka nad pinezką), potem oba kosze, detale
 * i całość z drugiej strony. Dodatkowe ujęcia ogólne lądują na końcu galerii.
 */
export const PHOTO_DISPLAY_ORDER: PhotoKind[] = [
  "narożnik",
  "kosz-a",
  "kosz-b",
  "detal-kosza",
  "nawierzchnia",
  "ogólne-2",
  "narożnik-2",
  "ogólne-1",
  "ogólne-3",
];

const rank = (kind: PhotoKind) => {
  const i = PHOTO_DISPLAY_ORDER.indexOf(kind);
  return i === -1 ? PHOTO_DISPLAY_ORDER.length : i;
};

/**
 * Sortuje zdjęcia do wyświetlenia. Kadry spoza listy lądują na końcu,
 * a zdjęcia tego samego rodzaju zachowują kolejność ustawioną w panelu.
 */
export function orderPhotos<T extends { kind: PhotoKind }>(photos: T[]): T[] {
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => rank(a.photo.kind) - rank(b.photo.kind) || a.index - b.index)
    .map((entry) => entry.photo);
}
