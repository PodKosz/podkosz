import { SITE_URL } from "@/lib/site";
import {
  CZCIONKA,
  KREDA,
  PLOMIEN,
  PRZYGASZONY,
  ZAR,
  akapit,
  esc,
  kafelek,
  naglowek,
  nadtytul,
  przycisk,
  szkielet,
} from "./szkielet";

/**
 * Mail powitalny po pierwszym wejściu na stronę - dwie wersje.
 *
 * `beta` idzie do adresów z listy beta testerów: mówi wprost, że strona jest przed
 * premierą, i prosi o konkretne rzeczy. `gracz` to wersja zwykła, bez proszenia o testy.
 * Reszta listu jest wspólna, bo obie grupy potrzebują tej samej wiedzy na start.
 *
 * Kto trafił do pierwszej setki kont, dostaje dodatkowy akapit o wyróżnieniu „Pionier" -
 * numer konta liczy funkcja `powitanie_zaklep()` w bazie, tą samą metodą, którą profil
 * przyznaje samo wyróżnienie (patrz supabase/migration-mail-powitalny.sql).
 *
 * Sama koperta listu - czerń, kontur boiska, logo w stopce - siedzi w `szkielet.ts`,
 * wspólna z pozostałymi wiadomościami z serwisu.
 */

export type RodzajPowitania = "beta" | "gracz";

export interface DanePowitania {
  rodzaj: RodzajPowitania;
  /** nick z profilu - przy koncie Google to zwykle imię i nazwisko */
  nick: string | null;
  /** który to numer konta w serwisie */
  numer: number;
  /** czy należy dopisać akapit o wyróżnieniu „Pionier" */
  pionier: boolean;
}


/** Pierwsze słowo nicku - „Cześć, Jakub" czyta się lepiej niż „Cześć, Jakub Cichy". */
function imie(nick: string | null) {
  const pierwsze = (nick ?? "").trim().split(/\s+/)[0];
  return pierwsze && pierwsze.length > 1 ? pierwsze : null;
}

/* ---------------------------------------------------------------- treść */

/** Wiedza na start - to samo w obu wersjach maila i w wersji tekstowej. */
const NA_START: { tytul: string; tresc: string }[] = [
  {
    tytul: "Mapa jest punktem wyjścia",
    tresc:
      "Wszystkie boiska na jednej mapie Polski. Filtry zawężają ją do tego, czego szukasz " +
      "(nawierzchnia, liczba koszy, oświetlenie, ogrodzenie, godziny dostępu), a „Losowe " +
      "boisko” podrzuca miejsce, gdy nie masz pomysłu.",
  },
  {
    tytul: "Karta boiska mówi wszystko przed wyjazdem",
    tresc:
      "Zdjęcia z kilku stałych kadrów, nawierzchnia, liczba koszy, dostęp i godziny, " +
      "a obok pogoda na najbliższe godziny. Chodzi o to, żeby nie jechać na zamkniętą bramę.",
  },
  {
    tytul: "Boisko dodajesz w kilka minut",
    tresc:
      "Kreator prowadzi krok po kroku: pinezka na mapie albo pozycja z GPS-u, zdjęcia " +
      "według schematu kadrów, dane techniczne. Każde zgłoszenie sprawdzam ręcznie, " +
      "a o decyzji dostajesz maila.",
  },
  {
    tytul: "Zamiast serduszka - płonąca piłka",
    tresc:
      "„Podpalenie” to nasz polubienie: jedno na boisko, i właśnie z nich powstaje ranking " +
      "boisk. Ulubione to osobna, prywatna lista miejsc, do których wracasz.",
  },
  {
    tytul: "„Idę dziś zagrać” zwołuje ludzi",
    tresc:
      "Na karcie boiska zaznaczasz zakres godzin, w których będziesz. Inni widzą, ile osób " +
      "dziś się wybiera. Deklaracja żyje jeden dzień, więc nigdy nie jest nieaktualna.",
  },
  {
    tytul: "Dwa rankingi",
    tresc:
      "Ranking boisk - po liczbie podpaleń. Ranking graczy - po liczbie dodanych boisk, " +
      "a przy remisie wyżej stoi ten, kogo boiska częściej podpalano. W rankingu graczy " +
      "liczą się tylko konta; zgłoszenia bez logowania nie tworzą gracza.",
  },
  {
    tytul: "Odznaczenia w konwencji ognia",
    tresc:
      "Dziewięć kategorii, każda z czterema stopniami: Iskra, Żar, Płomień i - na szczycie - " +
      "Ogień. Do tego wyróżnienia za jednorazowe wyczyny, których nie da się zdobyć progami.",
  },
  {
    tytul: "Twój profil jest publiczny",
    tresc:
      "Wizytówka pod adresem podkosz.pl/gracz/twój-nick: odznaczenia, dodane boiska, " +
      "statystyki. Nick zmieniasz w ustawieniach konta, ale nie częściej niż raz na 14 dni - " +
      "to podpis pod Twoimi zgłoszeniami.",
  },
];

/** Prośby wyłącznie do beta testerów. */
const DLA_BETY: string[] = [
  "Klikaj wszystko i pisz, co nie działa - przycisk opinii jest w stopce każdej strony, " +
    "możesz też po prostu odpisać na tę wiadomość.",
  "Dodaj dwa, trzy boiska, które znasz na pamięć. To najlepszy test kreatora i zdjęć.",
  "Strona jest przed premierą: dane mogą się zmieniać, a coś może się wywalić. " +
    "Jeśli się wywali, to nie Twoja wina - daj znać, co robiłeś.",
  "Wejście jest przypisane do adresu, na który dostałeś ten mail. Loguj się tym samym " +
    "kontem Google, inaczej zasłona odbije Cię na stronę „Już niedługo”.",
];

/* ---------------------------------------------------------------- HTML */



function lista(punkty: { tytul: string; tresc: string }[]) {
  const wiersze = punkty
    .map(
      (p, i) => `<tr>
      <td width="42" valign="top" style="padding:0 0 20px;font-family:${CZCIONKA};
        font-size:15px;font-weight:700;color:${PLOMIEN};line-height:1.5;">
        ${String(i + 1).padStart(2, "0")}
      </td>
      <td valign="top" style="padding:0 0 20px;">
        <div style="font-family:${CZCIONKA};font-size:15px;font-weight:600;line-height:1.45;
          color:${KREDA};padding-bottom:4px;">${p.tytul}</div>
        <div style="font-family:${CZCIONKA};font-size:14px;line-height:1.6;
          color:${PRZYGASZONY};">${p.tresc}</div>
      </td>
    </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${wiersze}
  </table>`;
}

export function tematPowitania(dane: DanePowitania) {
  if (dane.rodzaj === "beta") return "Witaj, beta testerze - wejście do PodKosza";
  return dane.pionier ? "Witaj w PodKoszu - jesteś w pierwszej setce" : "Witaj w PodKoszu";
}

export function htmlPowitania(dane: DanePowitania) {
  const kto = imie(dane.nick);
  const powitanie = kto ? `Cześć, ${esc(kto)}. ` : "";

  const naglowekHtml =
    dane.rodzaj === "beta"
      ? naglowek("Witaj,", "beta testerze")
      : naglowek("Jesteś", "w PodKoszu");

  const wstep =
    dane.rodzaj === "beta"
      ? akapit(
          `${powitanie}Masz wejście do PodKosza jeszcze przed premierą - mapy boisk do ` +
            `koszykówki w Polsce, którą buduję razem z graczami. Dostajesz stronę w takim ` +
            `stanie, w jakim jest: działającą, ale świeżą. Dlatego przede wszystkim proszę ` +
            `Cię o oczy i o szczerość.`
        )
      : akapit(
          `${powitanie}Konto założone - jesteś w PodKoszu, największej powstającej mapie ` +
            `boisk do koszykówki w Polsce. Mapa jest tworzona przez graczy: każde boisko, ` +
            `każde zdjęcie i każda godzina dostępu to czyjeś zgłoszenie. Od teraz także Twoje.`
        );

  const pionierBlok = dane.pionier
    ? kafelek(
        `<div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;
          letter-spacing:2px;text-transform:uppercase;color:${ZAR};padding-bottom:8px;">
          Osiągnięcie odblokowane</div>
        <div style="font-family:${CZCIONKA};font-size:19px;font-weight:600;color:${KREDA};
          padding-bottom:8px;">Pionier &middot; konto nr ${dane.numer}</div>
        <div style="font-family:${CZCIONKA};font-size:14px;line-height:1.6;color:${PRZYGASZONY};">
          Jesteś w pierwszej setce osób w serwisie. Wyróżnienie „Pionier” jest już na Twoim
          profilu i zdobędzie je tylko 100 kont - potem znika z obiegu na zawsze.
        </div>`
      )
    : "";

  const betaBlok =
    dane.rodzaj === "beta"
      ? `<div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
          text-transform:uppercase;color:${ZAR};padding:14px 0 12px;">
          O co Cię proszę</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${DLA_BETY.map(
            (t) => `<tr>
            <td width="18" valign="top" style="padding:0 0 14px;font-family:${CZCIONKA};
              font-size:15px;color:${PLOMIEN};line-height:1.6;">&bull;</td>
            <td valign="top" style="padding:0 0 14px;font-family:${CZCIONKA};font-size:14px;
              line-height:1.6;color:${PRZYGASZONY};">${t}</td>
          </tr>`
          ).join("")}
        </table>`
      : "";

  const podglad =
    dane.rodzaj === "beta"
      ? "Wejście przed premierą, plus wszystko, co trzeba wiedzieć na start."
      : "Wszystko, co warto wiedzieć, zanim klikniesz pierwsze boisko.";

  const tresc = `
    ${nadtytul("PodKosz")}
    ${naglowekHtml}
    ${wstep}
    ${pionierBlok}

    <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
      text-transform:uppercase;color:${ZAR};padding:18px 0 16px;">
      Osiem rzeczy na start</div>

    ${lista(NA_START)}
    ${betaBlok}
    ${przycisk("Wejdź na mapę", SITE_URL)}
  `;

  return szkielet({
    podglad,
    tresc,
    stopka:
      "Dostajesz tę wiadomość, bo w PodKoszu powstało konto na ten adres. " +
      "To jedyny mail powitalny - nie ma tu żadnej listy wysyłkowej.",
  });
}

export function tekstPowitania(dane: DanePowitania) {
  const kto = imie(dane.nick);
  const wiersze: string[] = [];

  wiersze.push(dane.rodzaj === "beta" ? "WITAJ, BETA TESTERZE" : "JESTEŚ W PODKOSZU");
  wiersze.push("");

  wiersze.push(
    dane.rodzaj === "beta"
      ? `${kto ? `Cześć, ${kto}. ` : ""}Masz wejście do PodKosza jeszcze przed premierą - ` +
          `mapy boisk do koszykówki w Polsce, którą buduję razem z graczami.`
      : `${kto ? `Cześć, ${kto}. ` : ""}Konto założone - jesteś w PodKoszu, największej ` +
          `powstającej mapie boisk do koszykówki w Polsce.`
  );
  wiersze.push("");

  if (dane.pionier) {
    wiersze.push(`OSIĄGNIĘCIE: Pionier - konto nr ${dane.numer}`);
    wiersze.push(
      "Jesteś w pierwszej setce osób w serwisie. Wyróżnienie zdobędzie tylko 100 kont."
    );
    wiersze.push("");
  }

  wiersze.push("OSIEM RZECZY NA START");
  NA_START.forEach((p, i) => {
    wiersze.push("");
    wiersze.push(`${String(i + 1).padStart(2, "0")}. ${p.tytul}`);
    wiersze.push(`    ${p.tresc.replace(/\s+/g, " ")}`);
  });
  wiersze.push("");

  if (dane.rodzaj === "beta") {
    wiersze.push("O CO CIĘ PROSZĘ");
    DLA_BETY.forEach((t) => {
      wiersze.push(`- ${t.replace(/\s+/g, " ")}`);
    });
    wiersze.push("");
  }

  wiersze.push(`Wejdź na mapę: ${SITE_URL}`);
  wiersze.push("");
  wiersze.push("---");
  wiersze.push("PodKosz - mapa boisk do koszykówki w Polsce");
  wiersze.push("Dostajesz tę wiadomość, bo w PodKoszu powstało konto na ten adres.");

  return wiersze.join("\n");
}
