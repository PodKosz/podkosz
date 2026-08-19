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

/** Klucz wpuszczający bez konta. Można nadpisać zmienną środowiskową. */
export const KLUCZ_WEJSCIA = process.env.PODKOSZ_KLUCZ ?? "wpusc-mnie-na-kosz";

/** Ciasteczko z przepustką - trzyma się rok, żeby nie wklejać klucza za każdym razem. */
export const CIASTKO_WEJSCIA = "podkosz-przepustka";

/** Adres strony zasłony. */
export const SCIEZKA_ZASLONY = "/wkrotce";
