-- =====================================================================
--  Kto jest na stronie w tej chwili
--
--  Licznik wizyt (`visit_days`) tego nie powie: trzyma sumy dzienne bez godziny, więc
--  z jego danych nie da się odróżnić kogoś, kto jest tu teraz, od kogoś, kto był rano.
--  Potrzebny jest puls - przeglądarka odzywa się co kilkadziesiąt sekund, a my pamiętamy
--  tylko moment ostatniego odezwania.
--
--  W bazie nadal nie ma ani jednego czytelnego adresu IP: zapisujemy md5 z tą samą solą,
--  co przy wizytach. Tabela ma jeden wiersz na odwiedzającego, nie jeden na puls, więc
--  nie rośnie w nieskończoność - a stare wiersze i tak znikają przy odczycie licznika.
-- =====================================================================

create table if not exists public.obecnosc (
  ip_hash  text primary key,
  ostatnio timestamptz not null default now()
);

create index if not exists obecnosc_ostatnio_idx on public.obecnosc (ostatnio desc);

alter table public.obecnosc enable row level security;
/* nikt nie sięga do tabeli wprost - ani do zapisu, ani do odczytu */

/* ---------- puls ---------- */
/*
  Wołane z serwera, więc adres podajemy jawnie: baza widziałaby adres naszej funkcji,
  a nie odwiedzającego.
*/
create or replace function public.puls_obecnosci(in_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ip text := nullif(btrim(coalesce(in_ip, '')), '');
begin
  if ip is null then
    return;
  end if;

  insert into obecnosc (ip_hash, ostatnio)
  values (md5(ip || '|podkosz-visits-v1'), now())
  on conflict (ip_hash) do update set ostatnio = now();
end;
$$;

grant execute on function public.puls_obecnosci(text) to anon, authenticated;

/* ---------- licznik ---------- */
/*
  Tylko dla administratora. Przy okazji sprząta wiersze starsze niż doba - odczyt zdarza
  się rzadko i tylko w panelu, więc to najtańsze miejsce na sprzątanie.

  Za „obecnego" uznajemy kogoś, kto odezwał się w ciągu ostatnich dwóch minut. Puls idzie
  co czterdzieści pięć sekund, więc dwie minuty wybaczają jedno zgubione uderzenie
  i chwilowo uśpioną kartę.
*/
create or replace function public.ilu_online()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ilu integer;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  delete from obecnosc where ostatnio < now() - interval '1 day';

  select count(*)::integer into ilu
    from obecnosc
   where ostatnio > now() - interval '2 minutes';

  return ilu;
end;
$$;

revoke all on function public.ilu_online() from public;
grant execute on function public.ilu_online() to authenticated;

/* ---------- kontrola ---------- */
select count(*) as sledzonych from public.obecnosc;
