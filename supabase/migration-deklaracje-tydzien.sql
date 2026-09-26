-- =====================================================================
--  Deklaracje na tydzień naprzód
--
--  Do tej pory panel „Kto gra" znał tylko dzisiejszy dzień, więc na sobotni mecz dało się
--  zapisać dopiero w sobotę rano - a o sobocie umawia się w środę. Teraz wybiera się
--  dzień z najbliższych siedmiu (dziś i sześć kolejnych), a potem godziny.
--
--  Zasady zostają dokładnie te same, tylko liczone dla WYBRANEGO dnia, a nie dla dziś:
--  12 godzin na jednym boisku, najwyżej dwa boiska dziennie, oba w jednym województwie,
--  jedna godzina - jedno boisko. Wyzwalacz i indeks liczyły je zresztą zawsze po `day`
--  wiersza, a zasada RLS dopuszczała zapis do `current_date + 7` od samego początku -
--  zamknięta była tylko przeglądarka i odczyt, który pytał wyłącznie o dziś.
--
--  Historia gry i odznaczenia liczą `day <= current_date` (statystyki_gracza, profil
--  publiczny, wyróżnienia), więc deklaracja na przyszłość nie nabija niczego z góry -
--  wchodzi do historii dopiero w swoim dniu.
--
--  Stare funkcje jednoargumentowe (`checkin_panel(uuid)`, `checkin_blokada(uuid)`)
--  zostają: przeglądarka spada na nie, dopóki ta migracja nie jest uruchomiona, i wtedy
--  po prostu pokazuje sam dzisiejszy dzień.
--
--  URUCHOM PO `migration-jedna-godzina-jedno-boisko.sql`.
-- =====================================================================

/* ---------- 1. powód blokady dla wybranego dnia ---------- */
create or replace function public.checkin_blokada(in_court uuid, in_day date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ja uuid := auth.uid();
  inne int;
  moje_woj text;
  obce int;
begin
  if ja is null then return null; end if;

  if in_day < current_date or in_day > current_date + 6 then
    return 'Zapisać się można na dziś i sześć kolejnych dni.';
  end if;

  select count(distinct ch.court_id) into inne
    from checkins ch
   where ch.user_id = ja
     and ch.day = in_day
     and ch.court_id <> in_court;

  if inne >= 2 then
    return 'Masz już na ten dzień dwa boiska. Odwołaj jedno, żeby zapisać się tutaj.';
  end if;

  if inne = 1 then
    select c.voivodeship into moje_woj from courts c where c.id = in_court;

    select count(*) into obce
      from checkins ch
      join courts c on c.id = ch.court_id
     where ch.user_id = ja
       and ch.day = in_day
       and ch.court_id <> in_court
       and c.voivodeship is distinct from moje_woj;

    if obce > 0 then
      return 'Drugie boisko tego dnia musi być w tym samym województwie co pierwsze.';
    end if;
  end if;

  return null;
end $$;

grant execute on function public.checkin_blokada(uuid, date) to authenticated;

/* ---------- 2. panel dla wybranego dnia + podgląd tygodnia ---------- */
/*
  To samo co `checkin_panel(uuid)`, tylko dla `in_day`, i z dwoma polami więcej:
    - `tydzien`  - ile RÓŻNYCH osób idzie na to boisko w każdy z siedmiu dni (także zera,
                   żeby pasek dni nie musiał sam dopełniać dziur),
    - `moje_dni` - dni, na które sam się tu zapisałem, z godzinami - do znaczników na pasku.
  Plus `dzis`: dzisiejsza data WEDŁUG BAZY. Przeglądarka buduje pasek dni od niej, a nie
  od własnego zegara - inaczej koło północy „dziś" w przeglądarce i w bazie to dwa różne
  dni i zapis leciałby na zły.
*/
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
      select json_agg(json_build_object('day', d.day, 'osoby', coalesce(x.osoby, 0)) order by d.day)
        from (select (current_date + i)::date as day from generate_series(0, 6) i) d
        left join (
          select c.day, count(distinct c.user_id)::integer as osoby
            from checkins c
           where c.court_id = in_court
             and c.day between current_date and current_date + 6
           group by c.day
        ) x on x.day = d.day
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

/* ---------- 3. komunikaty wyzwalacza bez „dziś" ---------- */
/*
  Logika bez zmian względem `migration-jedna-godzina-jedno-boisko.sql`. Zmienia się tylko
  słowo: przy zapisie na sobotę „drugie boisko na dziś" brzmiało, jakby baza pomyliła dni.
*/
create or replace function checkins_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ile int;
  inne int;
  moje_woj text;
  obce int;
  gdzie_indziej text;
begin
  select count(*) into ile
    from checkins
   where court_id = new.court_id
     and user_id = new.user_id
     and day = new.day;

  if ile >= 12 then
    raise exception 'Najwyżej 12 godzin na jednym boisku w ciągu dnia'
      using errcode = 'check_violation';
  end if;

  select c.name into gdzie_indziej
    from checkins ch
    join courts c on c.id = ch.court_id
   where ch.user_id = new.user_id
     and ch.day = new.day
     and ch.hour = new.hour
     and ch.court_id <> new.court_id
   limit 1;

  if gdzie_indziej is not null then
    raise exception 'O %:00 jesteś już zapisany na boisko „%". Nie da się grać w dwóch miejscach naraz.',
      lpad(new.hour::text, 2, '0'), gdzie_indziej
      using errcode = 'check_violation';
  end if;

  select count(distinct ch.court_id) into inne
    from checkins ch
   where ch.user_id = new.user_id
     and ch.day = new.day
     and ch.court_id <> new.court_id;

  if inne >= 2 then
    raise exception 'Na jeden dzień można zapisać się najwyżej na dwa boiska'
      using errcode = 'check_violation';
  end if;

  if inne = 1 then
    select c.voivodeship into moje_woj from courts c where c.id = new.court_id;

    select count(*) into obce
      from checkins ch
      join courts c on c.id = ch.court_id
     where ch.user_id = new.user_id
       and ch.day = new.day
       and ch.court_id <> new.court_id
       and c.voivodeship is distinct from moje_woj;

    if obce > 0 then
      raise exception 'Drugie boisko tego dnia musi być w tym samym województwie'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

-- ============================================================ kontrola
/* Siedem dni, same zera albo liczby - bez dziur. */
select public.checkin_panel(id, current_date + 3) -> 'tydzien' as tydzien
  from courts
 limit 1;
