/**
 * Literówki w adresie e-mail - podpowiedź, nigdy blokada.
 *
 * ------------------------------------------------------------------ skąd to się wzięło
 *
 * Z dziennika Resend, nie z wyobraźni. Na pięć pierwszych wysyłek trzy się odbiły, a wszystkie
 * trzy od tej samej osoby, która zapisywała się na otwarcie trzy razy z rzędu:
 *
 *     bartekparadowski2000@gmail.con    ← literówka w domenie
 *     bartekparadoeski2000@gmail.com    ← literówka w części przed małpą
 *     bartekparadowski2000@gmail.com    ← dopiero to doszło
 *
 * Z jej strony wyglądało to tak: zapisałem się, potwierdzenie nie przyszło, strona nic nie
 * powiedziała. Formularz przyjął `gmail.con` bez mrugnięcia, bo z punktu widzenia zwykłego
 * sprawdzenia „coś@coś.coś" to jest poprawny adres.
 *
 * Druga, cichsza szkoda jest po naszej stronie: każdy odbity list psuje reputację domeny
 * u Gmaila. Przy pięciu zapisach to nic. Przy tysiącu, gdy kilka procent to literówki,
 * zaczynamy lądować w spamie u wszystkich pozostałych.
 *
 * ------------------------------------------------------------------ czego to NIE potrafi
 *
 * Drugiego z tych trzech adresów nie da się złapać i nikt tego nie potrafi. „paradoeski"
 * zamiast „paradowski" to poprawnie zbudowany adres w istniejącej domenie - wiedzieć, że
 * jest zły, mógłby wyłącznie Gmail. Dlatego samo podpowiadanie domen to połowa roboty;
 * drugą połową jest pokazanie człowiekowi, na jaki dokładnie adres poszedł list, żeby sam
 * zobaczył swoją pomyłkę. To już robi strona, nie ten plik.
 *
 * ------------------------------------------------------------------ dlaczego nigdy nie blokujemy
 *
 * Podpowiedź, którą da się odrzucić jednym kliknięciem, myli się bez kosztów. Blokada, która
 * się myli, odbiera komuś możliwość zapisania się i nie da się jej obejść. A pomylić się tu
 * jest łatwo: `mail.com` różni się od `gmail.com` o jedną literę, a jest prawdziwym dostawcą;
 * firmowa domena z rzadką końcówką wygląda jak błąd, a nim nie jest.
 *
 * Z tego samego powodu to sprawdzenie żyje wyłącznie w przeglądarce i nie ma go na serwerze.
 * Serwer ma przyjąć każdy adres o poprawnej budowie - także dziwny - bo nie ma prawa
 * decydować, że czyjaś skrzynka nie istnieje.
 */

/** Budowa adresu. Celowo luźna: sprawdza kształt, nie istnienie skrzynki. */
export const KSZTALT_ADRESU = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function poprawnyKsztalt(adres: string): boolean {
  return KSZTALT_ADRESU.test(adres);
}

/**
 * Domeny, które u nas realnie występują - polskie skrzynki i wielcy dostawcy.
 * Adres w którejkolwiek z nich jest poza podejrzeniem i kończy sprawdzanie.
 */
const ZNANE_DOMENY = [
  "gmail.com", "googlemail.com",
  "wp.pl", "o2.pl", "onet.pl", "onet.eu", "poczta.onet.pl", "op.pl", "interia.pl",
  "interia.eu", "gazeta.pl", "tlen.pl", "vp.pl", "int.pl", "go2.pl", "spoko.pl",
  "poczta.fm", "autograf.pl", "buziaczek.pl", "wp.eu", "o2.eu",
  "outlook.com", "outlook.pl", "hotmail.com", "hotmail.pl", "live.com", "live.pl",
  "msn.com", "yahoo.com", "yahoo.pl", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "pm.me", "tutanota.com", "zoho.com",
  "mail.com", "gmx.com", "gmx.pl", "aol.com", "seznam.cz", "web.de",
];

const ZNANE = new Set(ZNANE_DOMENY);

/**
 * Końcówki, które istnieją naprawdę. Lista jest hojna z rozmysłem: pomyłka w drugą stronę
 * (podpowiadamy komuś, kto ma nietypową, ale prawdziwą końcówkę) jest gorsza od przeoczenia.
 */
const PRAWDZIWE_KONCOWKI = new Set([
  "pl", "com", "eu", "net", "org", "info", "biz", "io", "co", "me", "dev", "app",
  "cloud", "online", "site", "shop", "store", "tech", "xyz", "fm", "tv", "cc", "cam",
  "edu", "gov", "mil", "int", "name", "pro", "email", "click", "link", "one", "life",
  "de", "cz", "sk", "uk", "fr", "it", "es", "nl", "be", "at", "ch", "se", "no", "dk",
  "fi", "ie", "pt", "gr", "hu", "ro", "bg", "hr", "si", "lt", "lv", "ee", "ua", "by",
  "ru", "us", "ca", "au", "nz", "jp", "cn", "in", "br", "mx", "tr", "il", "za",
]);

/** Końcówki, na które ktoś realnie chciał trafić - do nich przymierzamy pomyłkę. */
const CELOWE_KONCOWKI = ["pl", "com", "eu", "net", "org", "de", "co", "io"];

/**
 * Odległość edycyjna z zamianą sąsiadów (Damerau w wersji z wyrównaniem).
 *
 * Zamiana sąsiadów jest tu nie dla ozdoby: `gmial.com` i `gmali.com` to dwie najczęstsze
 * literówki w najczęstszej domenie, a zwykły Levenshtein liczy je jako dwa błędy i przy
 * progu jednego przepuściłby obie.
 */
function odleglosc(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  const poprzedni: number[] = [];
  let przedPoprzednim: number[] = [];
  let biezacy: number[] = [];

  for (let j = 0; j <= b.length; j++) poprzedni[j] = j;

  for (let i = 1; i <= a.length; i++) {
    biezacy = [i];
    let najlepszy = i;

    for (let j = 1; j <= b.length; j++) {
      const koszt = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        poprzedni[j] + 1,        // usunięcie
        biezacy[j - 1] + 1,      // wstawienie
        poprzedni[j - 1] + koszt // podmiana
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, przedPoprzednim[j - 2] + 1); // zamiana sąsiadów
      }
      biezacy[j] = v;
      if (v < najlepszy) najlepszy = v;
    }

    /* cały wiersz powyżej limitu - dalej może być już tylko gorzej */
    if (najlepszy > limit) return limit + 1;

    przedPoprzednim = poprzedni.slice();
    for (let j = 0; j <= b.length; j++) poprzedni[j] = biezacy[j];
  }

  return poprzedni[b.length];
}

/**
 * Adres, o który prawdopodobnie chodziło - albo `null`, gdy nie ma się do czego przyczepić.
 *
 * Dwa przejścia, bo łapią co innego:
 *
 *   1. CAŁA DOMENA blisko którejś ze znanych. Bierze `gmail.con`, `gmial.com`, `wp.ol`.
 *      Próg zależy od długości: przy krótkiej domenie („wp.pl" to pięć znaków) dwa błędy
 *      to już zupełnie inny adres, przy dłuższej wciąż widać, o co chodziło.
 *
 *   2. SAMA KOŃCÓWKA, gdy nie istnieje. Bierze `mojafirma.con` - domenę, której nie ma
 *      i nigdy nie będzie na żadnej liście, a i tak wiadomo, że chodziło o `.com`.
 */
export function sugestiaAdresu(adres: string): string | null {
  const malpa = adres.lastIndexOf("@");
  if (malpa < 1) return null;

  const lokalna = adres.slice(0, malpa);
  const domena = adres.slice(malpa + 1).toLowerCase();
  if (!domena.includes(".")) return null;

  /* dostawca z listy - nie ma czego poprawiać */
  if (ZNANE.has(domena)) return null;

  // ——— 1. cała domena blisko znanej
  const limit = domena.length <= 7 ? 1 : 2;
  let najblizsza: string | null = null;
  let najlepsza = limit + 1;

  for (const znana of ZNANE_DOMENY) {
    const d = odleglosc(domena, znana, limit);
    if (d < najlepsza) {
      najlepsza = d;
      najblizsza = znana;
    }
  }
  if (najblizsza && najlepsza <= limit) return `${lokalna}@${najblizsza}`;

  // ——— 2. sama końcówka, gdy takiej nie ma na świecie
  const kropka = domena.lastIndexOf(".");
  const koncowka = domena.slice(kropka + 1);
  if (PRAWDZIWE_KONCOWKI.has(koncowka)) return null;

  for (const celowa of CELOWE_KONCOWKI) {
    if (odleglosc(koncowka, celowa, 1) <= 1) {
      return `${lokalna}@${domena.slice(0, kropka + 1)}${celowa}`;
    }
  }

  return null;
}
