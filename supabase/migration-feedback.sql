-- =====================================================================
--  Opinie „co możemy poprawić" + limit 1 na dobę z jednego IP.
--  Uruchom raz. Świeże projekty dostają to samo w schema.sql.
-- =====================================================================

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  message     text not null check (length(btrim(message)) between 3 and 2000),
  contact     text not null default '',
  author_id   uuid references profiles(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'done')),
  ip_hash     text,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);

create index if not exists feedback_created_idx on feedback (created_at desc);
create index if not exists feedback_limit_idx on feedback (ip_hash, created_at desc);

alter table feedback enable row level security;

-- napisać może każdy, również gość
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert
  with check (author_id is null or author_id = auth.uid());

-- czyta tylko administrator (albo autor swoje własne)
drop policy if exists feedback_select on feedback;
create policy feedback_select on feedback for select
  using (is_admin(auth.uid()) or author_id = auth.uid());

drop policy if exists feedback_admin_write on feedback;
create policy feedback_admin_write on feedback for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

grant insert on feedback to anon, authenticated;
grant select, update, delete on feedback to authenticated;

-- limit w bazie, więc nie da się go obejść wywołaniem API z pominięciem strony
create or replace function feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fwd   text := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  parts text[] := string_to_array(coalesce(fwd, ''), ',');
  ip    text := nullif(btrim(coalesce(parts[array_length(parts, 1)], '')), '');
begin
  new.ip_hash := md5(coalesce(ip, 'nieznany') || '|podkosz-feedback-v1');

  if exists (
    select 1
      from feedback f
     where f.created_at > now() - interval '24 hours'
       and (
             (new.author_id is not null and f.author_id = new.author_id)
          or (ip is not null and f.ip_hash = new.ip_hash)
           )
  ) then
    raise exception 'Opinię można wysłać raz na dobę. Dzięki za tę, którą już mamy!'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists feedback_rate_limit_trigger on feedback;
create trigger feedback_rate_limit_trigger
  before insert on feedback
  for each row execute function feedback_rate_limit();

-- Potwierdzenie dla wysyłki maila: serwer sprawdza, że opinia faktycznie wpadła do bazy,
-- więc nie da się zasypać skrzynki, uderzając w endpoint pocztowy z pominięciem strony.
create or replace function feedback_recent_exists(msg text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from feedback f
     where f.message = btrim(msg)
       and f.created_at > now() - interval '5 minutes'
  );
$$;

grant execute on function feedback_recent_exists(text) to anon, authenticated;

select 'gotowe: tabela feedback + limit 1/doba' as wynik;
