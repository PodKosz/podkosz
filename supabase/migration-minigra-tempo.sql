-- =====================================================================
--  Tempo w minigrze: ile rund na minutę wolno otworzyć i zapisać.
--  Uruchom PO `migration-limit-wspolny.sql` (używa `przepustka_wspolna`)
--  i po `migration-minigra-sufit.sql` (na której definicji zapisu bazuje).
--
--  CO TU BYŁO OTWARTE
--
--  `minigra_start` i `minigra_zapisz` są nadane roli `authenticated` i wołane wprost
--  z przeglądarki - a klucz `anon` jest publiczny, więc równie dobrze wołane z konsoli,
--  w pętli. Sufit wyniku i próg wiarygodności pilnują, ŻEBY WYNIK BYŁ MOŻLIWY, ale nic
--  nie pilnowało, ILE RAZY można spytać.
--
--  W rzutach do kosza runda kończy się przy każdym pudle, więc nawet zwykła gra generuje
--  trzy zapytania co kilka sekund (otwarcie, zapis, ranking). Stu grających to już
--  kilkadziesiąt zapytań na sekundę - a jedna pętla w konsoli robi tyle sama.
--
--  CO ROBIMY
--
--  Wspólny licznik z `przepustka_wspolna`, kluczowany identyfikatorem konta (nie adresem
--  IP - tu każdy jest zalogowany, a konto jest trudniejsze do zmiany niż adres). Jeden
--  kubełek na obie funkcje, bo jedna runda to zawsze para: otwarcie i zapis.
--
--  SZEŚĆDZIESIĄT NA MINUTĘ, czyli trzydzieści rund - jedna na dwie sekundy, bez przerwy,
--  przez całą minutę. Najszybsza możliwa gra w rzuty to pudło po jakichś trzech sekundach,
--  więc człowiek tego nie dotknie nawet grając na oślep. Pętla dotknie przy pierwszym
--  obrocie.
--
--  Odmowa jest twarda (wyjątek), a nie ciche pominięcie: gra po stronie przeglądarki i tak
--  nie zatrzymuje się z powodu nieudanego zapisu (patrz `lib/gra/wynik.ts`), więc grający
--  niczego nie traci poza wynikiem, którego i tak nie zdążył zdobyć.
--
--  CZEGO TO NIE ROBI
--
--  Nie broni przed stoma kontami. Broni przed jednym kontem w pętli - a to jest ta różnica,
--  którą widać w rachunku za bazę.
-- =====================================================================

/* ---------- 1. otwarcie rundy ---------- */

create or replace function public.minigra_start(p_miejsce text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if p_miejsce is null or p_miejsce not in ('venice', 'manhattan', 'chicago') then
    raise exception 'Nieznane miejsce.';
  end if;

  if przepustka_wspolna('minigra', uid::text, 60, 60) > 0 then
    raise exception 'Za dużo rund w krótkim czasie. Odczekaj chwilę.'
      using errcode = 'check_violation';
  end if;

  insert into minigra_rundy (user_id, miejsce, zaczeta)
  values (uid, p_miejsce, now())
  on conflict (user_id, miejsce) do update set zaczeta = now();
end;
$$;

revoke all on function public.minigra_start(text) from public;
grant execute on function public.minigra_start(text) to authenticated;

/* ---------- 2. zapis wyniku ---------- */
/*
  Cała reszta tej funkcji jest bez zmian względem `migration-minigra-sufit.sql` - dochodzi
  wyłącznie sprawdzenie tempa, zaraz po sprawdzeniu blokady konta. Powtarzamy ją w całości,
  bo `create or replace` nie umie inaczej; przy następnej zmianie warto porównać oba pliki.
*/
create or replace function public.minigra_zapisz(p_miejsce text, p_seria integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  wynik     integer;
  poczatek  timestamptz;
  sekundy   double precision;
  maks      integer;
begin
  if uid is null then
    return null;
  end if;

  if p_miejsce is null or p_miejsce not in ('venice', 'manhattan', 'chicago') then
    raise exception 'Nieznane miejsce.';
  end if;

  if zbanowany(uid) then
    raise exception 'Konto jest zablokowane.';
  end if;

  if przepustka_wspolna('minigra', uid::text, 60, 60) > 0 then
    raise exception 'Za dużo zapisów w krótkim czasie. Odczekaj chwilę.'
      using errcode = 'check_violation';
  end if;

  select zaczeta into poczatek
    from minigra_rundy
   where user_id = uid and miejsce = p_miejsce;

  if poczatek is null then
    raise exception 'Runda nie została rozpoczęta.' using errcode = 'check_violation';
  end if;

  sekundy := extract(epoch from now() - poczatek);
  if sekundy > 7200 then
    raise exception 'Runda wygasła.' using errcode = 'check_violation';
  end if;

  -- Ile najwyżej można zdobyć w danym czasie.
  --   - kozły: jedno kliknięcie to jedno kozłowanie, a ekran dotykowy przyjmuje
  --     dziesięć palców naraz. Czterdzieści na sekundę to sufit dwóch rąk bijących
  --     na oślep - zgłoszony, uczciwy wynik to około siedemnastu na sekundę.
  --   - rzuty: jeden rzut to celowanie plus 0,55 s lotu plus powrót piłki, więc
  --     nawet 1,2 na sekundę jest hojne.
  -- Plus stały zapas dziesięciu, żeby zaokrąglenia i opóźnienie sieci nikomu nie
  -- zabrały uczciwego wyniku.
  maks := 10 + ceil(sekundy * case p_miejsce when 'chicago' then 40 else 1.2 end);

  if p_seria > maks then
    raise exception 'Wynik niemożliwy w tym czasie (% w % s).', p_seria, round(sekundy)
      using errcode = 'check_violation';
  end if;

  -- runda gaśnie po użyciu - następny zapis potrzebuje nowej
  delete from minigra_rundy where user_id = uid and miejsce = p_miejsce;

  insert into minigra_wyniki (miejsce, user_id, seria)
  values (p_miejsce, uid, greatest(0, least(coalesce(p_seria, 0), 5000)))
  on conflict (miejsce, user_id) do update
    set seria = greatest(minigra_wyniki.seria, excluded.seria),
        zapisany_at = now()
  returning seria into wynik;

  return wynik;
end;
$$;

grant execute on function public.minigra_zapisz(text, integer) to anon, authenticated;

-- ============================================================ kontrola
select proname, pg_get_function_identity_arguments(oid) as argumenty
  from pg_proc
 where proname in ('minigra_start', 'minigra_zapisz')
 order by proname;
