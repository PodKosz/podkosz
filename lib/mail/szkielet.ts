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
export const TLO = `${SITE_URL}/mail/tlo.png?v=2`;
export const LOGO = `${SITE_URL}/mail/logo.png?v=2`;

/* Kolory z app/globals.css - trzymamy je tu osobno, bo mail nie widzi arkusza strony. */
export const CZERN = "#07070a";
export const KREDA = "#f5f5f7";
export const PRZYGASZONY = "#a7a6ad";
export const SLABY = "#77767d";
export const PLOMIEN = "#ff7a18";
export const ZAR = "#ffb25c";
export const KRESKA = "#241a13";
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

/** Kafelek z akcentem po lewej - w mailu to najprostszy sposób na „wyróżnioną ramkę". */
export function kafelek(zawartosc: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:6px 0 24px;">
    <tr>
      <td width="3" bgcolor="${PLOMIEN}" style="width:3px;background-color:${PLOMIEN};"></td>
      <td bgcolor="#0e0d10" style="padding:18px 20px;background-color:#0e0d10;
        border:1px solid ${KRESKA};border-left:0;">${zawartosc}</td>
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
        ${tresc}
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
        ${stopka}
      </div>
    </td>
  </tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}
