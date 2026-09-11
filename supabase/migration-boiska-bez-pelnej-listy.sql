-- =====================================================================
--  Koniec z „pobierz wszystkie boiska i odfiltruj w JavaScripcie"
--
--  CO BYŁO NIE TAK
--
--  Jedna funkcja `listCourts()` ciągnęła CAŁĄ tabelę boisk razem ze wszystkimi zdjęciami,
--  a jej wynik obsługiwał ośmiu różnych odbiorców. Każdy z nich brał z tego ułamek:
--
--    - ranking boisk rysuje dwadzieścia pięć pierwszych, resztę wyrzuca,
--    - sitemapa potrzebuje pięciu kolumn i ani jednego zdjęcia,
--    - lista adresów do przebudowy potrzebuje samych slugów,
--    - strona miasta bierze boiska z jednego miasta, a dostawała wszystkie z Polski,
--    - profil gracza bierze boiska jednej osoby, a dostawał wszystkie,
--    - ranking odkrywców bierze po czternaście kadrów na osobę.
--
--  Zmierzone na produkcji: pełny wiersz ze zdjęciami waży 1554 bajty. Pamięć podręczna
--  Vercela odmawia zapisania wpisu większego niż 2 MB - i nie zgłasza tego, po prostu nie
--  zapisuje. Wychodzi ściana przy 1349 boiskach, po której każde wejście na każdą z tych
--  stron odpytuje bazę od zera. Strona działa dalej, więc nikt tego nie zauważy; widać to
--  dopiero na rachunku.
--
--  CZEGO BRAKOWAŁO W BAZIE
--
--  Filtrowanie po mieście, województwie i autorze odbywało się w JavaScripcie, bo adresy
--  budujemy ze zeslugowanej nazwy (`/miasto/zielona-gora`), a w bazie stoi nazwa
--  oryginalna. Z „zielona-gora" nie wynika, czy w kolumnie jest „Zielona Góra" - więc
--  jedynym sposobem było przeczytanie wszystkiego i porównanie w pamięci.
--
--  To ten sam problem, który przy profilach rozwiązała `migration-slug-profilu.sql`,
--  i rozwiązujemy go tak samo: slug staje się kolumną liczoną przez bazę, z indeksem.
--  Reguła jest ta sama funkcja `slug_nicku()`, więc nie ma dwóch definicji, które mogłyby
--  się rozjechać.
--
--  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
-- =====================================================================

-- ---------------------------------------------------------------- slugi jako kolumny
--
--  `generated always as ... stored` liczy się samo przy każdym zapisie i nie da się tego
--  ustawić z zewnątrz. Wymaga funkcji `immutable` - `slug_nicku()` taka jest.

alter table public.courts
  add column if not exists city_slug text generated always as (public.slug_nicku(city)) stored;

alter table public.courts
  add column if not exists voivodeship_slug text
  generated always as (public.slug_nicku(voivodeship)) stored;

alter table public.courts
  add column if not exists added_by_slug text
  generated always as (public.slug_nicku(added_by_name)) stored;

create index if not exists courts_city_slug_idx on public.courts (city_slug);
create index if not exists courts_voivodeship_slug_idx on public.courts (voivodeship_slug);
create index if not exists courts_added_by_slug_idx on public.courts (added_by_slug);

/*
  Ranking bierze dwadzieścia pięć najczęściej podpalanych boisk. Bez tego indeksu każde
  wejście na ranking sortowałoby całą tabelę, żeby wziąć z niej czubek.
*/
create index if not exists courts_likes_idx on public.courts (likes_count desc);

-- ---------------------------------------------------------------- miejscowości i województwa
/*
  Lista miast i województw z licznikami. Wcześniej powstawała w JavaScripcie z pełnej listy
  boisk - czyli żeby pokazać „Bydgoszcz: 12 boisk" trzeba było pobrać te dwanaście boisk
  razem ze zdjęciami, i tak samo wszystkie pozostałe w Polsce.

  `min(city)` zamiast „pierwsze z brzegu": gdy dwie pisownie dają ten sam slug („Zielona
  Góra" i „Zielona Gora"), wybór musi być zawsze taki sam, niezależnie od kolejności
  wierszy. Inaczej nazwa miasta migotałaby między odświeżeniami pamięci podręcznej.
*/
create or replace function public.miejsca_boisk()
returns table (rodzaj text, nazwa text, slug text, wojewodztwo text, ile bigint)
language sql stable set search_path = public as $$
  select 'miasto'::text, min(c.city), c.city_slug, min(c.voivodeship), count(*)
    from courts c
   where c.city_slug <> ''
   group by c.city_slug
  union all
  select 'wojewodztwo'::text, min(c.voivodeship), c.voivodeship_slug, min(c.voivodeship), count(*)
    from courts c
   where c.voivodeship_slug <> ''
   group by c.voivodeship_slug;
$$;

grant execute on function public.miejsca_boisk() to anon, authenticated;

-- ---------------------------------------------------------------- kadry do konstelacji
/*
  Ranking odkrywców rysuje przy każdej osobie do czternastu jej najczęściej podpalanych
  boisk. Wcześniej brało się to z pełnej listy: przy dwudziestu pięciu osobach, z których
  każda dodała po kilkaset boisk, oznaczało to pobranie kilku tysięcy wierszy ze zdjęciami
  po to, żeby zostawić po czternaście.

  Zwracamy SAME IDENTYFIKATORY, nie całe boiska. Wybór zdjęcia tytułowego ma swoją logikę
  w JavaScripcie (`orderPhotos` - kolejność rodzajów ujęć) i nie ma powodu przepisywać jej
  do SQL-a w dwóch miejscach. Strona dobiera potem te kilkaset boisk jednym zapytaniem
  po identyfikatorach.

  Sufit `least(in_ile, 50)` jest po to, żeby ta funkcja nie dała się zamienić w „pobierz
  wszystko" przez podanie dużej liczby.
*/
create or replace function public.kadry_odkrywcow(in_nazwiska text[], in_ile int default 14)
returns table (autor text, court_id uuid)
language sql stable set search_path = public as $$
  select k.added_by_name, k.id
    from (
      select c.added_by_name,
             c.id,
             row_number() over (
               partition by c.added_by_name
               order by c.likes_count desc, c.id
             ) as nr
        from courts c
       where c.added_by_name = any(in_nazwiska)
    ) k
   where k.nr <= greatest(1, least(in_ile, 50));
$$;

grant execute on function public.kadry_odkrywcow(text[], int) to anon, authenticated;

-- ============================================================ kontrola

-- 1. Slug z bazy musi być co do znaku tym samym, co `slugifyPlace` w JavaScripcie.
--    Te trzy mają wyjść: zielona-gora, kujawsko-pomorskie, basket
select public.slug_nicku('Zielona Góra')       as ma_byc_zielona_gora,
       public.slug_nicku('kujawsko-pomorskie') as ma_byc_kujawsko_pomorskie,
       public.slug_nicku('Basket')             as ma_byc_basket;

-- 2. Czy któryś slug miasta zlewa dwie różne pisownie - wtedy obie trafią na jedną stronę.
select city_slug, count(distinct city) as pisowni, array_agg(distinct city) as nazwy
  from public.courts
 where city_slug <> ''
 group by city_slug
having count(distinct city) > 1;

-- 3. Ile miejsc i ile boisk - lista miast musi zgadzać się z liczbą boisk.
select (select count(*) from public.miejsca_boisk() where rodzaj = 'miasto')      as miast,
       (select count(*) from public.miejsca_boisk() where rodzaj = 'wojewodztwo') as wojewodztw,
       (select sum(ile) from public.miejsca_boisk() where rodzaj = 'miasto')      as boisk_w_miastach,
       (select count(*) from public.courts)                                       as boisk_wszystkich;
