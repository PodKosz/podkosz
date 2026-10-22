/**
 * Podpowiedzi adresów i miejscowości do wyszukiwarki na mapie.
 *
 * Źródłem jest Photon (komoot) - wyszukiwarka zbudowana na danych OpenStreetMap, pomyślana
 * pod podpowiedzi przy pisaniu. Przeglądarka nie pyta jej wprost, tylko przez naszą trasę
 * `/api/miejsca`: adres IP osoby szukającej zostaje u nas, odpowiedzi mogą leżeć w pamięci
 * podręcznej, a dostawcę da się kiedyś wymienić bez ruszania strony. Dane są z OSM, więc
 * pod listą stoi atrybucja „© OpenStreetMap”.
 */

export type RodzajMiejsca = "adres" | "ulica" | "miejscowosc";

export interface Miejsce {
  /** pierwsza linia: nazwa ulicy z numerem, nazwa ulicy albo miejscowości */
  nazwa: string;
  /** druga linia: dzielnica, miasto, powiat - to, co odróżnia dwie takie same nazwy */
  opis: string;
  rodzaj: RodzajMiejsca;
  lat: number;
  lng: number;
  /** przybliżenie mapy po wybraniu: numer domu najbliżej, miasto najdalej */
  zoom: number;
}

/** Dokąd ma polecieć mapa po wyborze z wyszukiwarki. `znacznik` - biała kropka w punkcie. */
export interface CelMapy {
  lat: number;
  lng: number;
  zoom: number;
  znacznik: boolean;
}

/** Polska z zapasem - poza nią nie podpowiadamy */
export const GRANICE_POLSKI = "14.07,49.0,24.15,54.84";

const bezZnakow = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

interface CechyPhoton {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  countrycode?: string;
  type?: string;
}

/**
 * Wyniki Photona na nasze dwie linie. Sklepy i lokale pod szukanym adresem (Photon zwraca je
 * jako „house” z nazwą) to szum - przy „Marszałkowska 10” wypadały Żabka i kolektura Lotto.
 * Zostają tylko wtedy, gdy ktoś szuka właśnie ich nazwy (np. „Stadion Narodowy”).
 */
export function zPhotona(
  cechy: { properties?: CechyPhoton; geometry?: { coordinates?: [number, number] } }[],
  zapytanie: string,
  limit = 5
): Miejsce[] {
  const pierwszeSlowo = bezZnakow(zapytanie.trim().split(/\s+/)[0] ?? "");
  const widziane = new Set<string>();
  const wynik: Miejsce[] = [];

  for (const f of cechy) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    /* prostokąt `bbox` łapie też skrawki Czech, Niemiec i Słowacji - zostaje sama Polska */
    if (p.countrycode && p.countrycode !== "PL") continue;

    let m: Miejsce;
    if (p.type === "house") {
      const adres = [p.street, p.housenumber].filter(Boolean).join(" ");
      const lokal = p.name && p.name !== adres;
      if (lokal && !bezZnakow(p.name!).includes(pierwszeSlowo)) continue;
      m = {
        nazwa: (lokal ? p.name : adres || p.name) ?? "",
        opis: [lokal ? adres : "", p.city ?? p.district].filter(Boolean).join(", "),
        rodzaj: "adres",
        lat,
        lng,
        zoom: 16.5,
      };
    } else if (p.type === "street") {
      m = {
        nazwa: p.name ?? "",
        opis: [p.district, p.city].filter(Boolean).join(", "),
        rodzaj: "ulica",
        lat,
        lng,
        zoom: 15,
      };
    } else if (p.type === "city" || p.type === "district" || p.type === "locality") {
      m = {
        nazwa: p.name ?? "",
        opis: [p.type === "city" ? p.county : p.city, p.state].filter(Boolean).join(", "),
        rodzaj: "miejscowosc",
        lat,
        lng,
        zoom: p.type === "city" ? 12 : 13,
      };
    } else {
      /* powiaty, województwa i „other” (dworce, urzędy o nazwie miasta) tylko dublowały miasto */
      continue;
    }

    const klucz = `${m.nazwa}|${m.opis}`;
    if (!m.nazwa || widziane.has(klucz)) continue;
    widziane.add(klucz);
    wynik.push(m);
    if (wynik.length >= limit) break;
  }
  return wynik;
}

/** Odległość po powierzchni Ziemi w kilometrach (wzór haversine). */
export function odlegloscKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/** „850 m”, „1,2 km”, „14 km” */
export const odlegloscTekst = (km: number) =>
  km < 1
    ? `${Math.max(10, Math.round(km * 100) * 10)} m`
    : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
