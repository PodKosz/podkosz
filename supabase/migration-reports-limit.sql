-- =====================================================================
--  Limit zgłoszeń błędów: jedno na boisko z jednego adresu IP na dobę.
--
--  Kontrola siedzi w wyzwalaczu bazy, a nie w przeglądarce — obejście przez
--  bezpośrednie wywołanie REST API nic nie da. IP nie jest zapisywane:
--  trzymamy wyłącznie jego skrót z solą, wystarczający do rozpoznania powtórki.
-- =====================================================================

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

select 'gotowe: limit 1 zgłoszenie / boisko / doba' as wynik;
