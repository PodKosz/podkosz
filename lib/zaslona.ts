/**
 * Zasłona przed premierą.
 *
 * Dopóki `ZASLONA` jest włączona, każdy adres serwisu pokazuje stronę „Już niedługo",
 * a wyszukiwarki mają zakaz indeksowania (robots.txt, `noindex` w metadanych i nagłówek
 * `X-Robots-Tag`). Do środka wchodzą tylko:
 *  - osoby zalogowane (sesja Supabase w ciasteczkach),
 *  - ktokolwiek z kluczem w adresie: `podkosz.pl/?wpusc=<klucz>` - klucz zapisuje się
 *    w ciasteczku na rok, więc wystarczy raz na urządzenie.
 *
 * Otwarcie serwisu to zmiana `ZASLONA` na `false` (albo ustawienie na Vercelu zmiennej
 * PODKOSZ_OTWARTA=1, wtedy nie trzeba wgrywać nowej wersji kodu).
 */
export const ZASLONA = process.env.PODKOSZ_OTWARTA !== "1";

/**
 * Klucz wpuszczający bez konta - wyłącznie ze zmiennej środowiskowej.
 *
 * Wcześniej stała tu wartość domyślna wpisana w kod. Repozytorium jest publiczne, więc
 * ten „sekret" mógł przeczytać każdy i wejść za zasłonę linkiem. Bez ustawionej zmiennej
 * furtka po prostu nie istnieje - to bezpieczna strona pomyłki, bo administrator i tak
 * wchodzi przez zalogowanie się na swoje konto.
 */
export const KLUCZ_WEJSCIA = process.env.PODKOSZ_KLUCZ?.trim() || null;

/** Ciasteczko z przepustką - trzyma się rok, żeby nie wklejać klucza za każdym razem. */
export const CIASTKO_WEJSCIA = "podkosz-przepustka";

/** Adres strony zasłony. */
export const SCIEZKA_ZASLONY = "/wkrotce";

/**
 * Jak długo pamiętamy wynik sprawdzenia adresu IP (w milisekundach).
 *
 * Blokady IP sprawdza proxy przy każdym żądaniu, więc bez pamięci byłoby to zapytanie
 * do bazy za każdym razem. Adres niezablokowany trzymamy dłużej (to przypadek typowy),
 * zablokowany krócej, żeby zdjęcie blokady działało od razu.
 */
export const PAMIEC_IP_WOLNY = 5 * 60 * 1000;
export const PAMIEC_IP_ZBANOWANY = 60 * 1000;
