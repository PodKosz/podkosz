-- =====================================================================
--  Ranking boisk według ocen (23.10.2026) - zamiast liczby polubień.
--
--  Średnia ważona (ta sama, której używa IMDb):
--
--      wynik = (v · R + m · C) / (v + m)
--
--    v - liczba opinii boiska,   R - średnia ocena boiska,
--    C - średnia wszystkich opinii w serwisie,   m = 5 - „zapas zaufania”.
--
--  Każde boisko startuje tak, jakby miało pięć opinii na poziomie średniej serwisu,
--  a własne opinie przesuwają je ku jego prawdziwej ocenie. Trzy piątki dają ok. 4,4,
--  tysiąc opinii po 4,5 daje 4,5 - więcej głosów znaczy pewniejszy wynik.
--
--  Do rankingu wchodzi boisko z co najmniej 10 opiniami; poniżej `ranking_wynik` = null.
--  Liczy wyzwalacz opinii (`opinie_przelicz` z migration-opinie.sql) - przy każdej nowej,
--  zmienionej, ukrytej i usuniętej opinii. C zmienia się z każdą opinią, więc przeliczamy
--  wszystkie boiska z rankingu naraz; to kilkadziesiąt wierszy, nie cała tabela.
-- =====================================================================

alter table courts add column if not exists ranking_wynik numeric(5,3);
create index if not exists courts_ranking_idx on courts (ranking_wynik desc nulls last);

create or replace function ranking_przelicz()
returns void language plpgsql security definer set search_path = public as $$
declare
  c numeric;
begin
  /* nic do liczenia, dopóki żadne boisko nie ma 10 opinii - tak jest przy wsadzie danych */
  if not exists (select 1 from courts where opinie_liczba >= 10 or ranking_wynik is not null) then
    return;
  end if;

  select avg(ocena)::numeric into c from opinie where not ukryta;

  update courts k
     set ranking_wynik = case
           when k.opinie_liczba >= 10 and c is not null
           then round((k.opinie_liczba * k.opinie_srednia + 5 * c) / (k.opinie_liczba + 5), 3)
         end
   where k.opinie_liczba >= 10 or k.ranking_wynik is not null;
end $$;

revoke all on function ranking_przelicz() from public, anon, authenticated;

/* liczniki boiska jak dotąd + ranking na końcu */
create or replace function opinie_przelicz(boisko uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update courts c
     set opinie_liczba  = s.liczba,
         opinie_srednia = s.srednia
    from (
      select count(*)::integer as liczba, round(avg(ocena)::numeric, 2) as srednia
        from opinie
       where court_id = boisko and not ukryta
    ) s
   where c.id = boisko;

  perform ranking_przelicz();
end $$;

/* pierwsze przeliczenie dla opinii, które już są */
select ranking_przelicz();

select count(*) filter (where ranking_wynik is not null) as boiska_w_rankingu,
       count(*) filter (where opinie_liczba > 0) as boiska_z_opiniami
  from courts;
