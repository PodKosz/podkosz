import { PROFILE_SPOLECZNOSCIOWE } from "@/lib/site";
import { CZCIONKA, PRZYGASZONY, akapit, naglowek, nadtytul, szkielet } from "./szkielet";

/**
 * Krótkie potwierdzenie zapisu na otwarcie.
 *
 * Jedyne zadanie: powiedzieć „mam Twój adres" i uciec. Bez listy funkcji, bez przycisku
 * do niedziałającej jeszcze strony - klikać nie ma w co, bo serwis jest zamknięty.
 * Wszystko, co ciekawe, przyjdzie w dniu premiery, a reszta po pierwszym zalogowaniu.
 *
 * Ten list wychodzi dokładnie raz na adres: decyduje o tym klucz główny tabeli zapisów.
 * Powtórny zapis tego samego adresu nie wysyła niczego, więc endpointem nie da się
 * zasypać cudzej skrzynki.
 */
export function tematPotwierdzenia() {
  return "Jesteś na liście - PodKosz";
}

export function htmlPotwierdzenia() {
  const instagram = PROFILE_SPOLECZNOSCIOWE[0];

  const tresc = `
    ${nadtytul("PodKosz")}
    ${naglowek("Dzięki.", "Jesteś na liście.")}

    ${akapit(
      "Zapisałeś się na otwarcie PodKosza - mapy boisk do koszykówki w Polsce. " +
        "Odezwę się dokładnie raz: w dniu, w którym strona ruszy. Wtedy będzie można " +
        "wejść, przeglądać mapę i zakładać konto."
    )}

    ${akapit(
      "Do tego czasu nie musisz nic robić. Nie ma tu newslettera ani niczego, " +
        "z czego trzeba się wypisywać.",
      PRZYGASZONY
    )}

    ${
      instagram
        ? `<p style="margin:22px 0 0;font-family:${CZCIONKA};font-size:14px;line-height:1.6;
             color:${PRZYGASZONY};">
             Po drodze pokazuję postępy tutaj:
             <a href="${instagram}" style="color:#ff7a18;text-decoration:none;">Instagram</a>.
           </p>`
        : ""
    }
  `;

  return szkielet({
    podglad: "Mam Twój adres. Odezwę się w dniu otwarcia.",
    tresc,
    stopka:
      "Dostajesz tę wiadomość, bo zapisałeś się na otwarcie PodKosza. " +
      "Następny list przyjdzie dopiero w dniu premiery.",
  });
}

export function tekstPotwierdzenia() {
  const instagram = PROFILE_SPOLECZNOSCIOWE[0];

  const wiersze = [
    "JESTEŚ NA LIŚCIE",
    "",
    "Zapisałeś się na otwarcie PodKosza - mapy boisk do koszykówki w Polsce. " +
      "Odezwę się dokładnie raz: w dniu, w którym strona ruszy.",
    "",
    "Do tego czasu nie musisz nic robić. Nie ma tu newslettera ani niczego, " +
      "z czego trzeba się wypisywać.",
  ];

  if (instagram) {
    wiersze.push("", `Postępy pokazuję tutaj: ${instagram}`);
  }

  wiersze.push("", "---", "PodKosz - mapa boisk do koszykówki w Polsce");
  wiersze.push("Dostajesz tę wiadomość, bo zapisałeś się na otwarcie PodKosza.");

  return wiersze.join("\n");
}
