-- Trzy rzeczy naraz:
-- 1) limonkowa plakietka „dziwne boisko” i link do YouTube Shorts na karcie boiska,
-- 2) licznik unikalnych adresów IP (przechowujemy wyłącznie skrót, nigdy surowego IP),
-- 3) funkcja admin_overview() z kompletem statystyk do panelu.

/* ---------- 1. nowe kolumny boiska ---------- */

alter table courts add column if not exists funny boolean not null default false;
alter table courts add column if not exists shorts_url text not null default '';

/* ---------- 2. odwiedziny liczone po skrócie IP ---------- */

create table if not exists visit_days (
  ip_hash text not null,
  day     date not null default current_date,
  hits    int  not null default 1,
  primary key (ip_hash, day)
);

alter table visit_days enable row level security;

drop policy if exists visit_days_admin_read on visit_days;
create policy visit_days_admin_read on visit_days for select using (is_admin(auth.uid()));

grant select on visit_days to authenticated;

-- Zapis idzie wyłącznie tą funkcją: sama wyciąga adres z nagłówka i zapisuje md5 z solą,
-- więc w bazie nie ma ani jednego czytelnego IP.
create or replace function log_visit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fwd text := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  ip  text := nullif(btrim(split_part(coalesce(fwd, ''), ',', 1)), '');
begin
  if ip is null then
    return;
  end if;

  insert into visit_days (ip_hash, day, hits)
  values (md5(ip || '|podkosz-visits-v1'), current_date, 1)
  on conflict (ip_hash, day) do update set hits = visit_days.hits + 1;
end;
$$;

grant execute on function log_visit() to anon, authenticated;

/* ---------- 3. statystyki panelu ---------- */

create or replace function admin_overview()
returns json
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  res json;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Statystyki są tylko dla administratora' using errcode = 'check_violation';
  end if;

  select json_build_object(
    'courts',              (select count(*) from courts),
    'courts_approved',     (select count(*) from courts where basket_approved),
    'courts_funny',        (select count(*) from courts where funny),
    'courts_shorts',       (select count(*) from courts where shorts_url <> ''),
    'photos',              (select count(*) from court_photos),
    'likes',               (select coalesce(sum(likes_count), 0) from courts),
    'favorites',           (select count(*) from favorites),
    'users',               (select count(*) from profiles),
    'users_recent',        (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'submissions_pending', (select count(*) from submissions where status = 'pending'),
    'submissions_total',   (select count(*) from submissions),
    'reports_open',        (select count(*) from reports where status = 'open'),
    'feedback_open',       (select count(*) from feedback where status = 'open'),
    'leads_new',           (select count(*) from court_leads where status = 'new'),
    'leads_added',         (select count(*) from court_leads where status = 'added'),
    'unique_ips',          (select count(distinct ip_hash) from visit_days),
    'unique_ips_30d',      (select count(distinct ip_hash) from visit_days where day > current_date - 30),
    'visits_today',        (select coalesce(sum(hits), 0) from visit_days where day = current_date),
    'storage_bytes',       (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects where bucket_id = 'court-photos'),
    'storage_files',       (select count(*) from storage.objects where bucket_id = 'court-photos'),
    'db_bytes',            pg_database_size(current_database())
  ) into res;

  return res;
end;
$$;

grant execute on function admin_overview() to authenticated;

-- kontrola
select admin_overview() is not null as dziala;
