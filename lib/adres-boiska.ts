/**
 * Dokładny adres boiska - z jego współrzędnych, przez Photon (komoot), a gdy ten milczy,
 * przez Nominatim. Oba to dane OpenStreetMap.
 *
 * W bazie boisko ma tylko miasto i pinezkę, a pod mini mapką na karcie ma stać ulica
 * z numerem. Pytamy na serwerze, przy budowaniu karty, i trzymamy odpowiedź miesiąc:
 * boiska się nie przeprowadzają, a jedno zapytanie na boisko miesięcznie to tyle, ile
 * publiczny Photon spokojnie zniesie. Ten sam dostawca podpowiada adresy w wyszukiwarce mapy.
 *
 * Przeglądarka nie wysyła tu niczego - pytanie zawiera wyłącznie publiczne współrzędne boiska.
 */
export interface AdresBoiska {
  /** „Vincenta van Gogha 1" albo nazwa miejsca, gdy ulicy nie ma */
  ulica: string;
  /** „03-188 Warszawa, Białołęka" */
  miejscowosc: string;
}

type Wlasciwosci = {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  district?: string;
  countrycode?: string;
};

const MIESIAC = 60 * 60 * 24 * 30;
const NAGLOWKI = { "User-Agent": "podkosz.pl (karta boiska)" };

function zloz(ulica: string | undefined, kod: string | undefined, miasto: string | undefined, dzielnica: string | undefined): AdresBoiska | null {
  if (!ulica || !miasto) return null;
  const dop = dzielnica && dzielnica !== miasto ? `, ${dzielnica}` : "";
  return { ulica, miejscowosc: `${kod ? `${kod} ` : ""}${miasto}${dop}` };
}

async function zPhotona(lat: number, lng: number): Promise<AdresBoiska | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=default`, {
    next: { revalidate: MIESIAC },
    headers: NAGLOWKI,
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const dane = (await res.json()) as { features?: { properties?: Wlasciwosci }[] };
  const p = dane.features?.[0]?.properties;
  if (!p || (p.countrycode && p.countrycode !== "PL")) return null;
  const ulica = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : p.name;
  return zloz(ulica, p.postcode, p.city ?? p.town ?? p.village, p.district);
}

/*
  Zapasowo Nominatim (też OpenStreetMap). Publiczny Photon potrafi nie odpowiadać przez kilka
  minut - wtedy pod mapką zostawało samo miasto aż do następnego przebudowania karty.
  Zasady Nominatim pozwalają na takie pojedyncze pytania z nazwą aplikacji w nagłówku.
*/
async function zNominatim(lat: number, lng: number): Promise<AdresBoiska | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pl`,
    { next: { revalidate: MIESIAC }, headers: NAGLOWKI, signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return null;
  const dane = (await res.json()) as {
    address?: { road?: string; pedestrian?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string; suburb?: string; country_code?: string };
  };
  const a = dane.address;
  if (!a || (a.country_code && a.country_code !== "pl")) return null;
  const droga = a.road ?? a.pedestrian;
  const ulica = droga ? [droga, a.house_number].filter(Boolean).join(" ") : undefined;
  return zloz(ulica, a.postcode, a.city ?? a.town ?? a.village, a.suburb);
}

export async function adresBoiska(lat: number, lng: number): Promise<AdresBoiska | null> {
  for (const zrodlo of [zPhotona, zNominatim]) {
    try {
      const adres = await zrodlo(lat, lng);
      if (adres) return adres;
    } catch {
      /* następne źródło; bez adresu pod mapką stoi samo miasto */
    }
  }
  return null;
}
