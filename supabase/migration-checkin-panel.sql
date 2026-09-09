-- =====================================================================
--  Panel „kto dziś gra" jednym zapytaniem.
--  Uruchom raz, po `migration-limit-boisk-dziennie.sql`.
--
--  CO SIĘ ZMIENIA
--
--  Karta boiska jest budowana z góry i leci z pamięci podręcznej - ale panel deklaracji
--  dociągał się z przeglądarki CZTEREMA osobnymi wywołaniami:
--
--    checkins_for_court  - ile osób na którą godzinę
--    checkins_osoby      - ile różnych osób w sumie (sumy z wyżej NIE WOLNO dodać:
--                          kto zapisał się na cztery godziny, siedzi w czterech wierszach)
--    fetchMyHours        - moje godziny na dziś
--    checkin_blokada     - dlaczego nie wolno mi się tu dziś zapisać
--
--  Cztery pełne żądania HTTP przez PostgREST na jedno wejście na stronę boiska. Przy
--  kilkuset osobach czytających karty boisk to kilkaset zapytań na sekundę o coś, co
--  zmieściłoby się w jednym. Teraz jest jedno.
--
--  Stare funkcje ZOSTAJĄ i to nie z sentymentu: `checkins_for_court` i `checkins_osoby`
--  wołane są też z innych miejsc (profil gracza, historia), a `checkin_blokada` jest
--  sprawdzana raz jeszcze przy samym zapisie - tuż przed skasowaniem poprzedniej
--  deklaracji, żeby nikt nie został bez starej i bez nowej.
--
--  DLACZEGO JSON, A NIE `returns table`
--
--  Bo to nie jest tabela. To cztery różne rzeczy naraz: lista godzin, jedna liczba, moja
--  lista i tekst albo null. Wciśnięte w jeden zestaw kolumn dałyby wiersze, w których
--  trzy czwarte pól powtarza tę samą wartość - i kod po drugiej stronie musiałby to
--  rozplatać. JSON mówi wprost, co jest czym.
-- =====================================================================

create or replace function public.checkin_panel(in_court uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    /* godziny z liczbą osób - tylko te, na które ktoś się zapisał */
    'godziny', coalesce(
      (
        select json_agg(json_build_object('hour', g.hour, 'people', g.people) order by g.hour)
          from (
            select c.hour, count(*)::integer as people
              from checkins c
             where c.court_id = in_court
               and c.day = current_date
             group by c.hour
          ) g
      ),
      '[]'::json
    ),
    /* ile RÓŻNYCH osób - liczone osobno, bo suma godzin liczyłaby ludzi po kilka razy */
    'osoby', (
      select count(distinct c.user_id)::integer
        from checkins c
       where c.court_id = in_court
         and c.day = current_date
    ),
    /* moje godziny - pusta lista dla niezalogowanego, nie null */
    'moje', coalesce(
      (
        select json_agg(c.hour order by c.hour)
          from checkins c
         where c.court_id = in_court
           and c.day = current_date
           and c.user_id = auth.uid()
      ),
      '[]'::json
    ),
    /* powód blokady albo null; dla niezalogowanego zawsze null - patrz `checkin_blokada` */
    'blokada', checkin_blokada(in_court)
  );
$$;

grant execute on function public.checkin_panel(uuid) to anon, authenticated;

-- ============================================================ kontrola
select public.checkin_panel(id) as panel
  from public.courts
 order by likes_count desc
 limit 1;
