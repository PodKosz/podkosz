/**
 * Zasłona przed premierą.
 *
 * Dopóki `ZASLONA` jest włączona, każdy adres serwisu pokazuje stronę „Już niedługo",
 * a wyszukiwarki mają zakaz indeksowania (robots.txt, `noindex` w metadanych i nagłówek
 * `X-Robots-Tag`). Do środka wchodzi DOKŁADNIE jedna grupa: osoby zalogowane, których
 * adres siedzi w tabeli `beta_testers`, plus administrator. Decyduje o tym funkcja
 * `czy_wpuscic()` w bazie - po stronie serwera, przy każdym wejściu.
 *
 * Nie ma drugiej drogi i to jest celowe. Wcześniej były dwie:
 *
 *  - klucz w adresie (`?wpusc=<klucz>`), który zapisywał roczną przepustkę w ciasteczku.
 *    Sekret podany raz rozchodzi się dalej, nie da się odebrać go jednej osobie, a kto
 *    dostał link, wchodził bez konta i bez śladu, kim jest;
 *  - samo ciasteczko `podkosz-przepustka=1`. Jego nazwa leży w publicznym repozytorium,
 *    a wartością było `1`, więc każdy mógł je sobie dopisać w narzędziach przeglądarki
 *    i wejść. Sprawdzone na produkcji: wchodziło.
 *
 * Obie zniknęły. Jedynym dowodem wstępu jest sesja Supabase, czyli coś, czego nie da się
 * dopisać ręcznie, a lista uprawnionych jest w bazie i można z niej kogoś usunąć.
 *
 * Otwarcie serwisu to ustawienie na Vercelu zmiennej PODKOSZ_OTWARTA=1 - wtedy nie trzeba
 * wgrywać nowej wersji kodu.
 */
export const ZASLONA = process.env.PODKOSZ_OTWARTA !== "1";

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

/**
 * Jak długo pamiętamy, czy dane konto wpuszczamy za zasłonę (w milisekundach).
 *
 * To zastępuje dawną przepustkę w ciasteczku i jest od niej lepsze z jednego powodu:
 * pamięć siedzi po stronie serwera, więc nikt jej sobie nie dopisze. Wpuszczonego
 * trzymamy dłużej, bo to przypadek typowy; odmowę krócej, żeby dopisanie kogoś do
 * beta testerów działało od razu, a nie po godzinie.
 *
 * Pamięć procesu na serwerze bezstanowym jest z natury dziurawa - nowa instancja startuje
 * pusta. I to jest w porządku: brak wpisu oznacza zapytanie do bazy, czyli poprawną
 * odpowiedź. Nigdy nie oznacza wpuszczenia na słowo.
 */
export const PAMIEC_WEJSCIA_TAK = 10 * 60 * 1000;
export const PAMIEC_WEJSCIA_NIE = 30 * 1000;
