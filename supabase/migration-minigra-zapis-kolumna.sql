-- =====================================================================
--  Naprawa zapisu wyniku minigry: kolumna nazywa się `updated_at`
--
--  OBJAW
--
--  Pierwszy wynik na danym boisku zapisywał się poprawnie. Każdy następny - nigdy.
--  Rekord stał w miejscu, ranking się nie zmieniał, a gra nie pokazywała żadnego błędu,
--  bo `zapiszWynik` z założenia nigdy nie zatrzymuje rozgrywki z powodu zapisu.
--
--  PRZYCZYNA
--
--  Tabela `minigra_wyniki` ma od początku kolumnę `updated_at` (patrz `migration-minigra.sql`).
--  Dwie późniejsze migracje - `migration-minigra-tempo.sql` i `migration-minigra-sufit.sql` -
--  przepisały funkcję `minigra_zapisz` i obie użyły nazwy `zapisany_at`, której nie ma.
--
--  Postgres nie mógł tego złapać przy tworzeniu funkcji: w `plpgsql` nazwy kolumn
--  rozwiązują się dopiero przy wykonaniu. Funkcja powstawała bez słowa protestu i psuła
--  się dopiero w locie.
--
--  DLACZEGO PIERWSZY ZAPIS DZIAŁAŁ
--
--  Feralna nazwa stoi w gałęzi `on conflict ... do update`, a ta wykonuje się wyłącznie
--  wtedy, gdy wiersz dla tej pary (boisko, gracz) już istnieje. Pierwszy wynik to czysty
--  `insert` - przechodził. Drugi i każdy kolejny wywracał się na nieistniejącej kolumnie.
--
--  Skutek uboczny widać było w bazie: wyjątek wycofywał całą transakcję, więc `delete`
--  zdejmujący rundę też się cofał. Stąd rundy, które nigdy nie gasły.
--
--  DRUGA, CICHSZA WADA - PRZYWRACAMY ORYGINALNE ZACHOWANIE
--
--  Oryginał przesuwał znacznik czasu TYLKO wtedy, gdy wynik faktycznie się poprawił:
--
--      updated_at = case when excluded.seria > minigra_wyniki.seria
--                        then now() else minigra_wyniki.updated_at end
--
--  To nie jest drobiazg, bo `minigra_ranking` sortuje po `seria desc, updated_at`, czyli
--  przy równym wyniku wyżej stoi ten, kto był pierwszy. Wersje przepisane ustawiały czas
--  bezwarunkowo - po naprawieniu samej nazwy każde powtórzenie tego samego wyniku
--  zrzucałoby gracza na koniec remisu. Wracamy więc do warunku, a nie tylko do właściwej
--  kolumny.
--
--  Reszta funkcji zostaje bez zmian: limit tempa, sufit 5000, wygasanie rundy po dwóch
--  godzinach i osobne tempo dla kozłowania (40/s) kontra rzutów (1,2/s).
--
--  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
-- =====================================================================

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
        /*
          Czas rusza tylko przy POPRAWIE wyniku. Ranking sortuje po `seria desc, updated_at`,
          więc przy remisie wyżej stoi ten, kto stanął tam pierwszy - i tak ma zostać,
          nawet gdy ktoś powtórzy swój wynik dziesięć razy.
        */
        updated_at = case
          when excluded.seria > minigra_wyniki.seria then now()
          else minigra_wyniki.updated_at
        end
  returning seria into wynik;

  return wynik;
end;
$$;

grant execute on function public.minigra_zapisz(text, integer) to anon, authenticated;

/*
  Sprzątanie po usterce: rundy, które nie zgasły, bo wyjątek wycofywał `delete`.
  Zostawione nie szkodzą (wygasają po dwóch godzinach), ale nie ma powodu ich trzymać.
*/
delete from public.minigra_rundy where now() - zaczeta > interval '2 hours';

-- ============================================================ kontrola

-- 1. W funkcji nie ma już nieistniejącej nazwy, jest właściwa.
select position('zapisany_at' in prosrc) = 0 as juz_bez_zapisany_at,
       position('updated_at'  in prosrc) > 0 as ma_updated_at,
       position('przepustka_wspolna' in prosrc) > 0 as ma_limit_tempa,
       position('5000' in prosrc) > 0 as ma_sufit
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'minigra_zapisz';

-- 2. Stan tablic po naprawie.
select miejsce, count(*) as wynikow, max(seria) as najlepszy, max(updated_at) as ostatni
  from public.minigra_wyniki
 group by miejsce
 order by miejsce;
