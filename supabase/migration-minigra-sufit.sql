-- =====================================================================
--  Sufit wyniku w minigrach: 500 obcinało uczciwe wyniki.
--  Uruchom raz, po `migration-tarcza.sql`.
--
--  CO SIĘ STAŁO
--
--  Gracz zrobił w kozłach ponad tysiąc kozłowań w minucie, a tabela wyników pokazała
--  pięćset. Nic się nie zepsuło - tak było napisane. Sufit stał w trzech miejscach:
--  w przeglądarce (`MAKS_SERIA`), w warunku kolumny `seria` i w samej funkcji zapisu.
--  Wynik był po cichu przycinany na każdym z nich.
--
--  Założenie stało w komentarzu do gry w kozły: „nawet przy trzech kozłowaniach na
--  sekundę minuta daje 180". Na telefonie to nieprawda. W kozłach liczy się KAŻDE
--  kliknięcie, a ekran dotykowy przyjmuje dziesięć palców naraz - siedemnaście
--  kozłowań na sekundę jest w zasięgu dwóch rąk.
--
--  CO ZMIENIAMY
--
--  1. Warunek kolumny: 500 -> 5000. To ostatnia zapora przed liczbą z księżyca,
--     a nie miara umiejętności.
--  2. Przycięcie w funkcji zapisu: to samo.
--  3. PRÓG WIARYGODNOŚCI dla Chicago: 10 kozłowań na sekundę -> 40. To jest tu
--     najważniejsze. Bez tego podniesienie samego sufitu nic nie da: funkcja liczy
--     `maks` z czasu rundy i przy dziesięciu na sekundę odrzuciłaby tysiąc jako
--     „wynik niemożliwy w tym czasie". Próg zna czas rundy, więc broni lepiej niż
--     stała - i dlatego stała może być hojna.
--
--  Rzuty zostają na 1,2 na sekundę: tam jeden rzut to celowanie, 0,55 s lotu i powrót
--  piłki, więc liczba kliknięć nie ma jak wystrzelić.
-- =====================================================================

/* ---------- 1. warunek kolumny ---------- */

alter table public.minigra_wyniki
  drop constraint if exists minigra_wyniki_seria_check;

alter table public.minigra_wyniki
  add constraint minigra_wyniki_seria_check check (seria >= 0 and seria <= 5000);

/* ---------- 2 i 3. funkcja zapisu ---------- */

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
select conname, pg_get_constraintdef(oid) as warunek
  from pg_constraint
 where conrelid = 'public.minigra_wyniki'::regclass
   and conname = 'minigra_wyniki_seria_check';

select miejsce, count(*) as wynikow, max(seria) as najlepszy
  from public.minigra_wyniki
 group by miejsce
 order by miejsce;
