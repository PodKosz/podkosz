/**
 * Stałe adresowe serwisu. Trzymamy je w jednym miejscu, bo używa ich metadata (adresy
 * kanoniczne, obrazki do udostępniania), sitemapa i dane strukturalne.
 *
 * NEXT_PUBLIC_SITE_URL pozwala nadpisać adres w podglądach Vercela; domyślnie
 * wskazujemy domenę produkcyjną, żeby linki w metadanych nigdy nie były relatywne.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://podkosz.pl"
).replace(/\/$/, "");

export const SITE_NAME = "PodKosz";

export const SITE_DESCRIPTION =
  "Interaktywna mapa boisk do koszykówki w Polsce. Zdjęcia, nawierzchnia, liczba koszy i godziny dostępności - dodawane przez graczy.";

export const absolute = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Nazwa miasta lub województwa w postaci nadającej się na adres: „Zielona Góra" → „zielona-gora". */
export function slugifyPlace(name: string) {
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  };
  return name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
