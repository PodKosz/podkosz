-- =====================================================================
--  Blokady adresów IP
--
--  Blokada konta (patrz migration-konto.sql) nie pomaga, gdy ktoś psuje serwis bez
--  logowania - zgłoszenia, opinie i raporty można wysyłać jako gość. Dlatego druga
--  warstwa: lista adresów IP, które nie wchodzą na stronę. Domyślnie na 30 dni, bo
--  blokady IP starzeją się same (adresy krążą między abonentami).
--
--  Middleware pyta o pojedynczy adres funkcją `czy_ip_zbanowane`, żeby lista blokad
--  nigdy nie wyszła na zewnątrz - IP to dane osobowe.
-- =====================================================================

create table if not exists ip_bans (
  ip           text primary key,
  reason       text,
  banned_until timestamptz not null,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists ip_bans_until_idx on ip_bans (banned_until);

alter table ip_bans enable row level security;
grant select, insert, update, delete on ip_bans to authenticated;

/* listę widzi i zmienia wyłącznie administrator */
drop policy if exists ip_bans_admin on ip_bans;
create policy ip_bans_admin on ip_bans for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

/*
  Sprawdzenie dla middleware: pyta o jeden adres i dostaje samo tak/nie. Wygasłe blokady
  przestają działać same, bez żadnego sprzątania.
*/
create or replace function czy_ip_zbanowane(p_ip text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from ip_bans
    where ip = p_ip and banned_until > now()
  );
$$;

revoke all on function czy_ip_zbanowane(text) from public;
grant execute on function czy_ip_zbanowane(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select count(*) as aktywnych_blokad from ip_bans where banned_until > now();
