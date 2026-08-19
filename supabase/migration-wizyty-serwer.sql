-- =====================================================================
--  Licznik wizyt liczony po stronie serwera
--
--  Do tej pory wizytę zgłaszała przeglądarka klientem Supabase, więc każdy
--  odwiedzający musiał pobrać bibliotekę Supabase (248 kB) tylko po to, żeby
--  odnotować wejście. Teraz robi to serwer (POST /api/wizyta) i musi podać
--  adres IP użytkownika jawnie - wołana z serwera baza widziałaby adres naszej
--  funkcji, a nie odwiedzającego.
--
--  W bazie nadal nie ma ani jednego czytelnego IP: zapisujemy md5 z tą samą
--  solą co dotąd, więc liczby są ciągłe względem wcześniejszych wpisów.
-- =====================================================================

create or replace function log_visit_ip(in_ip text)
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

  insert into visit_days (ip_hash, day, hits)
  values (md5(ip || '|podkosz-visits-v1'), current_date, 1)
  on conflict (ip_hash, day) do update set hits = visit_days.hits + 1;
end;
$$;

grant execute on function log_visit_ip(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select count(*) as dni_z_wizytami from visit_days;
