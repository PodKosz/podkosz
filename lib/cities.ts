/**
 * Polskie etykiety miast - kafelki CARTO są anglojęzyczne, więc bazę bierzemy bez
 * podpisów (`dark_nolabels`) i rysujemy własną warstwę nazw.
 * `rank` steruje tym, przy jakim zoomie nazwa się pojawia.
 */
export interface City {
  name: string;
  lat: number;
  lng: number;
  rank: 1 | 2 | 3;
}

export const CITIES: City[] = [
  { name: "Warszawa", lat: 52.2297, lng: 21.0122, rank: 1 },
  { name: "Kraków", lat: 50.0647, lng: 19.945, rank: 1 },
  { name: "Łódź", lat: 51.7592, lng: 19.4559, rank: 1 },
  { name: "Wrocław", lat: 51.1079, lng: 17.0385, rank: 1 },
  { name: "Poznań", lat: 52.4064, lng: 16.9252, rank: 1 },
  { name: "Gdańsk", lat: 54.352, lng: 18.6466, rank: 1 },
  { name: "Szczecin", lat: 53.4285, lng: 14.5528, rank: 1 },
  { name: "Bydgoszcz", lat: 53.1235, lng: 18.0084, rank: 1 },
  { name: "Lublin", lat: 51.2465, lng: 22.5684, rank: 1 },
  { name: "Katowice", lat: 50.2649, lng: 19.0238, rank: 1 },

  { name: "Białystok", lat: 53.1325, lng: 23.1688, rank: 2 },
  { name: "Gdynia", lat: 54.5189, lng: 18.5305, rank: 2 },
  { name: "Częstochowa", lat: 50.8118, lng: 19.1203, rank: 2 },
  { name: "Radom", lat: 51.4027, lng: 21.1471, rank: 2 },
  { name: "Toruń", lat: 53.0138, lng: 18.5984, rank: 2 },
  { name: "Rzeszów", lat: 50.0413, lng: 21.999, rank: 2 },
  { name: "Kielce", lat: 50.8661, lng: 20.6286, rank: 2 },
  { name: "Olsztyn", lat: 53.7784, lng: 20.4801, rank: 2 },
  { name: "Zielona Góra", lat: 51.9356, lng: 15.5062, rank: 2 },
  { name: "Opole", lat: 50.6751, lng: 17.9213, rank: 2 },
  { name: "Gorzów Wlkp.", lat: 52.7368, lng: 15.2288, rank: 2 },

  { name: "Sosnowiec", lat: 50.2863, lng: 19.104, rank: 3 },
  { name: "Gliwice", lat: 50.2945, lng: 18.6714, rank: 3 },
  { name: "Zabrze", lat: 50.3249, lng: 18.7857, rank: 3 },
  { name: "Bielsko-Biała", lat: 49.8224, lng: 19.0584, rank: 3 },
  { name: "Rybnik", lat: 50.0971, lng: 18.5416, rank: 3 },
  { name: "Tarnów", lat: 50.0121, lng: 20.9858, rank: 3 },
  { name: "Nowy Sącz", lat: 49.6217, lng: 20.6971, rank: 3 },
  { name: "Płock", lat: 52.5468, lng: 19.7064, rank: 3 },
  { name: "Elbląg", lat: 54.1522, lng: 19.4088, rank: 3 },
  { name: "Koszalin", lat: 54.1943, lng: 16.1722, rank: 3 },
  { name: "Słupsk", lat: 54.4641, lng: 17.0287, rank: 3 },
  { name: "Legnica", lat: 51.2107, lng: 16.1619, rank: 3 },
  { name: "Wałbrzych", lat: 50.7714, lng: 16.2845, rank: 3 },
  { name: "Kalisz", lat: 51.7611, lng: 18.091, rank: 3 },
  { name: "Włocławek", lat: 52.6483, lng: 19.0677, rank: 3 },
  { name: "Chełm", lat: 51.1431, lng: 23.4716, rank: 3 },
  { name: "Suwałki", lat: 54.1116, lng: 22.9309, rank: 3 },
  { name: "Przemyśl", lat: 49.7838, lng: 22.7677, rank: 3 },
  { name: "Piła", lat: 53.1516, lng: 16.7381, rank: 3 },
  { name: "Ostrołęka", lat: 53.0862, lng: 21.5758, rank: 3 },
  { name: "Zamość", lat: 50.7231, lng: 23.2518, rank: 3 },
  { name: "Jelenia Góra", lat: 50.9044, lng: 15.7194, rank: 3 },
  { name: "Konin", lat: 52.2231, lng: 18.2512, rank: 3 },
  { name: "Siedlce", lat: 52.1677, lng: 22.2902, rank: 3 },
];

export const CITIES_GEOJSON = {
  type: "FeatureCollection" as const,
  features: CITIES.map((c) => ({
    type: "Feature" as const,
    properties: { name: c.name, rank: c.rank },
    geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
  })),
};
