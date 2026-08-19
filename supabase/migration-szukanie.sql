-- =====================================================================
--  Szukanie boisk po stronie bazy
--
--  Dziś filtrowanie idzie w przeglądarce po wczytanej tablicy - przy kilkunastu
--  wpisach to najszybsze rozwiązanie. Po imporcie z OpenStreetMap wpisów będzie
--  tysiące i wyszukiwanie musi wykonać baza, z indeksem, a nie telefon użytkownika.
--
--  Ignorowanie polskich znaków robimy tak samo jak w aplikacji (funkcja `normalize`
--  w lib/filters.ts): „zabrze" znajduje „Zabrze", a „gdansk" - „Gdańsk".
-- =====================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

/* Indeks trigramowy po nazwie i miejscowości bez znaków diakrytycznych.
   unaccent nie jest immutable, więc do indeksu potrzebna jest własna owijka. */
create or replace function bez_ogonkow(t text)
returns text language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(unaccent(coalesce(t, '')));
$$;

create index if not exists courts_szukanie_idx
  on courts using gin ((bez_ogonkow(name) || ' ' || bez_ogonkow(city)) gin_trgm_ops);

/**
 * Szukanie boisk: dopasowanie po nazwie i miejscowości, bez znaków diakrytycznych.
 * Zwraca identyfikatory w kolejności trafności - pełne wiersze dociąga aplikacja.
 */
create or replace function courts_search(in_q text, in_limit integer default 50)
returns table (id uuid, trafnosc real)
language sql stable parallel safe set search_path = public as $$
  with pytanie as (select bez_ogonkow(btrim(in_q)) as q)
  select
    c.id,
    greatest(
      similarity(bez_ogonkow(c.name), p.q),
      similarity(bez_ogonkow(c.city), p.q)
    ) as trafnosc
  from courts c, pytanie p
  where length(p.q) >= 2
    and (
      bez_ogonkow(c.name) like '%' || p.q || '%'
      or bez_ogonkow(c.city) like '%' || p.q || '%'
      or bez_ogonkow(c.voivodeship) like '%' || p.q || '%'
    )
  order by trafnosc desc, c.likes_count desc
  limit greatest(in_limit, 1);
$$;

grant execute on function courts_search(text, integer) to anon, authenticated;
grant execute on function bez_ogonkow(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select count(*) as trafienia_na_krakow from courts_search('krakow', 50);
