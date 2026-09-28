-- =====================================================================
--  Siatka na koszach: łańcuch, siatka albo brak
--
--  Dla wielu graczy to pierwsze pytanie o boisko - rzut w obręcz bez siatki nie daje
--  żadnego odgłosu ani widoku, a łańcuch dzwoni. Zgłaszający wybiera to w kreatorze,
--  karta boiska pokazuje w kafelku „Siatka".
--
--  Kolumna jest NULL dla boisk sprzed tej migracji: tam nikt jeszcze tego nie podał,
--  a zgadywanie byłoby gorsze niż kreska na karcie.
--
--  Przeniesienie ze zgłoszenia na boisko robi WYZWALACZ, a nie przepisana funkcja
--  `approve_submission()`. Ta funkcja była już kilka razy odtwarzana w migracjach i nie
--  chcemy nadpisywać jej wersji na produkcji starszą kopią tylko po to, żeby dodać jedno
--  pole. Wyzwalacz działa przy każdej akceptacji niezależnie od tego, jak ją napisano.
-- =====================================================================

alter table courts      add column if not exists siatka text;
alter table submissions add column if not exists siatka text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'courts_siatka_chk') then
    alter table courts add constraint courts_siatka_chk
      check (siatka is null or siatka in ('lancuch', 'siatka', 'brak'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'submissions_siatka_chk') then
    alter table submissions add constraint submissions_siatka_chk
      check (siatka is null or siatka in ('lancuch', 'siatka', 'brak'));
  end if;
end $$;

/* po akceptacji zgłoszenia siatka przechodzi na nowo utworzone boisko */
create or replace function submissions_siatka_na_boisko()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.court_id is not null
     and new.siatka is not null
     and (old.court_id is distinct from new.court_id or old.siatka is distinct from new.siatka)
  then
    update courts set siatka = new.siatka where id = new.court_id and siatka is null;
  end if;
  return new;
end $$;

drop trigger if exists submissions_siatka_na_boisko_trg on submissions;
create trigger submissions_siatka_na_boisko_trg
  after update of court_id, siatka on submissions
  for each row execute function submissions_siatka_na_boisko();

-- ============================================================ kontrola
select
  (select count(*) from information_schema.columns where table_name = 'courts' and column_name = 'siatka') as kolumna_courts,
  (select count(*) from information_schema.columns where table_name = 'submissions' and column_name = 'siatka') as kolumna_submissions,
  (select count(*) from pg_trigger where tgname = 'submissions_siatka_na_boisko_trg') as wyzwalacz;
