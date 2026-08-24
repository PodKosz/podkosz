-- =====================================================================
--  Zapisy na otwarcie serwisu
--
--  Na stronie „Już niedługo" każdy może zostawić adres i dostać jedną wiadomość w dniu,
--  w którym serwis rusza. To nie jest newsletter: list idzie raz, a wiersz dostaje wtedy
--  `notified_at`, więc drugi raz już nie pójdzie.
--
--  Zapisać się może każdy, także niezalogowany - inaczej cała rzecz nie miałaby sensu,
--  bo zapisy zbieramy właśnie od ludzi bez konta. Listy nikt poza administratorem nie
--  widzi: polityka odczytu wymaga roli admina, a `insert` nie zwraca wiersza.
-- =====================================================================

create table if not exists public.launch_signups (
  email       text primary key,
  created_at  timestamptz not null default now(),
  /* kiedy poszła wiadomość o otwarciu - null oznacza „jeszcze nie" */
  notified_at timestamptz
);

create index if not exists launch_signups_do_wyslania_idx
  on public.launch_signups (created_at)
  where notified_at is null;

/* adresy trzymamy małymi literami i odrzucamy oczywiste literówki już w bazie */
create or replace function public.zapis_normalizuj() returns trigger
language plpgsql as $$
begin
  new.email := lower(btrim(new.email));

  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'To nie wygląda na adres e-mail.';
  end if;

  /* pola technicznego nikt z zewnątrz nie ustawia */
  new.notified_at := null;
  return new;
end;
$$;

drop trigger if exists launch_signups_normalizuj on public.launch_signups;
create trigger launch_signups_normalizuj
  before insert on public.launch_signups
  for each row execute function public.zapis_normalizuj();

alter table public.launch_signups enable row level security;

grant insert on table public.launch_signups to anon, authenticated;
grant select on table public.launch_signups to authenticated;

drop policy if exists launch_signups_insert on public.launch_signups;
create policy launch_signups_insert on public.launch_signups
  for insert with check (true);

drop policy if exists launch_signups_admin on public.launch_signups;
create policy launch_signups_admin on public.launch_signups
  for select using (is_admin(auth.uid()));

/* ---------- ile osób czeka ---------- */
/*
  Licznik pod przyciskiem ma pokazać, że ktoś już się zapisał, a nie ujawnić listę.
  Dlatego zwraca samą liczbę i jest SECURITY DEFINER - tabela zostaje zamknięta.
*/
create or replace function public.zapisow_na_otwarcie()
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from launch_signups;
$$;

grant execute on function public.zapisow_na_otwarcie() to anon, authenticated;

/* ---------- porcja adresów do wysyłki ---------- */
/*
  Zaklepanie działa tak samo jak przy powitaniach: funkcja od razu stawia `notified_at`
  i oddaje adresy, więc dwa równoległe uderzenia w endpoint nie wyślą listu dwa razy.
  Wysyłkę robimy porcjami, bo dostawca poczty przyjmuje ograniczoną liczbę wiadomości
  w jednym żądaniu.
*/
create or replace function public.zapisy_zaklep(p_ile integer default 90)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  return query
    with porcja as (
      select s.email
        from launch_signups s
       where s.notified_at is null
       order by s.created_at
       limit greatest(1, least(coalesce(p_ile, 90), 200))
       for update skip locked
    )
    update launch_signups u
       set notified_at = now()
      from porcja
     where u.email = porcja.email
    returning u.email;
end;
$$;

revoke all on function public.zapisy_zaklep(integer) from public;
grant execute on function public.zapisy_zaklep(integer) to authenticated;

/* ---------- zwolnienie po nieudanej wysyłce ---------- */
create or replace function public.zapisy_zwolnij(p_adresy text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  update launch_signups set notified_at = null where email = any(p_adresy);
end;
$$;

revoke all on function public.zapisy_zwolnij(text[]) from public;
grant execute on function public.zapisy_zwolnij(text[]) to authenticated;

/* ---------- kontrola ---------- */
select count(*) as zapisanych, count(notified_at) as powiadomionych
  from public.launch_signups;
