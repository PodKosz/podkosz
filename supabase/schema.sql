-- =====================================================================
--  PodKosz — schemat bazy
--  Wklej całość do Supabase → SQL Editor → Run. Skrypt jest idempotentny.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- typy ----------
do $$ begin
  create type court_type as enum ('otwarty', 'kryty', 'streetball');
exception when duplicate_object then null; end $$;

do $$ begin
  create type surface_type as enum ('beton','asfalt','tartan','poliuretan','parkiet','syntetyk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_type as enum ('24h','godziny','ograniczony');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- profile użytkowników ----------
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now()
);

-- profil zakładany automatycznie przy rejestracji (również przez Google)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(coalesce(new.email,'gracz@boiska'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- ---------- boiska (tylko zatwierdzone) ----------
create table if not exists courts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  city          text not null,
  voivodeship   text not null,
  lat           double precision not null,
  lng           double precision not null,
  type          court_type not null default 'otwarty',
  surface       surface_type not null default 'beton',
  hoops         smallint not null default 2,
  lit           boolean not null default false,
  fenced        boolean not null default false,
  access        access_type not null default '24h',
  hours         text not null default 'całą dobę',
  description   text not null default '',
  basket_approved boolean not null default false,
  basket_note   text not null default '',
  likes_count   integer not null default 0,
  added_by      uuid references profiles(id) on delete set null,
  added_by_name text not null default 'gość',
  created_at    timestamptz not null default now()
);

create index if not exists courts_voivodeship_idx on courts (voivodeship);
create index if not exists courts_likes_idx on courts (likes_count desc);

create table if not exists court_photos (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references courts on delete cascade,
  kind         text not null,
  storage_path text not null,
  sort         smallint not null default 0
);
create index if not exists court_photos_court_idx on court_photos (court_id, sort);

-- ---------- zgłoszenia ----------
create table if not exists submissions (
  id            uuid primary key default gen_random_uuid(),
  status        submission_status not null default 'pending',
  reject_reason text,
  basket_approved boolean not null default false,
  basket_note   text not null default '',
  author_id     uuid references profiles(id) on delete set null,
  author_email  text,
  author_name   text,
  name          text not null default '',
  city          text not null default '',
  voivodeship   text not null default '',
  lat           double precision not null default 0,
  lng           double precision not null default 0,
  accuracy      integer,
  type          court_type not null default 'otwarty',
  surface       surface_type not null default 'beton',
  hoops         smallint not null default 2,
  lit           boolean not null default false,
  fenced        boolean not null default false,
  access        access_type not null default '24h',
  hours         text not null default 'całą dobę',
  notes         text not null default '',
  court_id      uuid references courts on delete set null,
  reviewed_at   timestamptz,
  reviewed_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists submissions_status_idx on submissions (status, created_at desc);

create table if not exists submission_photos (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions on delete cascade,
  kind          text not null,
  storage_path  text not null,
  sort          smallint not null default 0
);
create index if not exists submission_photos_sub_idx on submission_photos (submission_id, sort);

-- ---------- lajki (płonące piłki) i ulubione ----------
create table if not exists likes (
  user_id    uuid not null references profiles on delete cascade,
  court_id   uuid not null references courts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, court_id)
);

create table if not exists favorites (
  user_id    uuid not null references profiles on delete cascade,
  court_id   uuid not null references courts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, court_id)
);

-- licznik lajków trzymany przy boisku, żeby ranking i filtry były tanie
create or replace function sync_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update courts set likes_count = likes_count + 1 where id = new.court_id;
  elsif tg_op = 'DELETE' then
    update courts set likes_count = greatest(0, likes_count - 1) where id = old.court_id;
  end if;
  return null;
end $$;

drop trigger if exists likes_count_trigger on likes;
create trigger likes_count_trigger
  after insert or delete on likes
  for each row execute function sync_likes_count();

-- ---------- slug ----------
create or replace function pl_slugify(txt text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(txt,
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
      'acelnoszzACELNOSZZ')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------- akceptacja zgłoszenia: zgłoszenie -> boisko ----------
create or replace function approve_submission(sub_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s        submissions%rowtype;
  new_slug text;
  n        integer := 1;
  new_id   uuid;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator może akceptować zgłoszenia';
  end if;

  select * into s from submissions where id = sub_id;
  if not found then raise exception 'Nie ma takiego zgłoszenia'; end if;
  if s.court_id is not null then return s.court_id; end if;

  new_slug := pl_slugify(s.city) || '-' || pl_slugify(s.name);
  while exists (select 1 from courts where slug = new_slug) loop
    n := n + 1;
    new_slug := pl_slugify(s.city) || '-' || pl_slugify(s.name) || '-' || n;
  end loop;

  insert into courts (slug, name, city, voivodeship, lat, lng, type, surface, hoops,
                      lit, fenced, access, hours, description, basket_approved, basket_note, added_by, added_by_name)
  values (new_slug, s.name, s.city, s.voivodeship, s.lat, s.lng, s.type, s.surface, s.hoops,
          s.lit, s.fenced, s.access, s.hours,
          coalesce(nullif(s.notes, ''), 'Boisko dodane przez społeczność.'),
          s.basket_approved, coalesce(s.basket_note, ''), s.author_id, coalesce(s.author_name, 'gość'))
  returning id into new_id;

  insert into court_photos (court_id, kind, storage_path, sort)
  select new_id, kind, storage_path, sort from submission_photos where submission_id = sub_id;

  update submissions
     set status = 'approved', court_id = new_id,
         reviewed_at = now(), reviewed_by = auth.uid(), reject_reason = null
   where id = sub_id;

  return new_id;
end $$;

-- ---------- RLS ----------
alter table profiles          enable row level security;
alter table courts            enable row level security;
alter table court_photos      enable row level security;
alter table submissions       enable row level security;
alter table submission_photos enable row level security;
alter table likes             enable row level security;
alter table favorites         enable row level security;

-- profile: każdy widzi, każdy edytuje tylko swój (bez zmiany roli)
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (true);

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));

-- boiska: publiczny odczyt, zapis tylko administrator
drop policy if exists courts_select on courts;
create policy courts_select on courts for select using (true);

drop policy if exists courts_admin_all on courts;
create policy courts_admin_all on courts for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists court_photos_select on court_photos;
create policy court_photos_select on court_photos for select using (true);

drop policy if exists court_photos_admin_all on court_photos;
create policy court_photos_admin_all on court_photos for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- zgłoszenia: dodać może każdy (również gość), czytać autor i administrator
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert
  with check (author_id is null or author_id = auth.uid());

drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions for select
  using (is_admin(auth.uid()) or author_id = auth.uid());

drop policy if exists submissions_admin_write on submissions;
create policy submissions_admin_write on submissions for update
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists submissions_admin_delete on submissions;
create policy submissions_admin_delete on submissions for delete
  using (is_admin(auth.uid()));

drop policy if exists submission_photos_insert on submission_photos;
create policy submission_photos_insert on submission_photos for insert with check (true);

drop policy if exists submission_photos_select on submission_photos;
create policy submission_photos_select on submission_photos for select
  using (
    is_admin(auth.uid())
    or exists (select 1 from submissions s
                where s.id = submission_id and s.author_id = auth.uid())
  );

drop policy if exists submission_photos_admin_write on submission_photos;
create policy submission_photos_admin_write on submission_photos for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- lajki: licznik widoczny publicznie (kolumna w courts), wpisy tylko własne
drop policy if exists likes_select on likes;
create policy likes_select on likes for select using (user_id = auth.uid());

drop policy if exists likes_insert on likes;
create policy likes_insert on likes for insert with check (user_id = auth.uid());

drop policy if exists likes_delete on likes;
create policy likes_delete on likes for delete using (user_id = auth.uid());

drop policy if exists favorites_all on favorites;
create policy favorites_all on favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- uprawnienia dla Data API ----------
-- Nadajemy je jawnie, więc projekt może mieć wyłączone
-- „Automatically expose new tables”. Właściwą kontrolą dostępu jest RLS powyżej.
grant usage on schema public to anon, authenticated;

grant select on courts, court_photos to anon, authenticated;
grant insert, update, delete on courts, court_photos to authenticated;   -- RLS przepuści tylko admina

grant insert on submissions, submission_photos to anon, authenticated;
grant select, update, delete on submissions, submission_photos to authenticated;

grant select on profiles to anon, authenticated;
grant update on profiles to authenticated;

grant select, insert, delete on likes, favorites to authenticated;

grant execute on function approve_submission(uuid) to authenticated;
grant execute on function is_admin(uuid) to anon, authenticated;
grant execute on function pl_slugify(text) to anon, authenticated;

-- ---------- ranking odkrywców ----------
drop view if exists contributors;
create view contributors
with (security_invoker = true) as
  select
    coalesce(p.display_name, c.added_by_name) as name,
    c.added_by                                as user_id,
    count(*)                                  as courts,
    coalesce(sum(c.likes_count), 0)           as likes
  from courts c
  left join profiles p on p.id = c.added_by
  group by 1, 2
  order by courts desc, likes desc;

grant select on contributors to anon, authenticated;

-- ---------- zgłoszenia błędów w danych boiska ----------
do $$ begin
  create type report_reason as enum
    ('godziny', 'dane', 'nawierzchnia', 'zdjecia', 'nie-istnieje', 'inne');
exception when duplicate_object then null; end $$;

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  court_id    uuid not null references courts on delete cascade,
  reason      report_reason not null default 'inne',
  comment     text not null default '',
  reporter_id uuid references profiles(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index if not exists reports_court_idx on reports (court_id, status);
create index if not exists reports_created_idx on reports (created_at desc);

alter table reports enable row level security;

-- zgłosić może każdy, również gość bez konta
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert
  with check (reporter_id is null or reporter_id = auth.uid());

-- czyta administrator; zalogowany widzi dodatkowo własne zgłoszenia
drop policy if exists reports_select on reports;
create policy reports_select on reports for select
  using (is_admin(auth.uid()) or reporter_id = auth.uid());

drop policy if exists reports_admin_write on reports;
create policy reports_admin_write on reports for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

grant insert on reports to anon, authenticated;
grant select, update, delete on reports to authenticated;

alter table reports add column if not exists ip_hash text;
create index if not exists reports_limit_idx on reports (court_id, ip_hash, created_at desc);

create or replace function reports_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fwd   text := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  parts text[] := string_to_array(coalesce(fwd, ''), ',');
  -- ostatni wpis dokłada proxy Supabase, więc jest wiarygodniejszy niż pierwszy
  ip    text := nullif(btrim(coalesce(parts[array_length(parts, 1)], '')), '');
begin
  new.ip_hash := md5(coalesce(ip, 'nieznany') || '|podkosz-report-v1');

  if exists (
    select 1
      from reports r
     where r.court_id = new.court_id
       and r.created_at > now() - interval '24 hours'
       and (
             (new.reporter_id is not null and r.reporter_id = new.reporter_id)
          or (ip is not null and r.ip_hash = new.ip_hash)
           )
  ) then
    raise exception 'To boisko zostało już przez Ciebie zgłoszone w ciągu ostatniej doby.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists reports_rate_limit_trigger on reports;
create trigger reports_rate_limit_trigger
  before insert on reports
  for each row execute function reports_rate_limit();

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('court-photos', 'court-photos', true, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists court_photos_public_read on storage.objects;
create policy court_photos_public_read on storage.objects for select
  using (bucket_id = 'court-photos');

-- wgrywać można wyłącznie do katalogu zgłoszeń (również jako gość)
drop policy if exists court_photos_upload on storage.objects;
create policy court_photos_upload on storage.objects for insert
  with check (bucket_id = 'court-photos' and (storage.foldername(name))[1] = 'zgloszenia');

drop policy if exists court_photos_admin_manage on storage.objects;
create policy court_photos_admin_manage on storage.objects for all
  using (bucket_id = 'court-photos' and is_admin(auth.uid()))
  with check (bucket_id = 'court-photos' and is_admin(auth.uid()));

-- =====================================================================
--  PO PIERWSZYM ZALOGOWANIU: nadaj sobie rolę administratora
--    update profiles set role = 'admin' where id = 'TWOJE-UUID';
--  (UUID znajdziesz w Authentication → Users)
-- =====================================================================
