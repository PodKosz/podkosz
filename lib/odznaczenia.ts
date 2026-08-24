/**
 * Odznaczenia w konwencji ognia.
 *
 * Zamiast brązu, srebra, złota i diamentu mamy cztery stopnie: Iskra (złoto), Żar
 * (pomarańcz), Płomień (czerwień) i Ogień. Ostatni jest odpowiednikiem diamentu -
 * najgorętszy płomień świeci na niebiesko, więc szczyt jako jedyny jest chłodny.
 *
 * Każde odznaczenie to jedna liczba z profilu i cztery progi. Nie ma tu punktów ani
 * mnożników: patrzysz na kafelek i od razu wiesz, ile brakuje do kolejnego stopnia.
 * Kilka odznaczeń jest bez progów - dostaje się je raz, za konkretny wyczyn.
 */

export type IdPoziomu = "iskra" | "zar" | "plomien" | "niebieski";

export interface Poziom {
  id: IdPoziomu;
  nazwa: string;
}

/** Kolejność ma znaczenie: indeks + 1 to numer stopnia. */
export const POZIOMY: Poziom[] = [
  { id: "iskra", nazwa: "Iskra" },
  { id: "zar", nazwa: "Żar" },
  { id: "plomien", nazwa: "Płomień" },
  { id: "niebieski", nazwa: "Ogień" },
];

/** Liczby z profilu, na których stoją wszystkie odznaczenia. */
export interface StatystykiGracza {
  boiska: number;
  podpaleniaZebrane: number;
  podpaleniaDane: number;
  ulubione: number;
  godziny: number;
  dni: number;
  miasta: number;
  wojewodztwa: number;
  zdjecia: number;
  nocne: boolean;
  ranne: boolean;
  pionier: boolean;
  /** gra w sobotę albo niedzielę */
  weekend: boolean;
  /** sześć godzin gry w jednym dniu */
  maraton: boolean;
  /** najdłuższa seria dni z grą pod rząd */
  seria: number;
  /** gra w grudniu, styczniu albo lutym */
  zima: boolean;
  /** własne boisko z oświetleniem */
  oswietlone: boolean;
  /** własne boisko z plakietką twórcy */
  approved: boolean;
  /** własne boisko z plakietką „Śmieszne boisko” */
  smieszne: boolean;
  /** własne boisko z pełnym zestawem kadrów */
  komplet: boolean;
  /** ile różnych nawierzchni mają dodane boiska */
  nawierzchnie: number;
  /** ile różnych typów boisk: otwarte, kryte, streetball */
  typy: number;
  /** pierwsze boisko w jakiejś miejscowości */
  pierwszyWMiescie: boolean;
}

export const PUSTE_STATYSTYKI: StatystykiGracza = {
  boiska: 0,
  podpaleniaZebrane: 0,
  podpaleniaDane: 0,
  ulubione: 0,
  godziny: 0,
  dni: 0,
  miasta: 0,
  wojewodztwa: 0,
  zdjecia: 0,
  nocne: false,
  ranne: false,
  pionier: false,
  weekend: false,
  maraton: false,
  seria: 0,
  zima: false,
  oswietlone: false,
  approved: false,
  smieszne: false,
  komplet: false,
  nawierzchnie: 0,
  typy: 0,
  pierwszyWMiescie: false,
};

interface DefinicjaProgowa {
  id: string;
  nazwa: string;
  /** co się liczy - pod nazwą odznaczenia */
  licznik: string;
  /** krótkie wyjaśnienie, skąd bierze się liczba */
  opis: string;
  progi: [number, number, number, number];
  wartosc: (s: StatystykiGracza) => number;
}

/*
  Progi są niesymetryczne z rozmysłem: pierwszy stopień ma być w zasięgu jednego wieczoru,
  a ostatni ma zostać rzadki także wtedy, gdy baza urośnie dziesięciokrotnie.
*/
const PROGOWE: DefinicjaProgowa[] = [
  {
    id: "odkrywca",
    nazwa: "Odkrywca",
    licznik: "dodane boiska",
    opis: "Zgłoszone boiska, które przeszły weryfikację.",
    progi: [1, 5, 15, 40],
    wartosc: (s) => s.boiska,
  },
  {
    id: "podpalacz",
    nazwa: "Podpalacz",
    licznik: "podpalone boiska",
    opis: "Podpalone boiska - po jednej płonącej piłce na boisko.",
    progi: [5, 25, 75, 200],
    wartosc: (s) => s.podpaleniaDane,
  },
  {
    id: "kolekcjoner",
    nazwa: "Kolekcjoner",
    licznik: "ulubione boiska",
    opis: "Boiska zapisane na własnej liście ulubionych.",
    progi: [3, 10, 30, 75],
    wartosc: (s) => s.ulubione,
  },
  {
    id: "bywalec",
    nazwa: "Bywalec",
    licznik: "godziny na boisku",
    opis: "Godziny z zapisów na grę, które już minęły.",
    progi: [5, 25, 100, 300],
    wartosc: (s) => s.godziny,
  },
  {
    id: "regularny",
    nazwa: "Regularny",
    licznik: "dni z grą",
    opis: "Różne dni z zapisem na grę.",
    progi: [3, 10, 30, 100],
    wartosc: (s) => s.dni,
  },
  {
    id: "gospodarz",
    nazwa: "Gospodarz",
    licznik: "zebrane podpalenia",
    opis: "Płonące piłki zebrane przez własne boiska.",
    progi: [10, 50, 200, 600],
    wartosc: (s) => s.podpaleniaZebrane,
  },
  {
    id: "podroznik",
    nazwa: "Podróżnik",
    licznik: "miejscowości",
    opis: "Miejscowości, z których pochodzą dodane boiska.",
    progi: [2, 5, 12, 25],
    wartosc: (s) => s.miasta,
  },
  {
    id: "kartograf",
    nazwa: "Kartograf",
    licznik: "województwa",
    opis: "Województwa z co najmniej jednym dodanym boiskiem.",
    progi: [2, 5, 10, 16],
    wartosc: (s) => s.wojewodztwa,
  },
  {
    id: "fotograf",
    nazwa: "Fotograf",
    licznik: "zdjęcia w bazie",
    opis: "Kadry na kartach dodanych boisk.",
    progi: [10, 50, 150, 400],
    wartosc: (s) => s.zdjecia,
  },
];

/** Odznaczenie z policzonym stopniem i drogą do następnego. */
export interface Odznaczenie {
  id: string;
  nazwa: string;
  licznik: string;
  opis: string;
  wartosc: number;
  /** 0 = jeszcze nic, 1-4 = numer stopnia */
  stopien: number;
  poziom: Poziom | null;
  /** cel następnego stopnia (null, gdy zdobyte wszystko) */
  nastepny: { poziom: Poziom; prog: number; brakuje: number } | null;
  /** droga od poprzedniego progu do następnego (0-1) - do opisu, ile brakuje */
  postep: number;
  /** wypełnienie paska: cała droga do najwyższego stopnia (0-1) */
  postepPelny: number;
}

/**
 * Barwa wyróżnienia.
 *
 * Wyróżnienia NIE mają stopni, więc nie mogą korzystać z palety ognia - tam kolor niesie
 * informację „jak wysoko", a tutaj nie ma czego mierzyć. Każde ma więc własną barwę,
 * jednakową dla wszystkich, którzy je zdobyli. To także sygnał dla oka: pomarańcz i błękit
 * to progi, cała reszta to jednorazowe wyczyny.
 */
export type BarwaWyroznienia =
  | "zloto"
  | "limonka"
  | "fiolet"
  | "lazur"
  | "roza"
  | "mieta"
  | "blekit"
  | "miedz";

/** Odznaczenie bez progów - albo je masz, albo nie. */
export interface Wyroznienie {
  id: string;
  nazwa: string;
  /** za co jest - jednym zdaniem */
  opis: string;
  /** warunek zdobycia, słowami; pokazujemy przy tych jeszcze niezdobytych */
  warunek: string;
  barwa: BarwaWyroznienia;
  zdobyte: boolean;
}

export function odznaczenia(s: StatystykiGracza): Odznaczenie[] {
  return PROGOWE.map((d) => {
    const wartosc = d.wartosc(s);
    const stopien = d.progi.filter((p) => wartosc >= p).length;
    const nastepnyProg = d.progi[stopien];

    /*
      Pasek pokazuje drogę między progami, a nie od zera - inaczej przy skoku z 15 na 40
      wyglądałby, jakby nic się nie działo przez pierwsze dwadzieścia boisk.
    */
    const poprzedniProg = stopien > 0 ? d.progi[stopien - 1] : 0;
    const postep =
      nastepnyProg === undefined
        ? 1
        : Math.min(1, Math.max(0, (wartosc - poprzedniProg) / (nastepnyProg - poprzedniProg)));

    /*
      Pasek pokazuje CAŁĄ drogę do szczytu, nie postęp w obrębie jednego stopnia: dzięki
      temu jego kolor - brąz, pomarańcz, na końcu błękit - mówi, jak wysoko już jest.
      Ile brakuje do najbliższego progu, pisze podpis pod paskiem.
    */
    const postepPelny = (stopien + (nastepnyProg === undefined ? 0 : postep)) / POZIOMY.length;

    return {
      id: d.id,
      nazwa: d.nazwa,
      licznik: d.licznik,
      opis: d.opis,
      wartosc,
      stopien,
      poziom: stopien > 0 ? POZIOMY[stopien - 1] : null,
      nastepny:
        nastepnyProg === undefined
          ? null
          : {
              poziom: POZIOMY[stopien],
              prog: nastepnyProg,
              brakuje: nastepnyProg - wartosc,
            },
      postep,
      postepPelny,
    };
  });
}

export function wyroznienia(s: StatystykiGracza): Wyroznienie[] {
  return [
    {
      id: "pionier",
      nazwa: "Pionier",
      opis: "Konto w pierwszej setce w serwisie.",
      warunek: "Załóż konto, dopóki jest ich mniej niż sto.",
      barwa: "zloto",
      zdobyte: s.pionier,
    },
    {
      id: "pierwszy-w-miescie",
      nazwa: "Pierwszy na miejscu",
      opis: "Najstarsze boisko w swojej miejscowości.",
      warunek: "Dodaj boisko w miejscowości, w której nie ma jeszcze żadnego.",
      barwa: "roza",
      zdobyte: s.pierwszyWMiescie,
    },
    {
      id: "oswietlone",
      nazwa: "Pod światłami",
      opis: "Własne boisko z oświetleniem.",
      warunek: "Dodaj boisko, na którym da się grać po zmroku.",
      barwa: "fiolet",
      zdobyte: s.oswietlone,
    },
    {
      id: "approved",
      nazwa: "Basket Approved",
      opis: "Własne boisko z plakietką twórcy serwisu.",
      warunek: "Dodaj boisko, które dostanie plakietkę Basket Approved.",
      barwa: "zloto",
      zdobyte: s.approved,
    },
    {
      id: "smieszne",
      nazwa: "Kosz z jajem",
      opis: "Własne boisko z plakietką „Śmieszne boisko”.",
      warunek: "Znajdź boisko tak dziwne, że dostanie plakietkę „Śmieszne boisko”.",
      barwa: "limonka",
      zdobyte: s.smieszne,
    },
    {
      id: "komplet",
      nazwa: "Komplet kadrów",
      opis: "Boisko sfotografowane w całości, bez braków.",
      warunek: "Dodaj boisko z co najmniej sześcioma różnymi kadrami.",
      barwa: "mieta",
      zdobyte: s.komplet,
    },
    {
      id: "nawierzchnie",
      nazwa: "Znawca nawierzchni",
      opis: "Cztery różne nawierzchnie w dodanych boiskach.",
      warunek: "Dodaj boiska o czterech różnych nawierzchniach.",
      barwa: "miedz",
      zdobyte: s.nawierzchnie >= 4,
    },
    {
      id: "typy",
      nazwa: "Trzy oblicza gry",
      opis: "Boisko otwarte, kryte i streetballowe.",
      warunek: "Dodaj po jednym boisku każdego typu: otwarte, kryte i streetball.",
      barwa: "blekit",
      zdobyte: s.typy >= 3,
    },
    {
      id: "pelna-mapa",
      nazwa: "Pełna mapa",
      opis: "Boisko w każdym z 16 województw.",
      warunek: "Dodaj boisko w każdym województwie.",
      barwa: "mieta",
      zdobyte: s.wojewodztwa >= 16,
    },
    {
      id: "nocny-marek",
      nazwa: "Nocny marek",
      opis: "Zapis na grę o 21:00 albo później.",
      warunek: "Zapisz się na grę na 21:00 albo później.",
      barwa: "fiolet",
      zdobyte: s.nocne,
    },
    {
      id: "ranny-ptaszek",
      nazwa: "Ranny ptaszek",
      opis: "Zapis na grę o 8:00 albo wcześniej.",
      warunek: "Zapisz się na grę na 8:00 albo wcześniej.",
      barwa: "lazur",
      zdobyte: s.ranne,
    },
    {
      id: "swit-i-noc",
      nazwa: "Od świtu do nocy",
      opis: "Gra i o świcie, i po zmroku.",
      warunek: "Zdobądź Nocnego marka i Rannego ptaszka.",
      barwa: "blekit",
      zdobyte: s.nocne && s.ranne,
    },
    {
      id: "weekend",
      nazwa: "Weekendowy wojownik",
      opis: "Gra w sobotę albo w niedzielę.",
      warunek: "Zapisz się na grę w weekend.",
      barwa: "roza",
      zdobyte: s.weekend,
    },
    {
      id: "maraton",
      nazwa: "Maratończyk",
      opis: "Sześć godzin gry w jednym dniu.",
      warunek: "Zaznacz sześciogodzinny zakres gry w jednym dniu.",
      barwa: "miedz",
      zdobyte: s.maraton,
    },
    {
      id: "seria-tygodnia",
      nazwa: "Tydzień pod koszem",
      opis: "Siedem dni z grą jeden po drugim.",
      warunek: "Zapisz się na grę w siedmiu kolejnych dniach.",
      barwa: "limonka",
      zdobyte: s.seria >= 7,
    },
    {
      id: "zima",
      nazwa: "Mrozoodporny",
      opis: "Gra w grudniu, styczniu albo lutym.",
      warunek: "Zapisz się na grę w miesiącu zimowym.",
      barwa: "lazur",
      zdobyte: s.zima,
    },
  ];
}

/** Ile odznaczeń zdobyte - do podsumowania nad siatką. */
export function podsumowanie(s: StatystykiGracza): { zdobyte: number; wszystkie: number } {
  const lista = odznaczenia(s);
  const extra = wyroznienia(s);
  return {
    zdobyte: lista.filter((o) => o.stopien > 0).length + extra.filter((w) => w.zdobyte).length,
    wszystkie: lista.length + extra.length,
  };
}
