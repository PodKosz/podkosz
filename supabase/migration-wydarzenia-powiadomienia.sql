-- =====================================================================
--  Powiadomienia o wydarzeniach.
--  Uruchom raz, po `migration-wydarzenia.sql`.
--
--  Kiedy administrator zakłada wydarzenie, list dostają ci, którzy dali temu boisku
--  ogień - albo boisku w okolicy. To jedyna wiadomość w serwisie, która wychodzi bez
--  pytania, więc obwarowana jest z czterech stron:
--
--    1. WYŁĄCZNIK. `profiles.powiadomienia` - przełącznik na stronie konta. Domyślnie
--       włączony (bo inaczej funkcja nie miałaby sensu), ale odbiorca wyłącza go jednym
--       kliknięciem, a każdy list mówi w stopce, gdzie to zrobić.
--    2. JEDEN LIST NA WYDARZENIE. `wydarzenia.powiadomiono_at` - kolumna, a nie
--       ostrożność w kodzie. Drugie wywołanie wysyłki odbija się od bazy, nawet gdy
--       ktoś kliknie dwa razy albo powtórzy żądanie.
--    3. TYLKO ADMINISTRATOR. Lista adresów wychodzi z funkcji `security definer`, która
--       najpierw pyta `is_admin`. Klucz „anon" jest publiczny, więc bez tego warunku
--       byłby to eksport skrzynek wszystkich użytkowników.
--    4. ZBANOWANI I BEZ ADRESU wypadają z listy w samym zapytaniu.
-- =====================================================================

alter table public.wydarzenia add column if not exists powiadomiono_at timestamptz;
alter table public.wydarzenia add column if not exists powiadomiono_ile integer;

alter table public.profiles add column if not exists powiadomienia boolean not null default true;

/* ---------- kto ma dostać list ---------- */
/*
  Trzy źródła, w kolejności od najmocniejszego sygnału:
    - ogień na TYM boisku,
    - deklaracja „zagram dziś" na tym boisku w ostatnim kwartale (ktoś tu naprawdę bywa),
    - ogień na boisku w promieniu `p_promien_km`.
  Kto łapie się na dwa, dostaje jeden list z mocniejszym powodem - stąd `bool_or`
  i grupowanie po użytkowniku, a nie zwykła suma zapytań.

  Adresy leżą w `auth.users`, do której nikt z zewnątrz nie ma wglądu - dlatego funkcja
  jest `security definer` i dlatego zaczyna się od sprawdzenia, kto pyta.
*/
create or replace function public.wydarzenie_odbiorcy(
  p_id uuid,
  p_promien_km double precision default 15
)
returns table (email text, nick text, powod text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  w_court uuid;
  w_lat   double precision;
  w_lng   double precision;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  select ww.court_id, c.lat, c.lng
    into w_court, w_lat, w_lng
    from wydarzenia ww
    join courts c on c.id = ww.court_id
   where ww.id = p_id;

  if w_court is null then
    raise exception 'Nie ma takiego wydarzenia.';
  end if;

  return query
  with zainteresowani as (
    select l.user_id, bool_or(l.court_id = w_court) as tu
      from likes l
      join courts c on c.id = l.court_id
     where l.court_id = w_court
        or distance_m(w_lat, w_lng, c.lat, c.lng) <= p_promien_km * 1000
     group by l.user_id

    union all

    select ch.user_id, true as tu
      from checkins ch
     where ch.court_id = w_court
       and ch.day > current_date - 90

  ), zwiniete as (
    select user_id, bool_or(tu) as tu
      from zainteresowani
     group by user_id
  )
  select u.email::text,
         coalesce(nullif(btrim(p.display_name), ''), 'graczu')::text,
         (case when z.tu then 'to-boisko' else 'okolica' end)::text
    from zwiniete z
    join profiles p on p.id = z.user_id
    join auth.users u on u.id = z.user_id
   where p.banned_at is null
     and p.powiadomienia
     and u.email is not null;
end;
$$;

revoke all on function public.wydarzenie_odbiorcy(uuid, double precision) from public;
grant execute on function public.wydarzenie_odbiorcy(uuid, double precision) to authenticated;

/* ---------- oznaczenie „list poszedł" ---------- */
/*
  Zaklepanie, nie zwykły update: funkcja zwraca prawdę tylko przy PIERWSZYM wywołaniu,
  bo warunek `powiadomiono_at is null` jest częścią zapytania. Dwa równoległe żądania
  nie wyślą dwóch wysyłek - drugie dostanie fałsz i nic nie zrobi.
*/
create or replace function public.wydarzenie_zaklep_wysylke(p_id uuid, p_ile integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  zmienione integer;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  update wydarzenia
     set powiadomiono_at = now(),
         powiadomiono_ile = greatest(coalesce(p_ile, 0), 0)
   where id = p_id
     and powiadomiono_at is null;

  get diagnostics zmienione = row_count;
  return zmienione > 0;
end;
$$;

revoke all on function public.wydarzenie_zaklep_wysylke(uuid, integer) from public;
grant execute on function public.wydarzenie_zaklep_wysylke(uuid, integer) to authenticated;

/* ---------- wyłącznik po stronie użytkownika ---------- */
/*
  Własne ustawienie zmienia właściciel konta i nikt inny. Polityki na `profiles`
  pilnują tego już przy innych kolumnach, więc wystarczy sprawdzić, czy update
  na tej kolumnie przez nie przechodzi - kontrola na końcu pliku.
*/

-- ============================================================ kontrola
select 'wydarzenia' as co, count(*)::text as ile from public.wydarzenia
union all select 'z wysłanym powiadomieniem', count(*)::text
  from public.wydarzenia where powiadomiono_at is not null
union all select 'konta z włączonymi powiadomieniami', count(*)::text
  from public.profiles where powiadomienia
union all select 'polityki update na profiles', count(*)::text
  from pg_policies where tablename = 'profiles' and cmd = 'UPDATE';
