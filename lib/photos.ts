import { PhotoKind } from "./types";

/**
 * Kolejność zdjęć na stronie — niezależna od tego, w jakiej kolejności trafiły do bazy.
 * Narożnik jest kadrem tytułowym: pokazuje całe boisko, więc najlepiej sprawdza się
 * w dymku nad pinezką i jako zdjęcie główne karty.
 * Uwaga: kolejność robienia zdjęć w kreatorze (PHOTO_STEPS) jest inna — tam nawierzchnia
 * wypada na końcu, bo to najwygodniejsze przy chodzeniu po boisku.
 */
export const PHOTO_DISPLAY_ORDER: PhotoKind[] = [
  "narożnik",
  "narożnik-2",
  "kosz-a",
  "kosz-b",
  "detal-kosza",
  "nawierzchnia",
  "ogólne-1",
  "ogólne-2",
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
