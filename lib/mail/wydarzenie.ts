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
 *   - w stopce jest droga do wyłączenia takich wiadomości jednym kliknięciem
 *     (`profiles.powiadomienia`, przełącznik na stronie konta),
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
}

function adresBoiska(slug: string) {
  return `${SITE_URL}/boisko/${slug}`;
}

function dlaczego(powod: DaneWydarzenia["powod"], boisko: string) {
  return powod === "to-boisko"
    ? `Dostajesz tę wiadomość, bo podpaliłeś „${boisko}" na PodKoszu.`
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
      `Na boisku <strong style="color:${KREDA};">${esc(d.boisko)}</strong> w ${esc(d.miasto)} ` +
        `odbędzie się wydarzenie. Termin: <strong style="color:${KREDA};">${esc(d.kiedy)}</strong>.`
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
      `${dlaczego(d.powod, d.boisko)} ` +
      `Nie chcesz wiadomości o wydarzeniach? Wyłącz je na stronie swojego konta: ${SITE_URL}/konto`,
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
    `Nie chcesz takich wiadomości? Wyłącz je na ${SITE_URL}/konto`,
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
