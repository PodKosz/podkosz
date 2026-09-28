-- =====================================================================
--  RODO: wypisanie z powiadomień jednym kliknięciem i terminy usuwania danych.
--  Uruchom raz, po `migration-wydarzenia-powiadomienia.sql` (#33).
--
--  Polityka prywatności obiecywała terminy („skróty IP do 30 dni", „opinie do 24
--  miesięcy", „odrzucone zgłoszenia do 12 miesięcy"), ale nic w bazie ich nie pilnowało -
--  dane leżały bez końca. Ten plik robi z obietnic mechanizm:
--
--    1. WYPIS. Każde konto dostaje losowy token, który trafia do stopki i nagłówka
--       `List-Unsubscribe` listu o wydarzeniu. Link wyłącza powiadomienia bez logowania.
--       Tokeny leżą w osobnej tabeli bez polityk, a nie w `profiles`: profile są czytelne
--       dla wszystkich, a token w publicznej kolumnie pozwoliłby wypisać każdego.
--    2. SPRZĄTANIE CO NOC. `sprzataj_dane_osobowe()` pod pg_cron, w samej bazie. Nie przez
--       cron Vercela: ten jest zamknięty na `CRON_SECRET`, a zadanie od którego zależy
--       zgodność z polityką nie może zależeć od zmiennej, której ktoś zapomni ustawić.
--       Funkcja nie ma żadnych uprawnień do wywołania z zewnątrz.
--    3. ODRZUCONE ZGŁOSZENIA ZE ZDJĘCIAMI. Pliki leżą w R2 i kasuje je tylko administrator
--       (Worker sprawdza jego sesję), więc to sprzątanie robi panel: pyta o listę,
--       kasuje pliki, potem wiersze. Stąd dwie funkcje zamiast jednej.
-- =====================================================================


-- ============================================================ 1. wypis
create table if not exists public.wypis_tokeny (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.wypis_tokeny enable row level security;
/* celowo bez żadnej polityki - tabela jest niewidoczna dla kluczy anon i authenticated */
revoke all on public.wypis_tokeny from anon, authenticated;

/*
  Odbiorcy wydarzenia - jak w #33, plus token wypisu. Zmiana typu zwracanego wymaga
  `drop`, `create or replace` jej nie przepuści. Brakujące tokeny dokładamy tuż przed
  zapytaniem, więc konto założone wczoraj też dostaje działający link.
*/
drop function if exists public.wydarzenie_odbiorcy(uuid, double precision);

create function public.wydarzenie_odbiorcy(
  p_id uuid,
  p_promien_km double precision default 15
)
returns table (email text, nick text, powod text, wypis uuid)
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

  insert into wypis_tokeny (user_id)
  select u.id from auth.users u
   where not exists (select 1 from wypis_tokeny t where t.user_id = u.id)
  on conflict (user_id) do nothing;

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
         (case when z.tu then 'to-boisko' else 'okolica' end)::text,
         t.token
    from zwiniete z
    join profiles p on p.id = z.user_id
    join auth.users u on u.id = z.user_id
    join wypis_tokeny t on t.user_id = z.user_id
   where p.banned_at is null
     and p.powiadomienia
     and u.email is not null;
end;
$$;

revoke all on function public.wydarzenie_odbiorcy(uuid, double precision) from public;
grant execute on function public.wydarzenie_odbiorcy(uuid, double precision) to authenticated;

/*
  Wypis bez logowania - token jest jedynym dowodem. To uuid v4, czyli 122 losowe bity:
  zgadywanie nie wchodzi w grę, a funkcja umie tylko WYŁĄCZYĆ powiadomienia, więc nawet
  cudzy token nie daje niczego poza tym. Zwraca fałsz przy nieznanym tokenie, żeby strona
  mogła powiedzieć „ten link nie działa" zamiast udawać sukces.
*/
create or replace function public.wypisz_z_powiadomien(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  kto uuid;
begin
  select user_id into kto from wypis_tokeny where token = p_token;
  if kto is null then
    return false;
  end if;

  update profiles set powiadomienia = false where id = kto;
  return true;
end;
$$;

revoke all on function public.wypisz_z_powiadomien(uuid) from public;
grant execute on function public.wypisz_z_powiadomien(uuid) to anon, authenticated;


-- ============================================================ 2. terminy
/*
  Terminy są te same, co w polityce prywatności - zmiana jednego bez drugiego to znowu
  obietnica bez pokrycia.

  Skróty IP przy zgłoszeniach, opiniach i raportach służą tylko limitom (okna godziny
  i doby), więc po 30 dniach nie mają już żadnej roboty - czyścimy samą kolumnę, wpis
  zostaje. `visit_days` trzyma skrót razem z dniem wizyty i karmi statystyki w panelu:
  12 miesięcy, potem wiersz znika (licznik „unikalnych" w panelu liczy się od tej pory
  z ostatniego roku, nie od początku świata).
*/
create or replace function public.sprzataj_dane_osobowe()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wynik jsonb := '{}'::jsonb;
  n integer;
begin
  update submissions set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('skroty_zgloszen', n);

  update feedback set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('skroty_opinii', n);

  update reports set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('skroty_raportow', n);

  delete from feedback where created_at < now() - interval '24 months';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('opinie', n);

  delete from reports where created_at < now() - interval '24 months';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('raporty', n);

  delete from visit_days where day < current_date - interval '12 months';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('wizyty', n);

  delete from obecnosc where ostatnio < now() - interval '1 day';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('obecnosc', n);

  /* blokada trzyma adres w czytelnej postaci - miesiąc po jej końcu nie ma po co */
  delete from ip_bans where banned_until < now() - interval '30 days';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('bany', n);

  /* lista na otwarcie ma jeden list; po wysłaniu miesiąc na ewentualne pytania i koniec */
  delete from launch_signups where notified_at < now() - interval '30 days';
  get diagnostics n = row_count;
  wynik := wynik || jsonb_build_object('zapisy_na_otwarcie', n);

  return wynik;
end;
$$;

revoke all on function public.sprzataj_dane_osobowe() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

/* pg_cron od 1.3 nadpisuje zadanie o tej samej nazwie, więc plik można puścić drugi raz */
select cron.schedule(
  'podkosz-sprzatanie-danych',
  '20 3 * * *',
  $cron$select public.sprzataj_dane_osobowe()$cron$
);


-- ============================================================ 3. odrzucone zgłoszenia
/*
  Odrzucone zgłoszenia boisk i poprawki zdjęć starsze niż 12 miesięcy (licząc od decyzji,
  a dla starych wpisów bez daty decyzji - od zgłoszenia). Zwraca ścieżki plików, bo te
  kasuje panel przez Workera R2; wiersze znikają dopiero w `usun_odrzucone`.
*/
create or replace function public.odrzucone_do_usuniecia()
returns table (rodzaj text, id uuid, sciezki text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  return query
  select 'zgloszenie'::text,
         s.id,
         coalesce(array_agg(sp.storage_path) filter (where sp.storage_path is not null), '{}'::text[])
    from submissions s
    left join submission_photos sp on sp.submission_id = s.id
   where s.status = 'rejected'
     and coalesce(s.reviewed_at, s.created_at) < now() - interval '12 months'
   group by s.id

  union all

  select 'poprawka'::text, ps.id, array[ps.storage_path]
    from photo_swaps ps
   where ps.status = 'rejected'
     and coalesce(ps.resolved_at, ps.created_at) < now() - interval '12 months';
end;
$$;

revoke all on function public.odrzucone_do_usuniecia() from public;
grant execute on function public.odrzucone_do_usuniecia() to authenticated;

create or replace function public.usun_odrzucone(p_zgloszenia uuid[], p_poprawki uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  razem integer := 0;
  n integer;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  /* warunek `rejected` powtórzony celowo - funkcja nie skasuje niczego innego */
  delete from submissions
   where id = any(coalesce(p_zgloszenia, '{}'::uuid[])) and status = 'rejected';
  get diagnostics n = row_count;
  razem := razem + n;

  delete from photo_swaps
   where id = any(coalesce(p_poprawki, '{}'::uuid[])) and status = 'rejected';
  get diagnostics n = row_count;
  razem := razem + n;

  return razem;
end;
$$;

revoke all on function public.usun_odrzucone(uuid[], uuid[]) from public;
grant execute on function public.usun_odrzucone(uuid[], uuid[]) to authenticated;


-- ============================================================ kontrola
select 'pierwsze sprzątanie' as co, public.sprzataj_dane_osobowe()::text as wynik
union all select 'zadanie w pg_cron', count(*)::text
  from cron.job where jobname = 'podkosz-sprzatanie-danych'
union all select 'funkcja wypisu', count(*)::text
  from pg_proc where proname = 'wypisz_z_powiadomien';
