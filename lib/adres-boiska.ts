/**
 * Dokładny adres boiska - z jego współrzędnych, przez Photon (komoot, dane OpenStreetMap).
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

export async function adresBoiska(lat: number, lng: number): Promise<AdresBoiska | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=default`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: { "User-Agent": "podkosz.pl (karta boiska)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const dane = (await res.json()) as { features?: { properties?: Wlasciwosci }[] };
    const p = dane.features?.[0]?.properties;
    if (!p || (p.countrycode && p.countrycode !== "PL")) return null;

    const ulica = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : p.name;
    const miasto = p.city ?? p.town ?? p.village;
    if (!ulica || !miasto) return null;

    const dzielnica = p.district && p.district !== miasto ? `, ${p.district}` : "";
    return { ulica, miejscowosc: `${p.postcode ? `${p.postcode} ` : ""}${miasto}${dzielnica}` };
  } catch {
    /* adres jest dodatkiem - bez niego pod mapką stoi samo miasto */
    return null;
  }
}
