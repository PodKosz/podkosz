import { SITE_URL } from "@/lib/site";

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
 * Dlaczego HTML jest napisany tabelami i stylami w atrybutach: klienci poczty nie mają
 * nowoczesnego CSS-a. Nie ma tu flexboxa, gridów ani zmiennych - Outlook renderuje maile
 * silnikiem Worda. Stylistykę strony (czerń, pomarańczowe światła, kontur boiska, logo)
 * dają wypalone PNG-i z `public/mail/`, bo SVG i gradienty CSS klienci wycinają.
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

/*
  Numer wersji w adresie nie jest ozdobą: Gmail przepuszcza obrazki przez własny serwer
  pośredniczący i trzyma je tam pod adresem, więc podmiana pliku o tej samej nazwie nie
  dotarłaby do nikogo, kto już raz go pobrał. Zmiana numeru po każdej przeróbce grafiki
  gwarantuje, że nowe listy dostają nową wersję.
*/
const TLO = `${SITE_URL}/mail/tlo.png?v=2`;
const LOGO = `${SITE_URL}/mail/logo.png?v=2`;

/* Kolory z app/globals.css - trzymamy je tu osobno, bo mail nie widzi arkusza strony. */
const CZERN = "#07070a";
const KREDA = "#f5f5f7";
const PRZYGASZONY = "#a7a6ad";
const SLABY = "#77767d";
const PLOMIEN = "#ff7a18";
const ZAR = "#ffb25c";
const KRESKA = "#241a13";
const CZCIONKA = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

/** Bezpiecznik na wypadek nicku z nawiasem ostrym - nick pochodzi od użytkownika. */
function esc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function naglowek(tekst: string, wyrozniony: string) {
  return `<h1 style="margin:0 0 18px;font-family:${CZCIONKA};font-size:32px;line-height:1.18;
    font-weight:600;letter-spacing:-0.5px;color:${KREDA};">${tekst}
    <span style="color:${PLOMIEN};">${wyrozniony}</span></h1>`;
}

function akapit(tresc: string, kolor = PRZYGASZONY) {
  return `<p style="margin:0 0 16px;font-family:${CZCIONKA};font-size:15px;line-height:1.65;
    color:${kolor};">${tresc}</p>`;
}

/** Kafelek z akcentem po lewej - w mailu to najprostszy sposób na „wyróżnioną ramkę". */
function kafelek(zawartosc: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:6px 0 24px;">
    <tr>
      <td width="3" bgcolor="${PLOMIEN}" style="width:3px;background-color:${PLOMIEN};"></td>
      <td bgcolor="#0e0d10" style="padding:18px 20px;background-color:#0e0d10;
        border:1px solid ${KRESKA};border-left:0;">${zawartosc}</td>
    </tr>
  </table>`;
}

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

function przycisk(napis: string, adres: string) {
  /* Przycisk też jest tabelą - <a> z paddingiem gubi tło w Outlooku. */
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
    style="margin:8px 0 4px;">
    <tr>
      <td bgcolor="${PLOMIEN}" style="background-color:${PLOMIEN};border-radius:999px;">
        <a href="${adres}" style="display:inline-block;padding:14px 30px;font-family:${CZCIONKA};
          font-size:15px;font-weight:700;color:#1a0c02;text-decoration:none;">${napis}</a>
      </td>
    </tr>
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

  /*
    Outlook nie zna background-image, więc pod treść wkładamy warunkowy prostokąt VML
    z tym samym plikiem. Poza Outlookiem ten blok jest niewidoczny (komentarz HTML).
  */
  const vmlTlo = `<!--[if gte mso 9]>
  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
    style="width:600px;height:1500px;position:absolute;top:0;left:0;">
    <v:fill type="frame" src="${TLO}" color="${CZERN}" />
  </v:rect>
  <![endif]-->`;

  return `<!doctype html>
<html lang="pl" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>PodKosz</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  /*
    Klienci poczty same zamieniają adresy, daty i numery w linki i malują je na niebiesko -
    tak zrobiło się z napisem „podkosz.pl" w nagłówku. Poniższe reguły oddają im kolor
    z powrotem. Sam napis w nagłówku i tak nie zawiera już domeny, ale w treści adresy
    padają, więc zabezpieczenie zostaje.
  */
  a[x-apple-data-detectors],
  .x-gmail-data-detectors,
  .x-gmail-data-detectors *,
  .aBn {
    color: inherit !important;
    text-decoration: none !important;
    border-bottom: 0 !important;
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CZERN};">

<!-- tekst podglądu na liście wiadomości - w treści niewidoczny -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${podglad}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="${CZERN}" style="background-color:${CZERN};">
<tr><td align="center" style="padding:0;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:600px;max-width:600px;">
  <tr>
    <!--
      Kontur boiska: obrazek tła na komórce (atrybut background dla starych klientów,
      background-image dla nowych) plus VML dla Outlooka. Gdy klient wytnie wszystkie
      trzy, zostaje czysta czerń z bgcolor - list nadal się czyta.
    -->
    <td background="${TLO}" bgcolor="${CZERN}" valign="top"
      style="background-color:${CZERN};background-image:url('${TLO}');
      background-repeat:no-repeat;background-position:top center;background-size:600px auto;
      padding:44px 40px 30px;">
      ${vmlTlo}
      <div style="position:relative;">

        <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:3px;
          text-transform:uppercase;color:${PLOMIEN};padding-bottom:14px;">PodKosz</div>

        ${naglowekHtml}
        ${wstep}
        ${pionierBlok}

        <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
          text-transform:uppercase;color:${ZAR};padding:18px 0 16px;">
          Osiem rzeczy na start</div>

        ${lista(NA_START)}
        ${betaBlok}
        ${przycisk("Wejdź na mapę", SITE_URL)}

      </div>
    </td>
  </tr>

  <!-- stopka: logo na środku pod treścią -->
  <tr>
    <td align="center" bgcolor="${CZERN}" style="background-color:${CZERN};
      padding:34px 40px 44px;border-top:1px solid ${KRESKA};">
      <a href="${SITE_URL}" style="text-decoration:none;">
        <img src="${LOGO}" alt="PodKosz" width="200" height="61"
          style="display:block;border:0;outline:none;width:200px;height:auto;">
      </a>
      <div style="font-family:${CZCIONKA};font-size:12px;line-height:1.7;color:${SLABY};
        padding-top:16px;">
        Mapa boisk do koszykówki w Polsce &middot;
        <a href="${SITE_URL}" style="color:${PRZYGASZONY};text-decoration:none;">podkosz.pl</a>
      </div>
      <div style="font-family:${CZCIONKA};font-size:11px;line-height:1.7;color:${SLABY};
        padding-top:10px;">
        Dostajesz tę wiadomość, bo w PodKoszu powstało konto na ten adres.
        To jedyny mail powitalny - nie ma tu żadnej listy wysyłkowej.
      </div>
    </td>
  </tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
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
