/*
  ============================================================================
  Statystyki wielu graczy jednym zapytaniem
  ============================================================================

  PO CO. Ranking graczy pokazuje przy każdym jego piłkę odznaczeń, a ta rysuje się
  ze statystyk. Przy dwudziestu pięciu osobach znaczyło to dwadzieścia pięć osobnych
  wywołań `statystyki_gracza` - dwadzieścia pięć podróży przez sieć na jedno zbudowanie
  strony. Tutaj jest jedna.

  DLACZEGO PRZEZ `lateral`, A NIE PRZEPISANE ZAPYTANIE. Cała robota - szesnaście
  podzapytań, seria dni pod rząd, pionier liczony po dacie założenia konta - siedzi
  w `statystyki_gracza` i ma tam zostać. Przepisanie jej na wariant zbiorczy dałoby DRUGĄ
  kopię tych samych reguł, a wtedy każde przyszłe odznaczenie trzeba by dodawać w dwóch
  miejscach i pierwsze zapomnienie rozjechałoby ranking z profilem po cichu.

  `cross join lateral` woła istniejącą funkcję raz na nazwę z tablicy. Baza wykonuje
  dokładnie tyle samo pracy co przedtem - i o to chodzi, bo wąskim gardłem nigdy nie było
  liczenie, tylko liczba podróży.

  BEZPIECZEŃSTWO. `security definer` dziedziczy się z wołanej funkcji, ale powtarzamy je
  jawnie razem z `search_path`, bo funkcja bez ustawionej ścieżki wyszukiwania jest
  klasyczną dziurą: wystarczy schemat użytkownika z własnym `courts`, żeby podstawić
  swoje dane. Uprawnienia te same co przy pojedynczej: odczyt dla `anon`, bo ranking
  jest publiczny i budowany bez zalogowanego użytkownika.

  IDEMPOTENTNA. Można puścić drugi raz bez szkody.
*/

drop function if exists statystyki_graczy(text[]);

create or replace function statystyki_graczy(p_nicki text[])
returns table (
  user_id            uuid,
  nick               text,
  avatar             text,
  dolaczyl           timestamptz,
  boiska             integer,
  podpalenia_zebrane integer,
  podpalenia_dane    integer,
  ulubione           integer,
  godziny            integer,
  dni                integer,
  miasta             integer,
  wojewodztwa        integer,
  zdjecia            integer,
  nocne              boolean,
  ranne              boolean,
  pionier            boolean,
  weekend            boolean,
  maraton            boolean,
  seria              integer,
  zima               boolean,
  oswietlone         boolean,
  approved           boolean,
  smieszne           boolean,
  komplet            boolean,
  poprawki           integer,
  nawierzchnie       integer,
  typy               integer,
  pierwszy_w_miescie boolean
)
language sql stable security definer set search_path = public as $$
  /*
    Alias kolumny wejściowej to `zapytany`, a nie `nick`: wyjście tej funkcji ma własną
    kolumnę `nick` i przy tej samej nazwie odwołanie byłoby dwuznaczne.

    `distinct` na wejściu, bo ta sama nazwa podana dwa razy kazałaby bazie policzyć
    wszystko dwa razy. Wołający i tak dobiera wynik po nazwie, nie po pozycji.
  */
  select s.*
    from (select distinct btrim(n) as zapytany
            from unnest(p_nicki) as n
           where coalesce(btrim(n), '') <> '') w
    cross join lateral statystyki_gracza(w.zapytany) s;
$$;

grant execute on function statystyki_graczy(text[]) to anon, authenticated;

/* ---------- kontrola ---------- */
/*
  Powinno oddać po jednym wierszu na nazwę, z tymi samymi liczbami co pojedyncze wywołania.
*/
select nick, boiska, podpalenia_zebrane, seria
  from statystyki_graczy(array['Basket']);
