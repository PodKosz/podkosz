-- =====================================================================
--  Zgłoszenia błędów w danych boiska (złe godziny, nieaktualne info itd.)
--  Uruchom raz. Świeże projekty dostają to samo w schema.sql.
-- =====================================================================

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

select 'gotowe: tabela reports' as wynik;
