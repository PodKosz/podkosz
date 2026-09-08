-- =====================================================================
--  Proporcje plakatu wydarzenia.
--  Uruchom raz, po `migration-wydarzenia.sql`.
--
--  Box wydarzenia na karcie boiska ma dwa układy i wybiera je PROPORCJA ZDJĘCIA:
--    - plakat w pionie (albo bliski kwadratu) - wysoka karta w prawej kolumnie,
--      obok kafelków z parametrami boiska,
--    - plakat w poziomie - szeroki pas nad kafelkami.
--
--  Dlaczego kolumna w bazie, a nie odczyt w przeglądarce: karta boiska jest budowana
--  NA SERWERZE i wysyłana jako gotowy HTML. Gdyby o układzie decydował wymiar obrazka
--  odczytany po jego wczytaniu, strona najpierw pokazywałaby zły układ, a potem
--  przeskakiwała na właściwy - i to przy każdym wejściu. Wymiary zna przeglądarka
--  administratora w chwili wgrywania pliku, więc zapisujemy je raz, tam.
--
--  Trzymamy jedną liczbę (szerokość / wysokość), nie dwie: nic w serwisie nie potrzebuje
--  pikseli, a proporcja jest tym, co decyduje o układzie.
-- =====================================================================

alter table public.wydarzenia
  add column if not exists zdjecie_proporcje double precision;

comment on column public.wydarzenia.zdjecie_proporcje is
  'szerokość / wysokość plakatu; < 0.95 to pion (wysoka karta), reszta to poziom (szeroki pas)';

/* ---------- uzupełnienie dla wydarzeń dodanych przed tą zmianą ----------
   Jedno wydarzenie w bazie ma już plakat (1080 x 1920), więc wpisujemy mu proporcję
   ręcznie. Wydarzenia bez plakatu zostają z wartością null - nie mają czego mierzyć,
   a box bez zdjęcia i tak ma tylko jeden układ.                                        */
update public.wydarzenia
   set zdjecie_proporcje = 1080.0 / 1920.0
 where zdjecie is not null
   and zdjecie_proporcje is null;

-- ============================================================ kontrola
select nazwa,
       zdjecie is not null as ma_plakat,
       round(zdjecie_proporcje::numeric, 3) as proporcje,
       case
         when zdjecie is null then 'brak plakatu'
         when zdjecie_proporcje is null then 'nieznane - box weźmie układ poziomy'
         when zdjecie_proporcje < 0.95 then 'pion - wysoka karta w prawej kolumnie'
         else 'poziom - szeroki pas'
       end as uklad
  from public.wydarzenia
 order by poczatek;
