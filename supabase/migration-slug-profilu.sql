-- =====================================================================
--  Adres profilu bez czytania całej tabeli kont.
--  Uruchom raz. Bez niej strona profilu działa jak dotąd - patrz „zapas" niżej.
--
--  CO BYŁO NIE TAK
--
--  Adresy profili budujemy ze zeslugowanego nicku (`/gracz/basket`), a polskich znaków nie
--  da się odwrócić: z „basket" nie wynika, czy w bazie stoi „Basket" czy „Bąsket". Dlatego
--  `nickZeSlugu` ŚCIĄGAŁA WSZYSTKIE NICKI i szukała pasującego w JavaScripcie.
--
--  Komentarz w kodzie mówił wprost: „kont jest na tyle mało". To prawda dziś i przestanie
--  nią być dokładnie wtedy, gdy zacznie zależeć - przy tysiącu kont każde wejście na profil
--  to tysiąc wierszy, a wołane jest to dwa razy (raz dla metadanych strony, raz dla samej
--  strony).
--
--  CO ROBIMY
--
--  Slug staje się kolumną liczoną przez bazę i dostaje indeks. Wejście na profil to wtedy
--  jedno trafienie w indeks zamiast przeczytania tabeli.
--
--  KOLUMNA GENEROWANA, NIE WYZWALACZ
--
--  `generated always as ... stored` liczy się sama przy każdym zapisie i nie da się jej
--  ustawić z zewnątrz. Wyzwalacz robiłby to samo, ale zostawiałby otwarte pytanie „co,
--  jeśli ktoś wpisze tam swoją wartość" - a tu takiego pytania nie ma.
--
--  REGUŁA MUSI BYĆ CO DO ZNAKU TA SAMA, CO W `slugifyPlace`
--
--  Inaczej adres wygenerowany przez stronę nie znajdzie wiersza w bazie i profil odpowie
--  404 - czyli awaria widoczna tylko dla kont z polskimi znakami w nicku. Stąd ostatni
--  krok wygląda dziwnie: `^-` i `-$` zdejmują po JEDNYM myślniku z każdej strony, a nie
--  wszystkie, bo dokładnie tyle zdejmuje `.replace(/^-|-$/g, "")` w JavaScripcie.
--  „--Basket--" daje więc „-basket-" po obu stronach - brzydko, ale identycznie.
-- =====================================================================

create or replace function public.slug_nicku(nazwa text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               translate(lower(coalesce(nazwa, '')), 'ąćęłńóśźż', 'acelnoszz'),
               '[^a-z0-9]+', '-', 'g'
             ),
             '^-', ''
           ),
           '-$', ''
         );
$$;

alter table public.profiles
  add column if not exists slug text generated always as (slug_nicku(display_name)) stored;

create index if not exists profiles_slug_idx on public.profiles (slug);

-- ============================================================ kontrola
-- Reguła: te trzy muszą dać dokładnie to, co JavaScript.
select public.slug_nicku('Bąsket')      as ma_byc_basket,
       public.slug_nicku('Zielona Góra') as ma_byc_zielona_gora,
       public.slug_nicku('--Basket--')   as ma_byc_myslnik_basket_myslnik;

-- Nicki, które po zeslugowaniu zlewają się w jeden adres - jeśli coś tu wyjdzie, dwa konta
-- dzielą jeden adres profilu i strona pokaże pierwsze z brzegu.
select slug, count(*) as ile, array_agg(display_name) as nicki
  from public.profiles
 where slug <> ''
 group by slug
having count(*) > 1;
