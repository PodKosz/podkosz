/**
 * Piesze trasy z wyszukanego adresu do najbliższych boisk - pomarańczowe linie po ulicach.
 *
 * Trasę liczy publiczny serwer OSRM z profilem pieszym, który utrzymuje FOSSGIS (ci sami ludzie,
 * co mapy openstreetmap.de). Zapytanie wychodzi z przeglądarki i zawiera wyłącznie dwie pary
 * współrzędnych: wyszukany punkt i boisko - żadnego identyfikatora osoby. Zasady serwera
 * dopuszczają lekki ruch z podpisem źródła; podpis stoi w atrybucji mapy (źródło `trasy`).
 * Przy dużym ruchu po premierze trzeba będzie postawić własny OSRM albo wykupić dostawcę.
 *
 * Gdy serwer milczy, linia idzie prosto - mechanizm ma pokazać kierunek i odległość,
 * a nie zawieść z powodu cudzej usterki.
 */

export type Punkt = { lat: number; lng: number };

export interface Trasa {
  /** [lng, lat] od wyszukanego punktu do celu, z doklejonymi końcami */
  wspolrzedne: [number, number][];
  metry: number;
  sekundy: number;
  /** false = linia prosta, bo serwer tras nie odpowiedział */
  poUlicach: boolean;
}

const SERWER = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
/** tempo spaceru dla linii prostej - takie samo, jakie przyjmuje profil pieszy OSRM */
const KROK_M_NA_S = 1.25;

const pamiec = new Map<string, Promise<Trasa>>();

function metryMiedzy(a: Punkt, b: Punkt) {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
}

function prosta(a: Punkt, b: Punkt): Trasa {
  /* po prostej jest bliżej niż ulicami - doliczamy typowy naddatek, żeby czas nie kłamał */
  const metry = metryMiedzy(a, b) * 1.3;
  return { wspolrzedne: [[a.lng, a.lat], [b.lng, b.lat]], metry, sekundy: metry / KROK_M_NA_S, poUlicach: false };
}

export function trasaPiesza(a: Punkt, b: Punkt): Promise<Trasa> {
  const klucz = `${a.lng.toFixed(5)},${a.lat.toFixed(5)};${b.lng.toFixed(5)},${b.lat.toFixed(5)}`;
  const zapisana = pamiec.get(klucz);
  if (zapisana) return zapisana;

  const obietnica = fetch(`${SERWER}/${klucz}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(6000) })
    .then(async (res) => {
      if (!res.ok) return prosta(a, b);
      const dane = (await res.json()) as {
        code?: string;
        routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
      };
      const t = dane.code === "Ok" ? dane.routes?.[0] : undefined;
      if (!t || t.geometry.coordinates.length < 2) return prosta(a, b);
      /* trasa zaczyna się i kończy na najbliższej ulicy - dociągamy linię do samych punktów */
      return {
        wspolrzedne: [[a.lng, a.lat], ...t.geometry.coordinates, [b.lng, b.lat]] as [number, number][],
        metry: t.distance,
        sekundy: t.duration,
        poUlicach: true,
      };
    })
    .catch(() => prosta(a, b));

  pamiec.set(klucz, obietnica);
  /* nieudanej odpowiedzi nie trzymamy - następne wyszukanie spróbuje jeszcze raz */
  void obietnica.then((t) => {
    if (!t.poUlicach) pamiec.delete(klucz);
  });
  return obietnica;
}

/**
 * Wycinek linii od początku do ułamka `postep` jej długości - z tego rośnie rysowana trasa.
 * Długości liczone w przybliżeniu płaskim (metry na stopień przy danej szerokości), co na
 * kilku kilometrach daje błąd niewidoczny dla oka.
 */
export function przytnijLinie(linia: [number, number][], postep: number): [number, number][] {
  if (postep >= 1 || linia.length < 2) return linia;
  const kx = Math.cos((linia[0][1] * Math.PI) / 180);
  const odcinki = linia.slice(1).map((p, i) => Math.hypot((p[0] - linia[i][0]) * kx, p[1] - linia[i][1]));
  const calosc = odcinki.reduce((s, d) => s + d, 0);
  let zostalo = calosc * Math.max(0, postep);
  const wynik: [number, number][] = [linia[0]];
  for (let i = 0; i < odcinki.length; i++) {
    const [x0, y0] = linia[i];
    const [x1, y1] = linia[i + 1];
    if (zostalo >= odcinki[i]) {
      wynik.push(linia[i + 1]);
      zostalo -= odcinki[i];
      continue;
    }
    const t = odcinki[i] ? zostalo / odcinki[i] : 0;
    wynik.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    break;
  }
  if (wynik.length === 1) wynik.push(linia[0]);
  return wynik;
}

/** „8 min pieszo · 650 m” */
export function opisTrasy(t: Trasa) {
  const min = Math.max(1, Math.round(t.sekundy / 60));
  const dystans = t.metry < 1000 ? `${Math.max(10, Math.round(t.metry / 10) * 10)} m` : `${(t.metry / 1000).toFixed(1).replace(".", ",")} km`;
  return `${min} min pieszo · ${dystans}`;
}

export { metryMiedzy };
