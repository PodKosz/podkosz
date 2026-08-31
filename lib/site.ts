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

/**
 * Profile serwisu w innych miejscach sieci.
 *
 * Trafiają do danych strukturalnych jako `sameAs` - to nimi wyszukiwarka wiąże nazwę
 * „PodKosz" z konkretną marką. Przy nowej domenie jest to zwykle pierwszy dowód, że
 * marka istnieje poza własną stroną, więc pusta lista realnie kosztuje.
 *
 * Adres profilu na Instagramie podaje zmienna NEXT_PUBLIC_INSTAGRAM - dzięki temu nie
 * trzeba wgrywać nowej wersji kodu, gdy zmieni się nazwa konta.
 */
export const PROFILE_SPOLECZNOSCIOWE = [process.env.NEXT_PUBLIC_INSTAGRAM]
  .filter((adres): adres is string => Boolean(adres && adres.startsWith("https://")));

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

/**
 * Odnośnik na mapę z jednym województwem: kamera dolatuje do regionu, obrys się zapala,
 * a lista boisk zawęża się do niego.
 *
 * Sam parametr `woj` obsługuje już panel filtrów, więc taki adres jest zwyczajnym stanem
 * mapy - da się go wysłać, wrzucić do zakładek i przetrwa odświeżenie strony. Reszta
 * (dolot, żar, powrót do kadru na Polskę po oddaleniu) dzieje się w `MapView`.
 */
export function linkNaMape(wojewodztwo: string) {
  return `/?woj=${encodeURIComponent(wojewodztwo)}`;
}

/** Odległość dla człowieka: „320 m", „2,4 km", „67 km". */
export function formatDistance(meters: number) {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}

/**
 * Polska liczba mnoga: 1 boisko, 2-4 boiska, 5+ boisk, ale 12-14 boisk i 22 boiska.
 * Bez tego licznik pisze „1 płonących piłek" albo „22 osób idzie".
 */
export function plural(n: number, forms: [string, string, string]) {
  const [one, few, many] = forms;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/*
  Podpisy, pod którymi kryje się „ktokolwiek bez konta". Zgłoszenia od gości dostają w bazie
  wspólną nazwę autora, więc w rankingu zbierałyby się w jedną pozycję - i po kilkudziesięciu
  anonimowych boiskach ta jedna pozycja na zawsze zajmowałaby pierwsze miejsce, mimo że stoi
  za nią wiele różnych osób. Dlatego w rankingu graczy takich wpisów nie liczymy; boiska
  zostają na mapie i mają podpis autora, tylko nie tworzą „gracza".
*/
const AUTORZY_ANONIMOWI = new Set(["gosc", "gość", "gość anonimowy", "anonim", "użytkownik"]);

export function czyAutorAnonimowy(nazwa: string): boolean {
  return AUTORZY_ANONIMOWI.has(nazwa.trim().toLowerCase());
}

/*
  Polskie daty opisowe wymagają dopełniacza: „od sierpnia 2026", nie „od sierpień 2026".
  `toLocaleDateString` z `month: "long"` zwraca mianownik, więc nazwy trzymamy tutaj.
*/
const MIESIACE_DOPELNIACZ = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

/** „sierpnia 2026" albo „14 sierpnia 2026", gdy podamy `zDniem`. */
export function dataOpisowa(iso: string, zDniem = false): string {
  const d = new Date(iso);
  const miesiac = `${MIESIACE_DOPELNIACZ[d.getMonth()]} ${d.getFullYear()}`;
  return zDniem ? `${d.getDate()} ${miesiac}` : miesiac;
}
