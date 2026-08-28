-- =====================================================================
--  Limit boisk w deklaracjach na jeden dzień
--
--  Deklaracja „idę dziś zagrać" ma mówić, gdzie ktoś FAKTYCZNIE będzie. Bez limitu
--  jedna osoba zaznaczała trzydzieści boisk naraz: mapa zapalała się w całym kraju,
--  a odznaczenia za bywanie na boiskach odblokowywały się w minutę, bez wyjścia z domu.
--
--  Stąd dwie zapory, obie na tym samym poziomie co reszta zasad - w bazie, nie w
--  przeglądarce, bo tabela `checkins` jest zapisywalna z klienta:
--    1. najwyżej DWA różne boiska dziennie (dogrywka na innym boisku to realny scenariusz,
--       objazd po trzydziestu - nie),
--    2. oba w tym samym województwie (nikt nie zagra tego samego dnia w Gdańsku i Krakowie).
--
--  Limit 12 godzin na jednym boisku zostaje bez zmian - rozszerzamy istniejący wyzwalacz,
--  żeby wszystkie zasady deklaracji siedziały w jednym miejscu.
-- =====================================================================

create or replace function checkins_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ile int;
  inne int;
  moje_woj text;
  obce int;
begin
  select count(*) into ile
    from checkins
   where court_id = new.court_id
     and user_id = new.user_id
     and day = new.day;

  if ile >= 12 then
    raise exception 'Najwyżej 12 godzin na jednym boisku w ciągu dnia'
      using errcode = 'check_violation';
  end if;

  /*
    Liczymy INNE boiska niż to wstawiane. Zakres godzin to wiele wierszy na to samo
    boisko, a zmiana godzin kasuje stare wiersze i wstawia nowe - bez tego warunku
    poprawienie własnej deklaracji potrafiłoby wpaść na własny limit.
  */
  select count(distinct ch.court_id) into inne
    from checkins ch
   where ch.user_id = new.user_id
     and ch.day = new.day
     and ch.court_id <> new.court_id;

  if inne >= 2 then
    raise exception 'Na jeden dzień można zapisać się najwyżej na dwa boiska'
      using errcode = 'check_violation';
  end if;

  if inne = 1 then
    select c.voivodeship into moje_woj from courts c where c.id = new.court_id;

    select count(*) into obce
      from checkins ch
      join courts c on c.id = ch.court_id
     where ch.user_id = new.user_id
       and ch.day = new.day
       and ch.court_id <> new.court_id
       and c.voivodeship is distinct from moje_woj;

    if obce > 0 then
      raise exception 'Drugie boisko na dziś musi być w tym samym województwie'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

/*
  To samo pytanie, tylko zadane ZANIM ktoś kliknie. Zapis godzin kasuje stare wiersze
  przed wstawieniem nowych, więc odbicie się od wyzwalacza w połowie tej operacji byłoby
  najgorszym momentem na komunikat. Panel pyta o powód blokady z góry i po prostu nie
  pokazuje wyboru godzin, jeśli i tak nic z tego nie będzie.

  Zwraca gotowe zdanie dla człowieka albo NULL, gdy droga wolna.
*/
create or replace function checkin_blokada(in_court uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  ja uuid := auth.uid();
  inne int;
  moje_woj text;
  obce int;
begin
  if ja is null then return null; end if;

  select count(distinct ch.court_id) into inne
    from checkins ch
   where ch.user_id = ja
     and ch.day = current_date
     and ch.court_id <> in_court;

  if inne >= 2 then
    return 'Masz już na dziś dwa boiska. Odwołaj jedno, żeby zapisać się tutaj.';
  end if;

  if inne = 1 then
    select c.voivodeship into moje_woj from courts c where c.id = in_court;

    select count(*) into obce
      from checkins ch
      join courts c on c.id = ch.court_id
     where ch.user_id = ja
       and ch.day = current_date
       and ch.court_id <> in_court
       and c.voivodeship is distinct from moje_woj;

    if obce > 0 then
      return 'Drugie boisko na dziś musi być w tym samym województwie co pierwsze.';
    end if;
  end if;

  return null;
end $$;

grant execute on function checkin_blokada(uuid) to authenticated;
