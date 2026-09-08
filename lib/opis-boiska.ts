import type { Access, Court, CourtType, Surface } from "./types";
import { plural } from "./site";

/**
 * Zdania o właściwościach boiska - dopisek pod opisem od człowieka.
 *
 * ------------------------------------------------------------------ po co
 *
 * Opis pisze osoba, która boisko zgłosiła, i zwykle jest to jedno zdanie o tym, co ją tam
 * uderzyło („klimatyczne mini boisko, obok rzeka"). Twarde fakty - liczba koszy,
 * nawierzchnia, oświetlenie, ogrodzenie, godziny - stoją wyżej w kafelkach, ale w kafelku
 * są pojedynczym słowem. Te zdania zamieniają je w tekst: dla czytającego to zwykły akapit
 * o boisku, dla wyszukiwarki - treść, której na stronie z sześcioma słowami po prostu nie ma.
 *
 * ------------------------------------------------------------------ dlaczego trzydzieści
 *
 * Trzydzieści wariantów na każdą cechę, nie jeden. Przy jednym szablonie co drugie boisko
 * w Polsce miałoby zdanie słowo w słowo takie samo - a tekst powtórzony na tysiącu podstron
 * przestaje być treścią i staje się szablonem; tak go czyta i człowiek, i wyszukiwarka.
 * Przy trzydziestu wariantach na pięć cech ta sama piątka zdań trafia się raz na dwadzieścia
 * cztery miliony układów.
 *
 * ------------------------------------------------------------------ dlaczego nie losowo
 *
 * Wariant wybiera skrót z identyfikatora boiska I Z WARTOŚCI, o której zdanie mówi.
 * To daje dwie rzeczy naraz:
 *
 *   - jedno boisko ma zawsze ten sam tekst. Przy losowaniu zmieniałby się przy każdym
 *     wejściu, a strony są budowane z góry i trzymane w pamięci podręcznej - więc i tak
 *     nie byłoby to losowanie, tylko lotto rozstrzygnięte w chwili budowania;
 *
 *   - po zaakceptowanej poprawce zdanie zmienia się samo. Zmiana nawierzchni z betonu na
 *     poliuretan zmienia i treść (bo bierze się z danych), i wariant (bo wartość jest
 *     w ziarnie) - więc nie zostaje po niej „poprawione zdanie w starym rytmie".
 *     Panel po każdej zmianie unieważnia znacznik boisk (`/api/odswiez`), a karta boiska
 *     przebudowuje się z nowych danych.
 *
 * ------------------------------------------------------------------ czego tu nie ma
 *
 * Żadne zdanie nie dopowiada faktu, którego nie ma w bazie. Nie ma pogody, nie ma tego,
 * czy siatki są nowe, nie ma „idealne na trening" przy boisku, o którym wiemy tylko tyle,
 * że ma dwa kosze. Zdanie, które kłamie, jest gorsze od braku zdania - a tu wystarczy
 * jedna zła podmiana, żeby powtórzyła się na kilkuset stronach.
 */

/* ------------------------------------------------------------------ wybór wariantu */

/**
 * FNV-1a, 32 bity. Potrzebny jest skrót, który dla tego samego tekstu zawsze da tę samą
 * liczbę i rozrzuca podobne teksty daleko od siebie - `id` boisk to UUID-y różniące się
 * czasem jedną cyfrą, a mają dostać różne warianty. Nic kryptograficznego się tu nie dzieje.
 */
function skrot(tekst: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i += 1) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Pierwsze słowo zdania - po nim poznajemy, że dwa sąsiednie zaczynają się tak samo. */
function pierwszeSlowo(zdanie: string) {
  return zdanie.split(" ", 1)[0].toLowerCase();
}

/** Pierwsza litera wielka - dla wariantów zaczynających zdanie od nazwy nawierzchni. */
function duza(tekst: string) {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/* ------------------------------------------------------------------ nawierzchnia */

interface FormyNawierzchni {
  /** „beton" - do zdań typu „Pod koszami beton." */
  mian: string;
  /** „na betonie" - do zdań o graniu */
  miejsc: string;
  /** „betonu" - do zdań „nawierzchnia z betonu" */
  dop: string;
  /** przymiotnik żeński, zgodny z „nawierzchnia" i „płyta" */
  przym: string;
  /** beton i asfalt są twarde - część zdań mówi o tym, jak się na nich gra */
  twarda: boolean;
}

/*
  Odmiana, nie same podpisy. Polski wymaga miejscownika („na betonie") i dopełniacza
  („z betonu"), a `SURFACE_LABEL` zna tylko mianownik - z niego nie da się tych form
  wyliczyć regułą, która nie kłamie („na trawie syntetycznej", nie „na trawa syntetyczna").
*/
const NAWIERZCHNIE: Record<Surface, FormyNawierzchni> = {
  beton: {
    mian: "beton",
    miejsc: "na betonie",
    dop: "betonu",
    przym: "betonowa",
    twarda: true,
  },
  asfalt: {
    mian: "asfalt",
    miejsc: "na asfalcie",
    dop: "asfaltu",
    przym: "asfaltowa",
    twarda: true,
  },
  poliuretan: {
    mian: "poliuretan",
    miejsc: "na poliuretanie",
    dop: "poliuretanu",
    przym: "poliuretanowa",
    twarda: false,
  },
  plytki: {
    mian: "płytki modułowe",
    miejsc: "na płytkach modułowych",
    dop: "płytek modułowych",
    przym: "modułowa",
    twarda: false,
  },
  parkiet: {
    mian: "parkiet",
    miejsc: "na parkiecie",
    dop: "parkietu",
    przym: "parkietowa",
    twarda: false,
  },
  syntetyk: {
    mian: "trawa syntetyczna",
    miejsc: "na trawie syntetycznej",
    dop: "trawy syntetycznej",
    przym: "syntetyczna",
    twarda: false,
  },
};

const ZDANIA_NAWIERZCHNIA: readonly ((n: FormyNawierzchni) => string)[] = [
  (n) => `Nawierzchnia to ${n.mian}.`,
  (n) => `Gra się tu ${n.miejsc}.`,
  (n) => `Nawierzchnia ${n.przym} - ${n.twarda ? "twardo pod nogami" : "łagodnie dla kolan"}.`,
  (n) => `Pod koszami ${n.mian}.`,
  (n) => `Podłoże z ${n.dop}.`,
  (n) => `Kozłujesz ${n.miejsc}.`,
  (n) => `${duza(n.mian)} pod nogami.`,
  (n) => `Nawierzchnia ${n.przym} na całej płycie.`,
  (n) => `Kozłowanie i rzuty ${n.miejsc}.`,
  (n) => `Nawierzchnia: ${n.mian}.`,
  (n) => `${duza(n.mian)} - ${n.twarda ? "odbicie krótkie i przewidywalne" : "odbicie miękkie"}.`,
  (n) => `Zagrasz ${n.miejsc}.`,
  (n) => `Płyta z ${n.dop}.`,
  (n) => `${n.twarda ? "Twarda" : "Miękka"} nawierzchnia - ${n.mian}.`,
  (n) =>
    `Nawierzchnia ${n.przym}, ${
      n.twarda ? "więc buty schodzą szybciej" : "więc kolana mają łatwiej"
    }.`,
  (n) => `Trening ${n.miejsc}.`,
  (n) => `Cała płyta z ${n.dop}.`,
  (n) =>
    `Grasz ${n.miejsc}, ${n.twarda ? "jak na większości miejskich boisk" : "a to rzadszy komfort"}.`,
  (n) => `Pod nogami ${n.mian}.`,
  (n) => `Nawierzchnia ${n.przym}.`,
  (n) => `Podłoże: ${n.mian}.`,
  (n) => `Rzucasz ${n.miejsc}.`,
  (n) => `Boisko ma nawierzchnię z ${n.dop}.`,
  /*
    Przysłówek, nie przymiotnik. Orzecznik musiałby zgadzać się z rodzajem nazwy
    nawierzchni, a ta bywa męska („beton"), żeńska („trawa syntetyczna") i mnoga
    („płytki modułowe") - jedno brzmienie nie obsłuży wszystkich trzech.
  */
  (n) => `${duza(n.mian)} - ${n.twarda ? "twardo, ale trwale" : "sprężyście pod stopą"}.`,
  (n) => `Gra toczy się ${n.miejsc}.`,
  (n) =>
    `Nawierzchnia z ${n.dop}, ${
      n.twarda ? "typowa dla osiedlowych boisk" : "lepsza od osiedlowego standardu"
    }.`,
  (n) => `${duza(n.miejsc)} kozłuje się ${n.twarda ? "równo" : "miękko"}.`,
  (n) => `Płyta ${n.przym}.`,
  (n) => `Tu grasz ${n.miejsc} - ${n.twarda ? "bez amortyzacji" : "z amortyzacją"}.`,
  (n) => `Do rzucania ${n.miejsc}.`,
];

/* ------------------------------------------------------------------ kosze */

interface FormyKoszy {
  ile: number;
  /** kosz / kosze / koszy - wybrane liczebnikiem */
  rzecz: string;
  /** „dwa", „cztery" - w części zdań liczba słowem czyta się lepiej niż cyfrą */
  slownie: string;
  jeden: boolean;
  para: boolean;
  /** cztery i więcej: tyle koszy znaczy, że zmieści się kilka grup naraz */
  duzo: boolean;
}

const SLOWNIE = [
  "zero",
  "jeden",
  "dwa",
  "trzy",
  "cztery",
  "pięć",
  "sześć",
  "siedem",
  "osiem",
  "dziewięć",
  "dziesięć",
];

const ZDANIA_KOSZE: readonly ((k: FormyKoszy) => string)[] = [
  (k) => `${k.ile} ${k.rzecz}.`,
  (k) => `Na boisku ${k.ile} ${k.rzecz}.`,
  (k) => `Do gry ${k.ile} ${k.rzecz}.`,
  (k) =>
    k.jeden
      ? "Jeden kosz - gra na jedną stronę."
      : k.duzo
        ? `${duza(k.slownie)} ${k.rzecz} - miejsce dla kilku grup.`
        : `${duza(k.slownie)} ${k.rzecz} - gra na dwie strony.`,
  (k) => `Koszy: ${k.ile}.`,
  (k) => `${k.ile} ${k.rzecz} do rzucania.`,
  (k) =>
    k.jeden ? "Jeden kosz, więc streetball na połowie." : "Kosz z każdej strony, więc pełna gra.",
  (k) => `${duza(k.slownie)} ${k.rzecz}.`,
  (k) =>
    k.duzo
      ? `${k.ile} ${k.rzecz} - zmieści się kilka grup naraz.`
      : `${k.ile} ${k.rzecz} - w sam raz na małą grę.`,
  (k) => `Rzucasz do ${k.jeden ? "jednego kosza" : `${k.ile} koszy`}.`,
  (k) => `${k.ile} ${k.rzecz} nad płytą.`,
  (k) => (k.jeden ? "Kosz tylko jeden." : `${duza(k.slownie)} ${k.rzecz} w komplecie.`),
  (k) => (k.jeden ? "Do rzutów jeden kosz." : `Do rzutów ${k.ile} ${k.rzecz}.`),
  /* liczebnik rządzi czasownikiem: „czekają dwa", ale „czeka pięć" - stąd trzy przypadki */
  (k) =>
    k.jeden
      ? "Czeka jeden kosz."
      : k.ile < 5
        ? `Czekają ${k.ile} ${k.rzecz}.`
        : `Czeka ${k.ile} ${k.rzecz}.`,
  (k) => (k.para ? "Dwa kosze, jeden z każdej strony." : `${k.ile} ${k.rzecz}.`),
  (k) => `Kosze: ${k.ile}.`,
  (k) => (k.duzo ? `Aż ${k.ile} ${k.rzecz}.` : `${k.ile} ${k.rzecz}.`),
  (k) =>
    `${k.ile} ${k.rzecz} - ${
      k.jeden ? "jedna strona do gry" : k.duzo ? "gra w kilku miejscach naraz" : "dwie strony do gry"
    }.`,
  (k) => `Na płycie ${k.ile} ${k.rzecz}.`,
  (k) => `${duza(k.slownie)} ${k.rzecz} nad boiskiem.`,
  (k) => (k.jeden ? "Gra się na jeden kosz." : `Gra się na ${k.ile} ${k.rzecz}.`),
  (k) => `Liczba koszy: ${k.ile}.`,
  (k) =>
    `${k.ile} ${k.rzecz}, więc ${
      k.duzo
        ? "starczy dla kilku ekip"
        : k.jeden
          ? "gra toczy się w jednym miejscu"
          : "można grać w pełnym składzie"
    }.`,
  (k) => `Nad płytą ${k.ile} ${k.rzecz}.`,
  (k) => (k.jeden ? "Jeden kosz." : `${k.ile} ${k.rzecz} do wyboru.`),
  (k) => `Do dyspozycji ${k.ile} ${k.rzecz}.`,
  (k) => `${k.ile} ${k.rzecz} - tyle policzył autor zgłoszenia.`,
  (k) => (k.jeden ? "Zamontowany jeden kosz." : `Zamontowanych koszy: ${k.ile}.`),
  (k) =>
    k.jeden
      ? "Kosz jest jeden."
      : k.duzo
        ? `Koszy jest ${k.ile}, więc o miejsce raczej nie trzeba się bić.`
        : `Koszy jest ${k.ile}.`,
  (k) => `Rzuty lecą do ${k.jeden ? "jednego kosza" : `${k.ile} koszy`}.`,
];

/* ------------------------------------------------------------------ oświetlenie */

const ZDANIA_OSWIETLENIE: readonly ((jest: boolean) => string)[] = [
  (j) => (j ? "Boisko jest oświetlone." : "Boisko nie ma oświetlenia."),
  (j) => (j ? "Po zmroku świecą lampy." : "Po zmroku jest tu ciemno."),
  (j) =>
    j
      ? "Jest oświetlenie, więc gra się i po ciemku."
      : "Bez oświetlenia - gra kończy się razem z dniem.",
  (j) =>
    j
      ? "Wieczorem światło działa na twoją korzyść."
      : "Wieczorem trzeba liczyć na to, co świeci z ulicy.",
  (j) => (j ? "Oświetlenie: jest." : "Oświetlenia: brak."),
  (j) => (j ? "Lampy nad płytą." : "Nad płytą nie ma lamp."),
  (j) => (j ? "Po zachodzie słońca gra się dalej." : "Po zachodzie słońca gra się już na pamięć."),
  (j) => (j ? "Światło pozwala zostać dłużej." : "Bez światła wieczór odpada."),
  (j) => (j ? "Jest czym świecić." : "Nie ma czym świecić."),
  (j) => (j ? "Oświetlone." : "Nieoświetlone."),
  (j) =>
    j
      ? "Wieczorna gra bez przeszkód - jest oświetlenie."
      : "Wieczorna gra tylko latem - nie ma oświetlenia.",
  (j) =>
    j
      ? "Zapala się światło, więc mecz nie kończy się o zachodzie."
      : "Światła nie ma, więc mecz kończy zachód słońca.",
  (j) => (j ? "Lampy są." : "Lamp nie ma."),
  (j) => (j ? "Da się grać po zmroku." : "Po zmroku grać się nie da."),
  (j) => (j ? "Oświetlenie na miejscu." : "Oświetlenia na miejscu nie ma."),
  (j) => (j ? "Zmrok nie przerywa gry." : "Zmrok przerywa grę."),
  (j) => (j ? "Nocna zmiana ma światło." : "Nocna zmiana odpada - ciemno."),
  (j) => (j ? "Wieczorem widać kosz." : "Wieczorem kosza się nie widzi."),
  (j) => (j ? "Po ciemku też rzucisz." : "Po ciemku rzutów nie policzysz."),
  (j) => (j ? "Jest oświetlenie." : "Nie ma oświetlenia."),
  (j) => (j ? "Latarnie nad boiskiem robią swoje." : "Nad boiskiem nie ma latarni."),
  (j) => (j ? "Gra po zmroku: możliwa." : "Gra po zmroku: bez szans."),
  (j) => (j ? "Oświetlenie działa na plus." : "Brak oświetlenia to główny minus."),
  (j) => (j ? "Wieczór to tu normalna pora gry." : "Wieczór to tu koniec gry."),
  (j) => (j ? "Ma światło." : "Nie ma światła."),
  (j) => (j ? "Rzucisz też po zachodzie." : "Po zachodzie zostaje pamięć mięśniowa."),
  (j) => (j ? "Boisko świeci po zmroku." : "Boisko gaśnie razem z dniem."),
  (j) =>
    j
      ? "Światło jest, więc zima nie skraca gry aż tak."
      : "Bez światła zima skraca grę do popołudnia.",
  (j) => (j ? "Z oświetleniem." : "Bez oświetlenia."),
  (j) => (j ? "Światło nad płytą jest." : "Światła nad płytą nie ma."),
];

/* ------------------------------------------------------------------ ogrodzenie */

const ZDANIA_OGRODZENIE: readonly ((jest: boolean) => string)[] = [
  (j) => (j ? "Boisko jest ogrodzone." : "Boisko nie jest ogrodzone."),
  (j) => (j ? "Siatka wokół, piłka nie ucieka." : "Bez siatki - piłka po nieudanym rzucie odjeżdża."),
  (j) => (j ? "Ogrodzenie trzyma piłkę na płycie." : "Nic nie trzyma piłki na płycie."),
  (j) => (j ? "Ogrodzenie: jest." : "Ogrodzenia: brak."),
  (j) => (j ? "Piłka zostaje w środku." : "Piłka lubi tu uciekać."),
  (j) => (j ? "Płot wokół płyty." : "Płyta bez płotu."),
  (j) =>
    j
      ? "Zabłąkany rzut nie skończy się bieganiem za piłką."
      : "Zabłąkany rzut kończy się bieganiem za piłką.",
  (j) => (j ? "Ogrodzone." : "Nieogrodzone."),
  (j) => (j ? "Siatka jest." : "Siatki nie ma."),
  (j) => (j ? "Wokół ogrodzenie." : "Wokół nic - otwarta przestrzeń."),
  (j) => (j ? "Ogrodzenie oszczędza nogi." : "Brak ogrodzenia dokłada trochę biegania."),
  (j) => (j ? "Piłka odbija się od siatki i wraca." : "Piłka wyjeżdża poza płytę."),
  (j) => (j ? "Z ogrodzeniem." : "Bez ogrodzenia."),
  (j) => (j ? "Ogrodzenie wokół płyty." : "Wokół płyty nie ma ogrodzenia."),
  (j) => (j ? "Nikt nie goni piłki po chodniku." : "Piłkę czasem trzeba gonić po chodniku."),
  (j) => (j ? "Ogrodzenie stoi na miejscu." : "Ogrodzenia tu nie postawiono."),
  (j) => (j ? "Boisko zamknięte siatką." : "Boisko otwarte na wszystkie strony."),
  (j) => (j ? "Siatka wokół." : "Ani siatki, ani płotu."),
  (j) =>
    j ? "Ogrodzenie zdejmuje z gry element pościgu." : "Do gry dochodzi element pościgu za piłką.",
  (j) => (j ? "Ma ogrodzenie." : "Nie ma ogrodzenia."),
  (j) => (j ? "Płyta w siatce." : "Płyta bez siatki."),
  (j) => (j ? "Ogrodzenie chroni też przechodniów." : "Bez ogrodzenia warto uważać na przechodniów."),
  (j) => (j ? "Piłka nie wypada za linię płotu." : "Piłkę zatrzyma dopiero to, co stoi obok."),
  (j) => (j ? "Ogrodzone dookoła." : "Otwarte dookoła."),
  (j) => (j ? "Ogrodzenie to spory komfort." : "Brak ogrodzenia to główna niewygoda."),
  (j) => (j ? "Jest płot." : "Nie ma płotu."),
  (j) => (j ? "Siatka zamyka boisko." : "Boiska nic nie zamyka."),
  (j) =>
    j
      ? "Ogrodzenie oszczędza czas między rzutami."
      : "Bez ogrodzenia rzut obok kosza kosztuje kilka sekund.",
  (j) => (j ? "Boisko w ogrodzeniu." : "Boisko bez ogrodzenia."),
  (j) => (j ? "Ogrodzenie stoi wokół boiska." : "Wokół boiska nie ma ogrodzenia."),
];

/* ------------------------------------------------------------------ dostęp i godziny */

interface FormyDostepu {
  zawsze: boolean;
  ograniczony: boolean;
  /** czy w polu godzin stoi konkretny zakres, a nie słowny opis */
  znane: boolean;
  /** surowa treść pola godzin - wpisuje ją człowiek, więc bywa czymkolwiek */
  godziny: string;
  /** „całą dobę", „w godzinach 06:00 - 22:00", „w wyznaczonych godzinach, z ograniczeniami" */
  fraza: string;
  /** krótka postać do zdań typu „Dostęp: ..." */
  krotko: string;
}

const ZDANIA_DOSTEP: readonly ((d: FormyDostepu) => string)[] = [
  (d) => `Otwarte ${d.fraza}.`,
  (d) => `Dostępne ${d.fraza}.`,
  (d) => (d.zawsze ? "Wejdziesz o każdej porze." : `Wejdziesz ${d.fraza}.`),
  (d) => (d.zawsze ? "Grasz o dowolnej godzinie." : `Grasz ${d.fraza}.`),
  (d) => `Dostęp ${d.fraza}.`,
  (d) =>
    d.zawsze
      ? "Bez godzin otwarcia - wchodzisz, kiedy chcesz."
      : d.znane
        ? `Godziny: ${d.krotko}.`
        : `Otwarte ${d.fraza}.`,
  (d) =>
    d.ograniczony
      ? "Dostęp bywa ograniczony, więc lepiej sprawdzić przed wyjściem."
      : `Otwarte ${d.fraza}.`,
  (d) => `Można grać ${d.fraza}.`,
  (d) => (d.zawsze ? "Całodobowo." : `Otwarte ${d.fraza}.`),
  (d) => (d.zawsze ? "O każdej porze." : `Tylko ${d.fraza}.`),
  (d) => `Boisko czynne ${d.fraza}.`,
  (d) => (d.zawsze ? "Wchodzisz bez patrzenia na godzinę." : `Wchodzisz ${d.fraza}.`),
  (d) => (d.ograniczony ? "Wejście z ograniczeniami." : `Wejście ${d.fraza}.`),
  (d) => `Czynne ${d.fraza}.`,
  (d) => (d.zawsze ? "Zawsze otwarte." : `Otwarte ${d.fraza}.`),
  (d) => `Do gry ${d.fraza}.`,
  (d) =>
    d.zawsze
      ? "Godzin otwarcia nie ma."
      : d.znane
        ? `Godziny otwarcia: ${d.krotko}.`
        : `Otwarte ${d.fraza}.`,
  (d) => (d.ograniczony ? `Dostęp ${d.fraza}.` : `Otwarte dla wszystkich ${d.fraza}.`),
  (d) =>
    d.zawsze ? "Kiedy chcesz." : d.znane ? `Kiedy otwarte: ${d.krotko}.` : `Otwarte ${d.fraza}.`,
  (d) => (d.zawsze ? "Zagrasz o każdej porze." : `Zagrasz ${d.fraza}.`),
  (d) => (d.ograniczony ? "Dostęp ograniczony - warto zapytać na miejscu." : `Otwarte ${d.fraza}.`),
  (d) => `Boisko otwarte ${d.fraza}.`,
  (d) =>
    d.zawsze
      ? "Bez ograniczeń godzinowych."
      : d.znane
        ? `Z ograniczeniem godzin: ${d.krotko}.`
        : `Otwarte ${d.fraza}.`,
  (d) => `Wstęp ${d.fraza}.`,
  (d) => (d.zawsze ? "Otwarte dzień i noc." : `Otwarte ${d.fraza}.`),
  (d) => `Gra się tu ${d.fraza}.`,
  (d) => (d.ograniczony ? "Wejście nie zawsze jest możliwe." : `Wejście ${d.fraza}.`),
  (d) => (d.zawsze || d.znane ? `Dostęp: ${d.krotko}.` : `Dostęp ${d.fraza}.`),
  (d) =>
    d.zawsze
      ? "Bez zamykania na noc."
      : d.znane
        ? `Poza godzinami ${d.godziny} bywa zamknięte.`
        : `Otwarte ${d.fraza}.`,
  (d) => (d.znane ? `Godziny: ${d.godziny}.` : `Otwarte ${d.fraza}.`),
];

/* ------------------------------------------------------------------ złożenie */

/** Tyle danych wystarczy - zdjęcia, opis i autor nie mają tu nic do rzeczy. */
type DaneOpisu = Pick<
  Court,
  "id" | "type" | "surface" | "hoops" | "lit" | "fenced" | "access" | "hours"
>;

function formyDostepu(access: Access, hours: string): FormyDostepu {
  const godziny = (hours ?? "").trim();
  /*
    Pole godzin wypełnia człowiek w kreatorze, więc bywa i „06:00 - 22:00", i „całą dobę",
    i „po zajęciach szkolnych". Zdania, które wstawiają je w zwrot „w godzinach ...", mają
    sens tylko dla zakresu z cyframi - dlatego to jest osobna informacja, a nie założenie.
  */
  const znane = /\d/.test(godziny);
  const zawsze = access === "24h";
  const ograniczony = access === "ograniczony";

  const trzon = znane ? `w godzinach ${godziny}` : "w wyznaczonych godzinach";

  return {
    zawsze,
    ograniczony,
    znane,
    godziny,
    fraza: zawsze ? "całą dobę" : ograniczony ? `${trzon}, z ograniczeniami` : trzon,
    krotko: zawsze ? "całą dobę" : znane ? godziny : "wyznaczone godziny",
  };
}

/**
 * Zdania o boisku, w kolejności do złożenia w akapit.
 *
 * Kolejność jest stała - kosze, nawierzchnia, oświetlenie, ogrodzenie, godziny - i to jest
 * celowe. Mieszanie jej dawałoby jeszcze więcej układów, ale akapit czyta się wtedy jak
 * lista wylosowanych faktów; przy stałej kolejności każde boisko opowiada się tak samo
 * i zmieniają się tylko słowa.
 */
export function zdaniaOBoisku(court: DaneOpisu): string[] {
  /*
    Najpierw sloty - dopiero potem tekst. Wariant trzeba móc przesunąć o jeden, gdy dwa
    sąsiednie zdania wypadną z tym samym początkiem (patrz niżej), a do tego potrzebna
    jest cała lista wariantów w chwili składania, nie gotowy napis.
  */
  const sloty: { ziarno: string; warianty: readonly (() => string)[] }[] = [];

  if (court.hoops > 0) {
    const formy: FormyKoszy = {
      ile: court.hoops,
      rzecz: plural(court.hoops, ["kosz", "kosze", "koszy"]),
      slownie: SLOWNIE[court.hoops] ?? String(court.hoops),
      jeden: court.hoops === 1,
      para: court.hoops === 2,
      duzo: court.hoops >= 4,
    };
    sloty.push({
      ziarno: `${court.id}|kosze|${court.hoops}`,
      warianty: ZDANIA_KOSZE.map((z) => () => z(formy)),
    });
  }

  /*
    Nawierzchnie spoza listy (w bazie siedzi jeszcze stary „tartan") nie dostają zdania.
    Ich odmiany nie znamy, a zgadywanie jej regułą kończy się zdaniem „gra się na tartan" -
    i to na wszystkich boiskach z tą wartością naraz. Kafelek z nawierzchnią pokazuje ją
    wtedy tak jak dotąd, tylko akapit o niej milczy.
  */
  const nawierzchnia = NAWIERZCHNIE[court.surface as Surface];
  if (nawierzchnia) {
    sloty.push({
      ziarno: `${court.id}|nawierzchnia|${court.surface}`,
      warianty: ZDANIA_NAWIERZCHNIA.map((z) => () => z(nawierzchnia)),
    });
  }

  sloty.push({
    ziarno: `${court.id}|swiatlo|${court.lit}`,
    warianty: ZDANIA_OSWIETLENIE.map((z) => () => z(court.lit)),
  });

  /*
    Boiska kryte nie dostają zdania o ogrodzeniu. Hala ma ściany, więc i „ogrodzone",
    i „bez ogrodzenia" brzmiałoby tam jak pomyłka - a w bazie to pole i tak ktoś musiał
    czymś wypełnić.
  */
  if ((court.type as CourtType) !== "kryty") {
    sloty.push({
      ziarno: `${court.id}|plot|${court.fenced}`,
      warianty: ZDANIA_OGRODZENIE.map((z) => () => z(court.fenced)),
    });
  }

  const dostep = formyDostepu(court.access, court.hours);
  sloty.push({
    ziarno: `${court.id}|dostep|${court.access}|${court.hours}`,
    warianty: ZDANIA_DOSTEP.map((z) => () => z(dostep)),
  });

  /*
    Warianty każdej cechy wybierają się niezależnie, więc czasem trafią na siebie dwa
    zdania o tym samym początku - „Brak oświetlenia to główny minus. Brak ogrodzenia to
    główna niewygoda." Zdania są prawdziwe, ale akapit wygląda wtedy na złożony z szablonu,
    a to jest dokładnie to, czego trzydzieści wariantów miało uniknąć. Wystarczy przesunąć
    o jeden wariant dalej: jest z czego wybierać, a wynik zostaje policzalny z danych.
  */
  const zdania: string[] = [];
  for (const slot of sloty) {
    const i = skrot(slot.ziarno) % slot.warianty.length;
    let tekst = slot.warianty[i]();
    const poprzednie = zdania[zdania.length - 1];
    if (poprzednie && pierwszeSlowo(poprzednie) === pierwszeSlowo(tekst)) {
      tekst = slot.warianty[(i + 1) % slot.warianty.length]();
    }
    zdania.push(tekst);
  }

  return zdania;
}
