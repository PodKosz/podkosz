import type { StyleSpecification } from "maplibre-gl";

/**
 * Podkład rastrowy pod wszystkie mapy w serwisie.
 *
 * CARTO w połowie 2026 zamknęło darmowe kafelki bez klucza - te same adresy, które od lat
 * chodziły anonimowo, zaczęły oddawać obrazek z napisem „API KEY REQUIRED" na całej mapie.
 * Stąd dwa warianty:
 *   - z kluczem (`NEXT_PUBLIC_CARTO_KEY`) lecimy dalej na CARTO, czyli na podkładzie, pod
 *     który dobrana jest reszta kolorystyki,
 *   - bez klucza schodzimy na ciemny podkład Esri, który klucza nie wymaga.
 *
 * Uwaga na nazwę parametru: CARTO oczekuje `key`, nie `api_key`. To osobny klucz do samych
 * podkładów, wydawany formularzem na carto.com/basemaps/apikey - NIE jest to token z panelu
 * dewelopera w CARTO Workspace, który służy do ich API danych i z kafelkami nie ma nic
 * wspólnego. Klucz jest darmowy do 5 mln kafelków miesięcznie pod warunkiem zostawienia
 * widocznej atrybucji CARTO i OpenStreetMap - stąd `attribution`.
 *
 * Funkcja, a nie stała, bo mapy w serwisie potrzebują dwóch różnych warstw: mapa główna
 * rysuje własne podpisy miast i chce kafelków bez napisów, a wybierak lokalizacji w panelu
 * administratora przeciwnie - tam podpisy ulic są całą wartością. Wcześniej wybierak miał
 * własną kopię tej definicji i został z nią przy zmianie zasad CARTO, więc administrator
 * ustawiał pinezkę na mapie zaklejonej znakiem wodnym.
 */
export function podkladMapy(
  warstwa: "dark_all" | "dark_nolabels" = "dark_nolabels"
): StyleSpecification["sources"][string] {
  const klucz = process.env.NEXT_PUBLIC_CARTO_KEY;

  if (klucz) {
    return {
      type: "raster",
      tiles: ["a", "b", "c"].map(
        (host) => `https://${host}.basemaps.cartocdn.com/${warstwa}/{z}/{x}/{y}@2x.png?key=${klucz}`
      ),
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    };
  }

  return {
    type: "raster",
    /* uwaga na kolejność: Esri podaje kafelki jako {z}/{y}/{x}, nie {z}/{x}/{y} */
    tiles: [
      warstwa === "dark_all"
        ? "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        : "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
    maxzoom: 16,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Esri',
  };
}

/**
 * Warstwa z podpisami ulic i miejscowości dla wybieraka lokalizacji.
 *
 * Esri trzyma etykiety w osobnym serwisie niż tło. Na mapie głównej nie są potrzebne
 * (rysujemy własne), ale przy stawianiu pinezki bez nazw ulic nie da się pracować.
 * Zwraca `null`, gdy jedziemy na CARTO - tam podpisy są już w kafelku `dark_all`.
 */
export function podpisyMapy(): StyleSpecification["sources"][string] | null {
  if (process.env.NEXT_PUBLIC_CARTO_KEY) return null;

  return {
    type: "raster",
    tiles: [
      "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
    maxzoom: 16,
  };
}
