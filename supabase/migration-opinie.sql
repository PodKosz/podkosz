-- =====================================================================
--  Opinie graczy o boiskach (23.10.2026).
--
--  1. opinie          - ocena 1-5, tagi z zamkniętej listy, tekst do 500 znaków.
--                       Jedna opinia na osobę i boisko (edytowalna).
--  2. opinie_pomocne  - „Pomocne” pod cudzą opinią, jedno na osobę.
--  3. courts.opinie_liczba / opinie_srednia - liczniki przy boisku, liczone
--                       wyzwalaczem (karty, ranking i dane strukturalne nie
--                       muszą liczyć średniej przy każdym wejściu).
--  4. opinie_boiska() - lista do karty boiska z nickiem, avatarem i licznikiem
--                       „Pomocne”; ukryte przez administratora nie wychodzą.
--  5. opinie_ukryj()  - moderacja: administrator chowa i przywraca opinię.
--
--  Zapis tylko dla zalogowanych i niezablokowanych (`zbanowany()` z
--  migration-konto.sql). Tagi i długość tekstu sprawdza baza, nie przeglądarka -
--  obejście przez wywołanie REST API nic nie da. Usunięcie konta kasuje opinie
--  (klucz obcy do profiles z `on delete cascade`).
-- =====================================================================

/* ---------- tagi: zamknięta lista kluczy (podpisy po polsku są w lib/opinie.ts) ---------- */
create or replace function opinie_dozwolone_tagi()
returns text[] language sql immutable as $$
  select array[
    'dobre_obrecze', 'rowna_nawierzchnia', 'wysoki_poziom', 'swietny_klimat',
    'pusto_rano', 'blisko_komunikacji', 'tloczno_weekend', 'slisko_po_deszczu',
    'ciemno_wieczorem', 'krzywe_obrecze', 'zniszczona_nawierzchnia', 'malo_miejsca'
  ]::text[];
$$;

/* ---------- 1. opinie ---------- */
create table if not exists opinie (
  id          uuid primary key default gen_random_uuid(),
  court_id    uuid not null references courts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  ocena       smallint not null check (ocena between 1 and 5),
  tagi        text[] not null default '{}'
              check (cardinality(tagi) <= 6 and tagi <@ opinie_dozwolone_tagi()),
  tekst       text check (tekst is null or char_length(tekst) <= 500),
  ukryta      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (court_id, user_id)
);

create index if not exists opinie_boisko_idx on opinie (court_id, created_at desc);
create index if not exists opinie_autor_idx on opinie (user_id, created_at desc);

/* pusty tekst zapisujemy jako brak tekstu, a datę edycji stawia baza */
create or replace function opinie_porzadek()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tekst := nullif(btrim(coalesce(new.tekst, '')), '');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_at := old.created_at;
    new.court_id := old.court_id;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

drop trigger if exists opinie_porzadek_trigger on opinie;
create trigger opinie_porzadek_trigger
  before insert or update on opinie
  for each row execute function opinie_porzadek();

/*
  Limit: najwyżej 20 nowych opinii na dobę z jednego konta. Człowiek opisujący
  boiska, na których grał, nie dobije do tego nigdy; skrypt spamujący - od razu.
*/
create or replace function opinie_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from opinie
       where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Za dużo opinii w ciągu doby - spróbuj jutro.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists opinie_limit_trigger on opinie;
create trigger opinie_limit_trigger
  before insert on opinie
  for each row execute function opinie_limit();

/* ---------- 3. liczniki przy boisku ---------- */
alter table courts add column if not exists opinie_liczba integer not null default 0;
alter table courts add column if not exists opinie_srednia numeric(3,2);

create or replace function opinie_przelicz(boisko uuid)
returns void language sql security definer set search_path = public as $$
  update courts c
     set opinie_liczba  = s.liczba,
         opinie_srednia = s.srednia
    from (
      select count(*)::integer as liczba, round(avg(ocena)::numeric, 2) as srednia
        from opinie
       where court_id = boisko and not ukryta
    ) s
   where c.id = boisko;
$$;

create or replace function opinie_liczniki()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform opinie_przelicz(coalesce(new.court_id, old.court_id));
  return null;
end $$;

drop trigger if exists opinie_liczniki_trigger on opinie;
create trigger opinie_liczniki_trigger
  after insert or update or delete on opinie
  for each row execute function opinie_liczniki();

/* ---------- 2. „Pomocne” ---------- */
create table if not exists opinie_pomocne (
  opinia_id  uuid not null references opinie(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opinia_id, user_id)
);

/* ---------- RLS ---------- */
alter table opinie enable row level security;
alter table opinie_pomocne enable row level security;

drop policy if exists opinie_odczyt on opinie;
create policy opinie_odczyt on opinie for select
  using (not ukryta or user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists opinie_dodanie on opinie;
create policy opinie_dodanie on opinie for insert
  with check (user_id = auth.uid() and not ukryta and not zbanowany(auth.uid()));

drop policy if exists opinie_edycja on opinie;
create policy opinie_edycja on opinie for update
  using (user_id = auth.uid() and not zbanowany(auth.uid()))
  with check (user_id = auth.uid());

drop policy if exists opinie_usuniecie on opinie;
create policy opinie_usuniecie on opinie for delete
  using (user_id = auth.uid() or is_admin(auth.uid()));

/* zwykłe konto zmienia tylko treść - `ukryta` ustawia wyłącznie opinie_ukryj() */
revoke all on opinie from anon, authenticated;
grant select on opinie to anon, authenticated;
grant insert (court_id, user_id, ocena, tagi, tekst) on opinie to authenticated;
grant update (ocena, tagi, tekst) on opinie to authenticated;
grant delete on opinie to authenticated;

drop policy if exists pomocne_odczyt on opinie_pomocne;
create policy pomocne_odczyt on opinie_pomocne for select using (user_id = auth.uid());

drop policy if exists pomocne_dodanie on opinie_pomocne;
create policy pomocne_dodanie on opinie_pomocne for insert
  with check (
    user_id = auth.uid()
    and not zbanowany(auth.uid())
    /* pod własną opinią „Pomocne” nie ma sensu */
    and not exists (select 1 from opinie o where o.id = opinia_id and o.user_id = auth.uid())
  );

drop policy if exists pomocne_usuniecie on opinie_pomocne;
create policy pomocne_usuniecie on opinie_pomocne for delete using (user_id = auth.uid());

revoke all on opinie_pomocne from anon, authenticated;
grant select, insert, delete on opinie_pomocne to authenticated;

/* ---------- 4. lista do karty boiska ---------- */
create or replace function opinie_boiska(in_court uuid)
returns table (
  id uuid, ocena smallint, tagi text[], tekst text,
  created_at timestamptz, updated_at timestamptz,
  nick text, avatar text, pomocne integer, moja boolean, pomocna_dla_mnie boolean
)
language sql stable security definer set search_path = public as $$
  select o.id, o.ocena, o.tagi, o.tekst, o.created_at, o.updated_at,
         p.display_name, p.avatar_url,
         (select count(*)::integer from opinie_pomocne h where h.opinia_id = o.id),
         o.user_id = auth.uid(),
         exists (select 1 from opinie_pomocne h where h.opinia_id = o.id and h.user_id = auth.uid())
    from opinie o
    join profiles p on p.id = o.user_id
   where o.court_id = in_court
     and (not o.ukryta or o.user_id = auth.uid())
   order by o.created_at desc
   limit 200;
$$;

grant execute on function opinie_boiska(uuid) to anon, authenticated;

/* ---------- 5. moderacja ---------- */
create or replace function opinie_ukryj(in_opinia uuid, in_ukryta boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator może ukrywać opinie.';
  end if;
  update opinie set ukryta = in_ukryta where id = in_opinia;
end $$;

revoke all on function opinie_ukryj(uuid, boolean) from public;
grant execute on function opinie_ukryj(uuid, boolean) to authenticated;

select 'gotowe: opinie, pomocne, liczniki przy boisku' as wynik;
