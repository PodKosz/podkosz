/**
 * Kto jest nadawcą listów - i co robić, gdy nikt nim nie jest.
 *
 * Wcześniej każda trasa pocztowa miała u siebie ten sam zapis:
 *
 *     const from = process.env.FEEDBACK_FROM ?? "PodKosz <onboarding@resend.dev>";
 *
 * Wygląda niewinnie, a jest najgorszym rodzajem awarii. `onboarding@resend.dev` to adres
 * testowy Resend, z którego wolno wysyłać WYŁĄCZNIE na własny adres właściciela konta.
 * List do kogokolwiek innego Resend przyjmuje i odrzuca po swojej stronie - my dostajemy
 * odpowiedź, że wszystko poszło. Efekt: przy niewpisanej zmiennej `FEEDBACK_FROM` maile
 * powitalne do ludzi po prostu nie docierają, a w serwisie nie ma po tym żadnego śladu.
 *
 * Dlatego rozdzielamy dwa przypadki. List do NAS (opinia z formularza) może pójść adresem
 * testowym - odbiorcą jest właściciel konta, więc dojdzie. List do UŻYTKOWNIKA bez
 * skonfigurowanej domeny nie idzie wcale i wraca z jasnym powodem, który widać w panelu.
 */

/** Adres testowy Resend - działa tylko w jedną stronę: do właściciela konta. */
const AWARYJNY = "PodKosz <onboarding@resend.dev>";

export interface Nadawca {
  from: string;
  /** true = jedziemy adresem testowym, więc listy do obcych i tak nie dojdą */
  awaryjny: boolean;
}

export function nadawca(): Nadawca {
  const wlasny = process.env.FEEDBACK_FROM?.trim();
  if (wlasny) return { from: wlasny, awaryjny: false };

  console.warn(
    "[poczta] Brak FEEDBACK_FROM - jadę adresem testowym Resend. " +
      "Listy do użytkowników NIE zostaną wysłane. Ustaw FEEDBACK_FROM na adres " +
      "z domeny potwierdzonej w Resend."
  );
  return { from: AWARYJNY, awaryjny: true };
}

/** Powód odmowy wysyłki do użytkownika - jeden tekst dla wszystkich tras. */
export const POWOD_BRAK_NADAWCY =
  "Poczta nieskonfigurowana: brak FEEDBACK_FROM (adres z domeny potwierdzonej w Resend).";
