-- =====================================================================
--  „Idę dziś zagrać", powiadomienia o zgłoszeniach i raport braków
--
--  1. checkins  - deklaracje gry: kto i o której idzie na dane boisko.
--                 To jedyna funkcja w serwisie, która daje powód, żeby wracać
--                 codziennie, więc dane muszą być tanie w odczycie i odporne
--                 na nadużycia (jedna deklaracja na osobę, boisko i dzień).
--  2. submissions.notified_at - znacznik wysłania maila do autora zgłoszenia,
--                 żeby ta sama decyzja nie poszła pocztą dwa razy.
--  3. courts_braki - widok „co uzupełnić" dla panelu administratora.
-- =====================================================================

/* ---------- 1. deklaracje gry ---------- */
create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references courts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- dzień gry (dziś albo jeden z najbliższych) i planowana godzina
  day        date not null default current_date,
  hour       smallint not null check (hour between 0 and 23),
  created_at timestamptz not null default now(),
  unique (court_id, user_id, day)
);

create index if not exists checkins_court_day_idx on checkins (court_id, day);
create index if not exists checkins_day_idx on checkins (day);

alter table checkins enable row level security;

-- Czytanie idzie wyłącznie przez funkcje zbiorcze poniżej, żeby nie dawać nikomu
-- listy „kto konkretnie idzie" - w serwisie pokazujemy tylko liczby.
drop policy if exists checkins_own_read on checkins;
create policy checkins_own_read on checkins for select
  using (user_id = auth.uid());

drop policy if exists checkins_insert on checkins;
create policy checkins_insert on checkins for insert
  with check (
    user_id = auth.uid()
    and day between current_date and current_date + 7
  );

drop policy if exists checkins_delete on checkins;
create policy checkins_delete on checkins for delete
  using (user_id = auth.uid());

grant select, insert, delete on checkins to authenticated;

/** Deklaracje na dany dzień dla jednego boiska: godzina i liczba osób. */
create or replace function checkins_for_court(in_court uuid, in_day date default current_date)
returns table (hour smallint, people integer)
language sql stable security definer set search_path = public as $$
  select c.hour, count(*)::integer as people
    from checkins c
   where c.court_id = in_court
     and c.day = in_day
   group by c.hour
   order by c.hour;
$$;

grant execute on function checkins_for_court(uuid, date) to anon, authenticated;

/** Liczby na dziś dla wielu boisk naraz - do mapy i listy wyników. */
create or replace function checkins_summary(in_courts uuid[])
returns table (court_id uuid, people integer, first_hour smallint)
language sql stable security definer set search_path = public as $$
  select c.court_id, count(*)::integer as people, min(c.hour)::smallint as first_hour
    from checkins c
   where c.day = current_date
     and c.court_id = any (in_courts)
   group by c.court_id;
$$;

grant execute on function checkins_summary(uuid[]) to anon, authenticated;

/** Czyszczenie starych deklaracji - wołane przy okazji odczytu podsumowania. */
create or replace function checkins_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from checkins where day < current_date - 1;
$$;

grant execute on function checkins_cleanup() to authenticated;

/* ---------- 2. znacznik powiadomienia autora zgłoszenia ---------- */
alter table submissions add column if not exists notified_at timestamptz;

/**
 * „Zaklepuje" zgłoszenie do wysyłki maila: pierwsze wywołanie zwraca adres autora,
 * każde kolejne null. Ten sam wzorzec co przy opiniach - bez niego dałoby się
 * wielokrotnie uderzyć w endpoint pocztowy i zasypać skrzynkę autora.
 */
create or replace function submission_claim_for_mail(sub uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  adres text;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator' using errcode = 'insufficient_privilege';
  end if;

  update submissions s
     set notified_at = now()
   where s.id = sub
     and s.notified_at is null
     and s.author_email is not null
  returning s.author_email into adres;

  return adres;
end $$;

grant execute on function submission_claim_for_mail(uuid) to authenticated;

/* ---------- 3. raport braków dla panelu ---------- */
create or replace view courts_braki with (security_invoker = true) as
select
  c.id,
  c.slug,
  c.name,
  c.city,
  c.created_at,
  (select count(*) from court_photos p where p.court_id = c.id) as zdjecia,
  (select count(*) = 0 from court_photos p where p.court_id = c.id) as brak_zdjec,
  (c.hours is null or btrim(c.hours) = '') as brak_godzin,
  (c.description is null or length(btrim(c.description)) < 40) as krotki_opis,
  (c.surface is null) as brak_nawierzchni
from courts c;

grant select on courts_braki to anon, authenticated;

/* ---------- kontrola ---------- */
select
  (select count(*) from checkins) as deklaracje,
  (select count(*) from courts_braki where brak_zdjec or brak_godzin or krotki_opis) as boiska_do_uzupelnienia;
