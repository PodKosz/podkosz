import { SITE_URL } from "@/lib/site";

/**
 * Wspólna oprawa listów z PodKosza: czerń, kontur boiska w tle, logo na dole.
 *
 * Wydzielona, bo listów jest już kilka (powitanie beta testera, powitanie gracza,
 * wiadomość o otwarciu serwisu) i wszystkie mają wyglądać jak jedna rodzina. Gdyby każdy
 * niósł własną kopię tabel, pierwsza poprawka tła rozjechałaby je między sobą.
 *
 * Dlaczego to tabele i style w atrybutach: klienci poczty nie mają nowoczesnego CSS-a.
 * Nie ma tu flexboxa, gridów ani zmiennych - Outlook renderuje maile silnikiem Worda.
 * Stylistykę dają wypalone PNG-i z `public/mail/`, bo SVG i gradienty CSS klienci wycinają.
 */

/*
  Numer wersji w adresie nie jest ozdobą: Gmail przepuszcza obrazki przez własny serwer
  pośredniczący i trzyma je tam pod adresem, więc podmiana pliku o tej samej nazwie nie
  dotarłaby do nikogo, kto już raz go pobrał. Zmiana numeru po każdej przeróbce grafiki
  gwarantuje, że nowe listy dostają nową wersję.
*/
export const TLO = `${SITE_URL}/mail/tlo.png?v=3`;
export const LOGO = `${SITE_URL}/mail/logo.png?v=3`;
/*
  Pas zejścia treści w czerń - kładziony na samym dole komórki z treścią. Od góry
  przezroczysty, na dole pełna czerń. Dlaczego obrazek, a nie gradient CSS: patrz nota
  o Outlooku wyżej. Dlaczego w ogóle - patrz `szkielet` na dole pliku.
*/
export const ZEJSCIE = `${SITE_URL}/mail/zejscie.png?v=3`;

/* Kolory z app/globals.css - trzymamy je tu osobno, bo mail nie widzi arkusza strony. */
export const CZERN = "#07070a";
export const KREDA = "#f5f5f7";
export const PRZYGASZONY = "#a7a6ad";
export const SLABY = "#77767d";
export const PLOMIEN = "#ff7a18";
export const ZAR = "#ffb25c";
export const CZCIONKA =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

/** Bezpiecznik na treści pochodzące od użytkownika (nick). */
export function esc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function naglowek(tekst: string, wyrozniony: string) {
  return `<h1 style="margin:0 0 18px;font-family:${CZCIONKA};font-size:32px;line-height:1.18;
    font-weight:600;letter-spacing:-0.5px;color:${KREDA};">${tekst}
    <span style="color:${PLOMIEN};">${wyrozniony}</span></h1>`;
}

export function akapit(tresc: string, kolor = PRZYGASZONY) {
  return `<p style="margin:0 0 16px;font-family:${CZCIONKA};font-size:15px;line-height:1.65;
    color:${kolor};">${tresc}</p>`;
}

/** Nadtytuł nad nagłówkiem - małe, rozstrzelone wersaliki. */
export function nadtytul(tekst: string) {
  return `<div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:${PLOMIEN};padding-bottom:14px;">${tekst}</div>`;
}

/**
 * Panel ze szkła - blok wyróżniony w treści listu.
 *
 * ------------------------------------------------------------------ czym jest „szkło" w mailu
 *
 * Na stronie szkło robi `backdrop-filter: blur()` - rozmywa to, co leży pod spodem.
 * W poczcie tego nie ma i nie będzie w żadnym kliencie, więc panel musi UDAWAĆ szybę
 * samym światłem. Trzy warstwy dają całe złudzenie:
 *
 *   1. CIEPŁY BLASK od górnego lewego narożnika - jakby padało tam światło. Promienisty,
 *      więc gaśnie we wszystkich kierunkach i nigdzie nie tworzy krawędzi.
 *   2. SPADEK JASNOŚCI z góry na dół - szyba jest jaśniejsza tam, gdzie łapie światło,
 *      i ciemnieje ku dołowi. To ta warstwa sprawia, że panel czyta się jak płyta,
 *      a nie jak prostokąt wypełniony kolorem.
 *   3. ŚWIATŁO NA GÓRNEJ KRAWĘDZI - włos o wysokości jednego piksela, GASNĄCY NA OBU
 *      KOŃCACH. Prawdziwa szyba świeci na krawędzi tylko tam, gdzie jest zwrócona do
 *      światła; włos na całą szerokość byłby kreską, a nie odblaskiem. Jest ciepły,
 *      bo to on przejął rolę pomarańczowego paska (patrz niżej).
 *
 * Do tego zaokrąglone narożniki. One robią tu więcej niż wygląda: prostokąt o ostrych
 * kantach leżący na rysunku konturu boiska czyta się jak DZIURA w tle, a zaokrąglony -
 * jak przedmiot położony na wierzchu.
 *
 * ------------------------------------------------------------------ co zniknęło i dlaczego
 *
 * Był tu pomarańczowy pasek 3 px na całej wysokości i płaskie wypełnienie w ramce.
 * Pasek miał twarde końce u góry i u dołu, a ramka odcinała się od tła z każdej strony.
 * Gasnący pasek nie jest wyjściem: gradienty CSS wycina Outlook, więc pasek zniknąłby
 * tam w całości. Rolę akcentu wziął więc włos na górnej krawędzi, a barwę marki niesie
 * dalej nadtytuł w środku panelu - i tak jest pomarańczowy.
 *
 * ------------------------------------------------------------------ co widzi Outlook
 *
 * Outlook renderuje maile silnikiem Worda: nie zna gradientów ani zaokrągleń. Zostaje mu
 * `bgcolor`, czyli prostokątny panel o ton jaśniejszy od tła listu - bez świateł, ale
 * nadal wyraźnie wyróżniony. To jest podłoga tego projektu, nie jego wygląd docelowy.
 * Dlatego kolor bazowy jest osobno w `bgcolor`, a nie tylko w gradiencie.
 */
export function kafelek(zawartosc: string) {
  /* Blask z narożnika i spadek jasności szyby. Kolejność ma znaczenie: pierwsza warstwa
     leży na wierzchu, więc ciepły blask jest NAD chłodnym rozjaśnieniem. */
  const szklo =
    "radial-gradient(115% 85% at 0% 0%," +
    "rgba(255,138,42,0.20) 0%," +
    "rgba(255,138,42,0.132) 18%," +
    "rgba(255,138,42,0.075) 38%," +
    "rgba(255,138,42,0.032) 58%," +
    "rgba(255,138,42,0.008) 80%," +
    "rgba(255,138,42,0) 100%)," +
    "linear-gradient(180deg," +
    "rgba(255,255,255,0.085) 0%," +
    "rgba(255,255,255,0.055) 22%," +
    "rgba(255,255,255,0.03) 46%," +
    "rgba(255,255,255,0.012) 72%," +
    "rgba(255,255,255,0) 100%)";

  /* Odblask na krawędzi - gaśnie na obu końcach, więc nie jest kreską. */
  const krawedz =
    "linear-gradient(90deg," +
    "rgba(255,178,92,0) 0%," +
    "rgba(255,178,92,0.28) 14%," +
    "rgba(255,196,130,0.62) 50%," +
    "rgba(255,178,92,0.28) 86%," +
    "rgba(255,178,92,0) 100%)";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:10px 0 26px;">
    <tr>
      <td bgcolor="#100e14" style="background-color:#100e14;background-image:${szklo};
        border-radius:18px;padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td height="1" style="height:1px;line-height:1px;font-size:0;
            background-image:${krawedz};">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:20px 24px 22px;">${zawartosc}</td>
        </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function przycisk(napis: string, adres: string) {
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

/**
 * Cała koperta listu: głowa dokumentu, tło z konturem boiska, treść i stopka z logiem.
 *
 * `stopka` to zdanie wyjaśniające, skąd ten mail - inne dla powitania (bo powstało konto)
 * i dla wiadomości o otwarciu (bo ktoś sam się zapisał).
 */
export function szkielet({
  podglad,
  tresc,
  stopka,
}: {
  podglad: string;
  tresc: string;
  stopka: string;
}) {
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
    Klienci poczty same zamieniają adresy, daty i numery w linki i malują je na niebiesko.
    Poniższe reguły oddają im kolor z powrotem.
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

<!--
  Czerń jest tu podana czterokrotnie: na body, na tym opakowaniu, na tabeli i na komórce.
  Wygląda na przesadę, ale klient poczty na telefonie potrafi wyciąć <body> razem z jego
  stylem i podstawić własne, jasne tło - wtedy list z ciemną treścią siedzi na białym.
  Każda kolejna warstwa jest zabezpieczeniem na wypadek, gdyby poprzednią wycięto.
-->
<div style="background-color:${CZERN};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="${CZERN}" style="background-color:${CZERN};">
<tr><td align="center" bgcolor="${CZERN}" style="padding:0;background-color:${CZERN};">

  <!--
    Szerokość podana i atrybutem, i stylem. Sam atrybut 600 rozpychał list na wąskim
    ekranie: wiadomość robiła się szersza od okna, a wokół niej wychodziło tło klienta.
    Szerokość 100% z ograniczeniem do 600 px pozwala tabeli zmaleć na telefonie.
  -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;max-width:600px;">
  <tr>
    <!--
      Kontur boiska: obrazek tła na komórce (atrybut background dla starych klientów,
      background-image dla nowych) plus VML dla Outlooka. Gdy klient wytnie wszystkie
      trzy, zostaje czysta czerń z bgcolor - list nadal się czyta.
    -->
    <td background="${TLO}" bgcolor="${CZERN}" valign="top"
      style="background-color:${CZERN};background-image:url('${TLO}');
      background-repeat:no-repeat;background-position:top center;background-size:600px auto;
      padding:0;">
      ${vmlTlo}
      <!--
        WYŚCIÓŁKA ZESZŁA Z TEJ KOMÓRKI DO ŚRODKA, a pod treść wszedł pas zejścia w czerń.

        Tło jest jedno dla wszystkich listów, a wysokość treści jest za każdym razem inna:
        potwierdzenie zapisu ma trzy akapity, powitanie beta testera - osiem punktów.
        Kontur boiska gaśnie u własnego dołu, ale przy krótkim liście komórka kończyła się
        znacznie wyżej i przycinała go w miejscu, gdzie linie mają pełną jasność. To
        właśnie ta kreska nad logiem.

        Wygaszenie musi więc jechać z TREŚCIĄ, a nie być wypalone w tle. Pas leży na dole
        komórki i przykrywa tło dokładnie tam, gdzie się ono urywało; niżej jest już
        jednolita czerń stopki.

        Dlatego wyściółka nie może zostać na tej komórce: pas jest obrazkiem, a przy
        wyściółce 28 px zostawiałby po bokach i pod sobą paski nieprzykrytego tła, czyli
        tę samą kreskę, tylko krótszą. Wewnętrzna tabela daje wyściółkę samej treści,
        a pas dostaje pełne 600 px.
      -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 28px 0;">
          <div style="position:relative;">
            ${tresc}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0;font-size:0;line-height:0;">
          <img src="${ZEJSCIE}" width="600" height="160" alt=""
            style="display:block;border:0;outline:none;width:100%;height:auto;">
        </td>
      </tr>
      </table>
    </td>
  </tr>

  <!--
    Stopka: logo na środku pod treścią. Bez kreski oddzielającej - „border-top" był drugą
    twardą krawędzią w tym liście, a pas zejścia robi to samo lepiej: oddziela stopkę
    zmianą jasności, a nie linią.
  -->
  <tr>
    <td align="center" bgcolor="${CZERN}" style="background-color:${CZERN};
      padding:8px 28px 40px;">
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
        ${stopka}
      </div>
    </td>
  </tr>
  </table>

</td></tr>
</table>
</div>
</body>
</html>`;
}
