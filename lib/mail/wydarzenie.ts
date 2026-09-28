import { SITE_URL } from "@/lib/site";
import { CZCIONKA, KREDA, SLABY, akapit, esc, naglowek, nadtytul, przycisk, szkielet } from "./szkielet";

/**
 * Zaproszenie na wydarzenie - jedyny list w serwisie, który wychodzi bez pytania.
 *
 * Dostaje go ktoś, kto podpalił to boisko albo boisko w okolicy, więc mamy powód sądzić,
 * że go to interesuje. To nie jest newsletter i nie chcę, żeby nim się stał, dlatego:
 *
 *   - powód dostania listu stoi w treści, nie w stopce drobnym drukiem („dostajesz to,
 *     bo podpaliłeś to boisko" albo „...boisko w okolicy"),
 *   - w stopce jest link, który wyłącza takie wiadomości jednym kliknięciem, bez
 *     logowania (token z `wypis_tokeny`, strona `/wypisz`), a ten sam adres idzie
 *     w nagłówku `List-Unsubscribe` - Gmail pokazuje wtedy własny przycisk „Wypisz",
 *   - jeden list na wydarzenie, pilnowany kolumną `powiadomiono_at` w bazie.
 *
 * Barwy wydarzenia (biało-czerwone) NIE wchodzą do listu. W skrzynce nie ma kontekstu
 * mapy, więc czerwień znaczyłaby tam „alarm", a nie „wydarzenie" - list zostaje w barwach
 * marki, a wyróżnia się treścią.
 */

export interface DaneWydarzenia {
  nazwa: string;
  opis: string;
  /** gotowy opis czasu, np. „sobota, 12 października, 10:00-14:00" */
  kiedy: string;
  boisko: string;
  miasto: string;
  slug: string;
  /** dlaczego ta osoba dostaje list */
  powod: "to-boisko" | "okolica";
  /** imię albo nick - list jest do człowieka, nie do listy adresowej */
  nick?: string;
  /** token wypisu; bez niego (baza sprzed migracji RODO) stopka odsyła na stronę konta */
  wypis?: string;
}

/** Strona wypisu - otwarta z linku w stopce pokazuje przycisk, nie wypisuje sama. */
export function adresWypisu(token: string) {
  return `${SITE_URL}/wypisz?t=${encodeURIComponent(token)}`;
}

/**
 * Adres dla nagłówka `List-Unsubscribe-Post` (RFC 8058): klient pocztowy wysyła na niego
 * POST i wypis dzieje się od razu. Osobny od strony, bo zwykłe GET-y do linków w listach
 * robią też skanery antywirusowe - gdyby samo wejście wypisywało, wypisywałyby ludzi same.
 */
export function adresWypisuJednymKlikiem(token: string) {
  return `${SITE_URL}/api/wypisz?t=${encodeURIComponent(token)}`;
}

function jakWypisac(d: DaneWydarzenia) {
  return d.wypis
    ? `Nie chcesz wiadomości o wydarzeniach? Wypisz się jednym kliknięciem: ${adresWypisu(d.wypis)}`
    : `Nie chcesz wiadomości o wydarzeniach? Wyłącz je na stronie swojego konta: ${SITE_URL}/konto`;
}

function adresBoiska(slug: string) {
  return `${SITE_URL}/boisko/${slug}`;
}

function dlaczego(powod: DaneWydarzenia["powod"], boisko: string) {
  return powod === "to-boisko"
    /* „to-boisko" to ogień na tym boisku ALBO deklaracja gry na nim - zdanie mówi oba */
    ? `Dostajesz tę wiadomość, bo podpaliłeś „${boisko}" na PodKoszu albo zapisałeś się tam na grę.`
    : "Dostajesz tę wiadomość, bo podpaliłeś boisko w okolicy tego wydarzenia.";
}

export function tematWydarzenia(d: Pick<DaneWydarzenia, "nazwa" | "boisko">) {
  return `${d.nazwa} - ${d.boisko}`;
}

export function htmlWydarzenia(d: DaneWydarzenia) {
  const powitanie = d.nick ? `Hej, ${esc(d.nick)}.` : "Hej.";

  const tresc = `
    ${nadtytul("Wydarzenie na boisku")}
    ${naglowek(powitanie, esc(d.nazwa))}

    ${akapit(
      /*
        Miejsce i termin jako dwa podpisane wiersze, a nie zdanie.

        Zdanie wymagałoby odmiany nazwy miasta („w Warszawie", „w Łodzi", „w Katowicach")
        - a miasto przychodzi z bazy w mianowniku i żadna reguła tego nie odmieni bez
        słownika. Pierwsza wersja tego listu pisała „w Warszawa" i to jedno słowo
        wystarczało, żeby cały list wyglądał na wysłany przez maszynę. Podpisane wiersze
        czyta się szybciej niż zdanie i nie mają przypadków.
      */
      `Miejsce: <strong style="color:${KREDA};">${esc(d.boisko)}</strong>, ${esc(d.miasto)}.` +
        `<br />Termin: <strong style="color:${KREDA};">${esc(d.kiedy)}</strong>.`
    )}

    ${d.opis ? akapit(esc(d.opis).replace(/\n+/g, "<br />")) : ""}

    ${przycisk("Zobacz boisko i szczegóły", adresBoiska(d.slug))}

    <p style="margin:26px 0 0;font-family:${CZCIONKA};font-size:13px;line-height:1.6;color:${SLABY};">
      ${dlaczego(d.powod, esc(d.boisko))}
    </p>
  `;

  return szkielet({
    podglad: `${d.nazwa} - ${d.kiedy}`,
    tresc,
    stopka:
      `${dlaczego(d.powod, d.boisko)} ${jakWypisac(d)}`,
  });
}

export function tekstWydarzenia(d: DaneWydarzenia) {
  const wiersze = [
    d.nazwa.toUpperCase(),
    "",
    `Boisko: ${d.boisko}, ${d.miasto}`,
    `Termin: ${d.kiedy}`,
    "",
    ...(d.opis ? [d.opis, ""] : []),
    `Szczegóły: ${adresBoiska(d.slug)}`,
    "",
    dlaczego(d.powod, d.boisko),
    jakWypisac(d),
  ];

  return wiersze.join("\n");
}

/** Wersja poglądowa dla panelu - te same funkcje, przykładowe dane. */
export const PRZYKLAD_WYDARZENIA: DaneWydarzenia = {
  nazwa: "Turniej 3x3 o Puchar Podkosza",
  opis:
    "Gramy do dwóch przegranych, zapisy na miejscu od 9:30. Drużyny trzyosobowe, " +
    "sędziuje Basket. Dla najlepszej trójki koszulki i piłka.",
  kiedy: "sobota, 12 października, 10:00-14:00",
  boisko: "Boisko Kobe Bryant",
  miasto: "Warszawa",
  slug: "warszawa-boisko-kobe-bryant",
  powod: "to-boisko",
  nick: "Kuba",
};
