-- =====================================================================
--  Jedna godzina, jedno boisko
--
--  Deklaracja mówi, GDZIE KTOŚ FAKTYCZNIE BĘDZIE. Do tej pory nic nie broniło zapisać
--  się na 16-19 na jednym boisku i na 16-19 na drugim - a nikt nie gra w dwóch miejscach
--  naraz. Skutek był podwójny i oba złe: tłum na mapie liczył tę samą osobę dwa razy,
--  a odznaczenia „Bywalec" i „Regularny" naliczały godziny, których nie było.
--
--  Zapora jest INDEKSEM, nie warunkiem w wyzwalaczu, i to jest sedno tej migracji.
--  Wyzwalacz sprawdzający „czy istnieje już wiersz na tę godzinę" czyta i zapisuje
--  w dwóch krokach, więc dwa równoległe zapisy mogą oba zobaczyć puste miejsce i oba
--  wstawić. Indeks unikatowy nie ma tej szczeliny - to baza, nie kod, pilnuje, że wiersz
--  jest jeden. Wyzwalacz zostaje, ale wyłącznie po to, żeby zamiast surowego
--  „duplicate key value violates unique constraint" padło zdanie po polsku.
--
--  Co NIE jest tu zabronione, celowo:
--    - dwa boiska tego samego dnia w rozłącznych godzinach (16-18 tu, 19-21 tam) - to
--      normalny wieczór, a limit dwóch boisk dziennie pilnuje osobna zasada;
--    - zmiana własnych godzin na tym samym boisku - zapis kasuje stare wiersze przed
--      wstawieniem nowych, więc nie wpada na własny indeks.
--
--  URUCHOM PO `migration-checkin-panel.sql`.
-- =====================================================================

/* ---------- 1. czy w danych są już kolizje ---------- */
/*
  Indeks nie powstanie, jeśli ktoś w przeszłości zapisał się na tę samą godzinę na dwóch
  boiskach. Najpierw więc PATRZYMY, ilu to dotyczy - i dopiero wtedy decydujemy, co z tym
  zrobić. Ten blok niczego nie zmienia, tylko wypisuje liczbę w dzienniku.
*/
do $$
declare
  kolizji int;
begin
  select count(*) into kolizji
    from (
      select user_id, day, hour
        from checkins
       group by user_id, day, hour
      having count(distinct court_id) > 1
    ) k;

  if kolizji = 0 then
    raise notice 'Kolizji brak - indeks powstanie bez przeszkód.';
  else
    raise notice 'UWAGA: % godzin z dwoma boiskami naraz. Indeks NIE powstanie, dopóki '
                 'nie uruchomisz bloku porzadkujacego z punktu 2.', kolizji;
  end if;
end $$;

/* ---------- 2. porządkowanie kolizji ---------- */
/*
  ODKOMENTUJ I URUCHOM TYLKO WTEDY, gdy punkt 1 wypisał liczbę większą od zera.

  Zostaje deklaracja zapisana WCZEŚNIEJ, późniejsza znika. To nie jest wybór estetyczny:
  przy dwóch sprzecznych deklaracjach nie da się zgadnąć, gdzie ktoś naprawdę był, więc
  bierzemy tę, przy której nie było jeszcze konfliktu. Usuwa to CUDZE DANE, dlatego nie
  wykonuje się samo.
*/
-- delete from checkins c
--  using checkins starsza
--  where c.user_id = starsza.user_id
--    and c.day = starsza.day
--    and c.hour = starsza.hour
--    and c.court_id <> starsza.court_id
--    and (starsza.created_at, starsza.id) < (c.created_at, c.id);

/* ---------- 3. zapora ---------- */
create unique index if not exists checkins_user_day_hour_uidx
  on checkins (user_id, day, hour);

/* ---------- 4. komunikat po polsku zamiast błędu indeksu ---------- */
/*
  Wyzwalacz przejmuje te same zasady co dotąd (12 godzin na boisku, dwa boiska dziennie,
  jedno województwo) i dokłada czwartą. Kolejność sprawdzeń idzie od najczęstszej pomyłki
  do najrzadszej, żeby człowiek dostał komunikat o tym, co zrobił, a nie o pierwszym
  warunku z brzegu.
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

  /*
    Ta sama godzina na innym boisku. Sprawdzamy PRZED limitami boisk, bo to zderzenie
    jest konkretniejsze - da się nazwać boisko, na które ktoś jest już zapisany.
  */
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

  /*
    Liczymy INNE boiska niż to wstawiane. Zakres godzin to wiele wierszy na to samo
    boisko, a zmiana godzin kasuje stare wiersze i wstawia nowe - bez tego warunku
    poprawienie własnej deklaracji potrafiłoby wpaść na własny limit.
  */
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
      raise exception 'Drugie boisko na dziś musi być w tym samym województwie'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

/* ---------- 5. panel oddaje godziny zajęte gdzie indziej ---------- */
/*
  Żeby dało się je wygasić w siatce ZANIM ktoś kliknie. Bez tego jedyną informacją
  zwrotną byłby błąd po kliknięciu - a wtedy stara deklaracja jest już skasowana.

  Lista dotyczy WYŁĄCZNIE innych boisk. Własne godziny na tym boisku przychodzą osobno,
  polem `moje`, i mają być normalnie wybieralne: zmiana zakresu w miejscu to nie kolizja.
*/
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
    /* godziny zajęte dziś na INNYM boisku - do wygaszenia w siatce */
    'zajete', coalesce(
      (
        select json_agg(distinct c.hour order by c.hour)
          from checkins c
         where c.day = current_date
           and c.user_id = auth.uid()
           and c.court_id <> in_court
      ),
      '[]'::json
    ),
    /* powód blokady albo null; dla niezalogowanego zawsze null - patrz `checkin_blokada` */
    'blokada', checkin_blokada(in_court)
  );
$$;

grant execute on function public.checkin_panel(uuid) to anon, authenticated;

/*
  Zapasowa ścieżka panelu w przeglądarce pyta czterema osobnymi wywołaniami. Dostaje
  piąte, żeby i tam siatka wiedziała, co wygasić.
*/
create or replace function public.checkin_zajete(in_court uuid)
returns int[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct c.hour order by c.hour), '{}')
    from checkins c
   where c.day = current_date
     and c.user_id = auth.uid()
     and c.court_id <> in_court;
$$;

grant execute on function public.checkin_zajete(uuid) to authenticated;

-- ============================================================ kontrola
/* Powinno oddać pustą tabelę - jeśli nie, punkt 3 i tak by nie przeszedł. */
select user_id, day, hour, count(distinct court_id) as boisk
  from checkins
 group by user_id, day, hour
having count(distinct court_id) > 1;

/* Indeks ma istnieć. */
select indexname from pg_indexes
 where tablename = 'checkins' and indexname = 'checkins_user_day_hour_uidx';
