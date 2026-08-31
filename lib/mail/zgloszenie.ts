import { SITE_URL } from "@/lib/site";
import {
  CZCIONKA,
  KREDA,
  PLOMIEN,
  PRZYGASZONY,
  SLABY,
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
 * List o decyzji w sprawie zgłoszonego boiska - opublikowane albo odrzucone.
 *
 * Ten mail już wcześniej wychodził, ale jako goły tekst: bez oprawy, bez przycisku, bez
 * odnośnika do konkretnej karty boiska. Był jedyną wiadomością z serwisu, która nie
 * wyglądała jak z serwisu - a przy tym jedyną, którą dostaje się w nagrodę za robotę.
 *
 * Adres bierzemy z `submissions.author_email`, a ten wypełnia się w dwóch przypadkach:
 * kiedy ktoś dodaje boisko z konta (wtedy jest to adres konta) i kiedy gość wpisze go
 * ręcznie w kreatorze. Bez adresu nie ma komu pisać i wysyłka po prostu nie startuje.
 *
 * Koperta - czerń, kontur boiska, logo w stopce - siedzi w `szkielet.ts`, wspólna
 * z powitaniem i wiadomością o otwarciu.
 */

export interface DaneDecyzji {
  /** nazwa boiska z zgłoszenia - w mailu wyłącznie do odczytu, więc idzie przez `esc` */
  nazwa: string;
  /** miasto, jeśli znane - „Boisko Kobe Bryant, Warszawa" czyta się konkretniej */
  miasto?: string | null;
  /** adres opublikowanej karty; bez niego przycisk prowadzi na mapę */
  slug?: string | null;
}

export interface DaneOdmowy extends DaneDecyzji {
  /** powód wpisany przez moderatora - to jedyna rzecz, po której da się poprawić zgłoszenie */
  powod?: string | null;
}

/* ---------------------------------------------------------------- publikacja */

export function tematPublikacji(dane: DaneDecyzji) {
  return `${dane.nazwa} jest już na mapie PodKosza`;
}

/** Wiersz „nazwa boiska + miasto" w kafelku. */
function kafelekBoiska(dane: DaneDecyzji) {
  const miasto = dane.miasto?.trim();
  return kafelek(`
    <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
      text-transform:uppercase;color:${SLABY};padding-bottom:8px;">Na mapie od dziś</div>
    <div style="font-family:${CZCIONKA};font-size:19px;line-height:1.3;font-weight:600;
      color:${KREDA};">${esc(dane.nazwa)}</div>
    ${
      miasto
        ? `<div style="font-family:${CZCIONKA};font-size:14px;line-height:1.5;
             color:${PRZYGASZONY};padding-top:6px;">${esc(miasto)}</div>`
        : ""
    }
  `);
}

/** Co dalej z boiskiem - trzy rzeczy, wszystkie na karcie, którą właśnie dostał. */
const PO_PUBLIKACJI: [string, string][] = [
  [
    "Podpal je",
    "Płonąca piłka to nasze polubienie - jedno na boisko. Z podpaleń powstaje ranking boisk, " +
      "więc to one decydują, jak wysoko stoi Twoje.",
  ],
  [
    "Zapowiedz, że idziesz grać",
    "Na karcie zaznaczasz zakres godzin, w których będziesz. Inni widzą, ile osób się dziś " +
      "wybiera - deklaracja żyje jeden dzień, więc nigdy nie jest nieaktualna.",
  ],
  [
    "Uzupełnij, czego brakuje",
    "Zauważysz literówkę, zmienioną nawierzchnię albo lepsze zdjęcie? Odpisz na tę wiadomość, " +
      "poprawię wpis.",
  ],
];

export function htmlPublikacji(dane: DaneDecyzji) {
  const link = dane.slug ? `${SITE_URL}/boisko/${dane.slug}` : SITE_URL;

  const lista = PO_PUBLIKACJI.map(
    ([tytul, tresc]) => `
      <tr>
        <td valign="top" width="18" style="padding:0 0 14px;font-family:${CZCIONKA};
          font-size:15px;line-height:1.6;color:${PLOMIEN};">&bull;</td>
        <td valign="top" style="padding:0 0 14px;font-family:${CZCIONKA};font-size:15px;
          line-height:1.6;color:${PRZYGASZONY};">
          <span style="color:${KREDA};font-weight:600;">${tytul}.</span> ${tresc}
        </td>
      </tr>`
  ).join("");

  const tresc = `
    ${nadtytul("Zgłoszenie przyjęte")}
    ${naglowek("Boisko jest", "na mapie.")}

    ${akapit(
      "Sprawdziłem Twoje zgłoszenie i od teraz widzą je wszyscy. Każde boisko przechodzi " +
        "przez moje ręce, więc to nie automat - ktoś naprawdę je obejrzał, zanim tu trafiło."
    )}

    ${kafelekBoiska(dane)}

    ${przycisk("Zobacz kartę boiska", link)}

    <p style="margin:26px 0 12px;font-family:${CZCIONKA};font-size:11px;font-weight:700;
      letter-spacing:2px;text-transform:uppercase;color:${ZAR};">Co możesz zrobić dalej</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${lista}
    </table>

    ${akapit(
      `Znasz kolejne boisko, którego tu nie ma? Kreator zajmuje kilka minut: ` +
        `<a href="${SITE_URL}/dodaj" style="color:${PLOMIEN};text-decoration:none;">dodaj boisko</a>. ` +
        `Liczba dodanych boisk buduje Twoje miejsce w ` +
        `<a href="${SITE_URL}/gracze" style="color:${PLOMIEN};text-decoration:none;">rankingu graczy</a>.`,
      PRZYGASZONY
    )}
  `;

  return szkielet({
    podglad: `${dane.nazwa} przeszło sprawdzenie i jest już widoczne na mapie.`,
    tresc,
    stopka:
      "Dostajesz tę wiadomość, bo zgłosiłeś to boisko do PodKosza. " +
      "Piszemy tylko o decyzji w sprawie zgłoszenia - to nie newsletter.",
  });
}

export function tekstPublikacji(dane: DaneDecyzji) {
  const link = dane.slug ? `${SITE_URL}/boisko/${dane.slug}` : SITE_URL;
  const miasto = dane.miasto?.trim();

  return [
    "BOISKO JEST NA MAPIE",
    "",
    "Sprawdziłem Twoje zgłoszenie i od teraz widzą je wszyscy. Każde boisko " +
      "przechodzi przez moje ręce, więc to nie automat.",
    "",
    miasto ? `${dane.nazwa}, ${miasto}` : dane.nazwa,
    link,
    "",
    "CO MOŻESZ ZROBIĆ DALEJ",
    ...PO_PUBLIKACJI.flatMap(([tytul, tresc]) => ["", `- ${tytul}. ${tresc}`]),
    "",
    `Znasz kolejne boisko, którego tu nie ma? ${SITE_URL}/dodaj`,
    `Liczba dodanych boisk buduje Twoje miejsce w rankingu graczy: ${SITE_URL}/gracze`,
    "",
    "---",
    "PodKosz - mapa boisk do koszykówki w Polsce",
    "Dostajesz tę wiadomość, bo zgłosiłeś to boisko do PodKosza.",
  ].join("\n");
}

/* ---------------------------------------------------------------- odmowa */

export function tematOdmowy() {
  return "Zgłoszenie boiska nie trafiło na mapę";
}

export function htmlOdmowy(dane: DaneOdmowy) {
  const powod = dane.powod?.trim();

  const tresc = `
    ${nadtytul("Decyzja o zgłoszeniu")}
    ${naglowek("Tym razem", "bez publikacji.")}

    ${akapit(
      `Dzięki za zgłoszenie <span style="color:${KREDA};">${esc(dane.nazwa)}</span>, ` +
        "ale tym razem nie trafiło ono na mapę."
    )}

    ${kafelek(`
      <div style="font-family:${CZCIONKA};font-size:11px;font-weight:700;letter-spacing:2px;
        text-transform:uppercase;color:${SLABY};padding-bottom:8px;">Powód</div>
      <div style="font-family:${CZCIONKA};font-size:15px;line-height:1.6;color:${KREDA};">
        ${powod ? esc(powod) : "Brak szczegółów."}
      </div>
    `)}

    ${akapit(
      "To nie jest zamknięta sprawa. Poprawione zgłoszenie przejdzie przez kolejkę " +
        "od nowa - najczęściej wystarczają wyraźniejsze zdjęcia albo dokładniejsza pinezka."
    )}

    ${przycisk("Zgłoś jeszcze raz", `${SITE_URL}/dodaj`)}

    ${akapit(
      "Uważasz, że to pomyłka? Odpisz na tę wiadomość - czytam każdą odpowiedź.",
      PRZYGASZONY
    )}
  `;

  return szkielet({
    podglad: powod ? `Powód: ${powod}` : "Zgłoszenie nie trafiło na mapę.",
    tresc,
    stopka:
      "Dostajesz tę wiadomość, bo zgłosiłeś boisko do PodKosza. " +
      "Piszemy tylko o decyzji w sprawie zgłoszenia - to nie newsletter.",
  });
}

export function tekstOdmowy(dane: DaneOdmowy) {
  const powod = dane.powod?.trim();

  return [
    "ZGŁOSZENIE NIE TRAFIŁO NA MAPĘ",
    "",
    `Dzięki za zgłoszenie ${dane.nazwa}, ale tym razem nie trafiło ono na mapę.`,
    "",
    `Powód: ${powod || "brak szczegółów"}`,
    "",
    "To nie jest zamknięta sprawa. Poprawione zgłoszenie przejdzie przez kolejkę od nowa - " +
      "najczęściej wystarczają wyraźniejsze zdjęcia albo dokładniejsza pinezka.",
    "",
    `Zgłoś jeszcze raz: ${SITE_URL}/dodaj`,
    "",
    "Uważasz, że to pomyłka? Odpisz na tę wiadomość - czytam każdą odpowiedź.",
    "",
    "---",
    "PodKosz - mapa boisk do koszykówki w Polsce",
    "Dostajesz tę wiadomość, bo zgłosiłeś boisko do PodKosza.",
  ].join("\n");
}
