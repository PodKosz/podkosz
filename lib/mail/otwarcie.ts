import { SITE_URL } from "@/lib/site";
import {
  CZCIONKA,
  KREDA,
  PRZYGASZONY,
  ZAR,
  akapit,
  kafelek,
  naglowek,
  nadtytul,
  przycisk,
  szkielet,
} from "./szkielet";

/**
 * Wiadomość do osób, które zapisały się na otwarcie serwisu.
 *
 * Ten list ma jedno zadanie: powiedzieć, że strona działa, i zaprosić do zalogowania.
 * Świadomie NIE tłumaczy tu całego serwisu - to robi mail powitalny, który przychodzi
 * dopiero po pierwszym zalogowaniu. Gdyby oba listy mówiły to samo, drugi byłby powtórką
 * i nikt by go nie przeczytał.
 *
 * Koperta (czerń, kontur boiska, logo) jest wspólna z resztą listów - patrz `szkielet.ts`.
 */

const KROKI: [string, string][] = [
  ["Wejdź na podkosz.pl", "mapa działa od razu, bez logowania"],
  ["Zaloguj się kontem Google", "wtedy dostaniesz krótki list z całą resztą"],
  ["Dodaj boisko, które znasz", "od tego zaczyna się cała mapa"],
];

export function tematOtwarcia() {
  return "PodKosz jest otwarty - wchodź";
}

export function htmlOtwarcia() {
  const kroki = KROKI.map(
    ([tytul, opis], i) => `<tr>
      <td width="42" valign="top" style="padding:0 0 18px;font-family:${CZCIONKA};
        font-size:15px;font-weight:700;color:#ff7a18;line-height:1.5;">
        ${String(i + 1).padStart(2, "0")}
      </td>
      <td valign="top" style="padding:0 0 18px;">
        <div style="font-family:${CZCIONKA};font-size:15px;font-weight:600;line-height:1.45;
          color:${KREDA};padding-bottom:4px;">${tytul}</div>
        <div style="font-family:${CZCIONKA};font-size:14px;line-height:1.6;
          color:${PRZYGASZONY};">${opis}</div>
      </td>
    </tr>`
  ).join("");

  const tresc = `
    ${nadtytul("PodKosz")}
    ${naglowek("Otwieramy.", "Wchodź.")}

    ${akapit(
      "Zapisałeś się na otwarcie - i właśnie się otworzyło. PodKosz, czyli mapa boisk " +
        "do koszykówki w Polsce, jest od dziś dostępny dla wszystkich. Możesz wejść, " +
        "przeglądać mapę i zakładać konto."
    )}

    ${kafelek(
      `<div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;
        letter-spacing:2px;text-transform:uppercase;color:${ZAR};padding-bottom:8px;">
        Dlaczego warto się zalogować</div>
      <div style="font-family:${CZCIONKA};font-size:14px;line-height:1.6;color:${PRZYGASZONY};">
        Mapę obejrzysz bez konta. Konto daje resztę: dodawanie boisk, podpalenia, ulubione,
        zapisy na grę, odznaczenia i miejsce w rankingu graczy. Po pierwszym zalogowaniu
        dostaniesz ode mnie krótki list z tym, co warto wiedzieć na start.
      </div>`
    )}

    <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
      text-transform:uppercase;color:${ZAR};padding:18px 0 16px;">
      Trzy kroki</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${kroki}
    </table>

    ${przycisk("Wejdź na mapę", SITE_URL)}
  `;

  return szkielet({
    podglad: "Strona działa. Możesz wejść i założyć konto.",
    tresc,
    stopka:
      "Dostajesz tę wiadomość, bo zapisałeś się na otwarcie PodKosza. " +
      "To jedyny list z tej listy - nie ma tu żadnego newslettera.",
  });
}

export function tekstOtwarcia() {
  const wiersze = [
    "PODKOSZ JEST OTWARTY",
    "",
    "Zapisałeś się na otwarcie - i właśnie się otworzyło. PodKosz, czyli mapa boisk " +
      "do koszykówki w Polsce, jest od dziś dostępny dla wszystkich.",
    "",
    "Mapę obejrzysz bez konta. Konto daje resztę: dodawanie boisk, podpalenia, ulubione, " +
      "zapisy na grę, odznaczenia i miejsce w rankingu graczy. Po pierwszym zalogowaniu " +
      "dostaniesz krótki list z tym, co warto wiedzieć na start.",
    "",
    "TRZY KROKI",
  ];

  KROKI.forEach(([tytul, opis], i) => {
    wiersze.push(`${String(i + 1).padStart(2, "0")}. ${tytul} - ${opis}`);
  });

  wiersze.push("");
  wiersze.push(`Wejdź na mapę: ${SITE_URL}`);
  wiersze.push("");
  wiersze.push("---");
  wiersze.push("PodKosz - mapa boisk do koszykówki w Polsce");
  wiersze.push("Dostajesz tę wiadomość, bo zapisałeś się na otwarcie PodKosza.");

  return wiersze.join("\n");
}
