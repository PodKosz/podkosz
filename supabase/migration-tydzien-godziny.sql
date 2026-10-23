-- =====================================================================
--  Godziny dla całego tygodnia w panelu deklaracji (23.10.2026).
--
--  Box „Kto dziś gra" na karcie boiska to od 23.10.2026 pas kart - po jednej na każdy
--  z siedmiu dni - i na każdej są słupki godzin. Dotąd `checkin_panel` oddawał godziny
--  tylko dla jednego, wybranego dnia, więc przeglądarka musiałaby pytać o każdy dzień
--  osobno. Tu `tydzien` dostaje do każdego dnia listę `godziny` ({hour, people}).
--
--  Reszta funkcji BEZ ZMIAN (to ta sama definicja co w migration-deklaracje-tydzien.sql).
--  Na zewnątrz dalej wychodzą tylko liczby - kto się zapisał, nie wie nikt poza nim samym.
--  Strona działa i bez tej migracji (dociąga wtedy godziny dni osobnymi zapytaniami).
--
--  URUCHOM PO `migration-deklaracje-tydzien.sql`.
-- =====================================================================

create or replace function public.checkin_panel(in_court uuid, in_day date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'dzis', current_date,
    'dzien', in_day,
    'godziny', coalesce(
      (
        select json_agg(json_build_object('hour', g.hour, 'people', g.people) order by g.hour)
          from (
            select c.hour, count(*)::integer as people
              from checkins c
             where c.court_id = in_court
               and c.day = in_day
             group by c.hour
          ) g
      ),
      '[]'::json
    ),
    'osoby', (
      select count(distinct c.user_id)::integer
        from checkins c
       where c.court_id = in_court
         and c.day = in_day
    ),
    'moje', coalesce(
      (
        select json_agg(c.hour order by c.hour)
          from checkins c
         where c.court_id = in_court
           and c.day = in_day
           and c.user_id = auth.uid()
      ),
      '[]'::json
    ),
    'zajete', coalesce(
      (
        select json_agg(distinct c.hour order by c.hour)
          from checkins c
         where c.day = in_day
           and c.user_id = auth.uid()
           and c.court_id <> in_court
      ),
      '[]'::json
    ),
    'blokada', checkin_blokada(in_court, in_day),
    'tydzien', (
      select json_agg(
               json_build_object(
                 'day', d.day,
                 'osoby', coalesce(x.osoby, 0),
                 'godziny', coalesce(g.godziny, '[]'::json)
               )
               order by d.day
             )
        from (select (current_date + i)::date as day from generate_series(0, 6) i) d
        left join (
          select c.day, count(distinct c.user_id)::integer as osoby
            from checkins c
           where c.court_id = in_court
             and c.day between current_date and current_date + 6
           group by c.day
        ) x on x.day = d.day
        left join (
          select h.day, json_agg(json_build_object('hour', h.hour, 'people', h.people) order by h.hour) as godziny
            from (
              select c.day, c.hour, count(*)::integer as people
                from checkins c
               where c.court_id = in_court
                 and c.day between current_date and current_date + 6
               group by c.day, c.hour
            ) h
           group by h.day
        ) g on g.day = d.day
    ),
    'moje_dni', coalesce(
      (
        select json_agg(json_build_object('day', m.day, 'godziny', m.godziny) order by m.day)
          from (
            select c.day, json_agg(c.hour order by c.hour) as godziny
              from checkins c
             where c.court_id = in_court
               and c.user_id = auth.uid()
               and c.day between current_date and current_date + 6
             group by c.day
          ) m
      ),
      '[]'::json
    )
  );
$$;

grant execute on function public.checkin_panel(uuid, date) to anon, authenticated;

select 'gotowe: godziny dla całego tygodnia w checkin_panel' as wynik;
