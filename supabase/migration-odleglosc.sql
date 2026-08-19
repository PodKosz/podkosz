-- =====================================================================
--  Odległości między boiskami
--
--  Do tej pory „boiska w pobliżu" znaczyło „to samo województwo", a całą bazę
--  trzeba było wciągnąć do pamięci, żeby wybrać trzy wpisy. Ta migracja daje
--  liczenie odległości po stronie bazy - obsługuje trzy rzeczy naraz:
--    1. sekcję „w pobliżu" na karcie boiska,
--    2. wykrywanie duplikatów przy zgłaszaniu nowego boiska,
--    3. przyszłe sortowanie listy po odległości od użytkownika.
--
--  Nie używamy PostGIS: przy zasięgu jednego kraju wzór haversine na wbudowanych
--  funkcjach trygonometrycznych jest dokładny do metrów i nie wymaga rozszerzenia.
-- =====================================================================

/* ---------- indeks pod wstępne odsianie po prostokącie ---------- */
-- Filtr po zakresie lat/lng odsiewa 99% wierszy zanim policzymy cokolwiek.
create index if not exists courts_lat_lng_idx on courts (lat, lng);

/* ---------- odległość w metrach ---------- */
create or replace function distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 6371000 * 2 * asin(
    sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      pow(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

grant execute on function distance_m(double precision, double precision, double precision, double precision)
  to anon, authenticated;

/* ---------- najbliższe boiska (identyfikatory + odległość) ---------- */
-- Zwracamy tylko id i odległość; pełne wiersze ze zdjęciami dociąga aplikacja
-- swoim zwykłym zapytaniem, żeby nie duplikować kształtu danych w dwóch miejscach.
create or replace function courts_nearby(
  in_lat double precision,
  in_lng double precision,
  in_limit integer default 3,
  in_skip uuid default null,
  in_radius_m double precision default 150000
) returns table (id uuid, distance_m double precision)
language sql stable parallel safe set search_path = public as $$
  with okno as (
    -- 1 stopień szerokości to ~111 km; szerokość okna w długości rośnie z szerokością
    select
      in_radius_m / 111320.0 as d_lat,
      in_radius_m / (111320.0 * greatest(cos(radians(in_lat)), 0.01)) as d_lng
  )
  select c.id, distance_m(in_lat, in_lng, c.lat, c.lng) as distance_m
    from courts c, okno o
   where (in_skip is null or c.id <> in_skip)
     and c.lat between in_lat - o.d_lat and in_lat + o.d_lat
     and c.lng between in_lng - o.d_lng and in_lng + o.d_lng
     and distance_m(in_lat, in_lng, c.lat, c.lng) <= in_radius_m
   order by distance_m
   limit greatest(in_limit, 1);
$$;

grant execute on function courts_nearby(double precision, double precision, integer, uuid, double precision)
  to anon, authenticated;

/* ---------- boiska w promieniu: wykrywanie duplikatów ---------- */
-- Wywoływane z publicznego kreatora zgłoszeń, więc oddaje tylko to, co i tak jest
-- widoczne publicznie: nazwę, miejscowość i adres karty boiska.
create or replace function courts_in_radius(
  in_lat double precision,
  in_lng double precision,
  in_radius_m double precision default 120
) returns table (
  id uuid,
  slug text,
  name text,
  city text,
  distance_m double precision
)
language sql stable parallel safe set search_path = public as $$
  with okno as (
    select
      in_radius_m / 111320.0 as d_lat,
      in_radius_m / (111320.0 * greatest(cos(radians(in_lat)), 0.01)) as d_lng
  )
  select c.id, c.slug, c.name, c.city, distance_m(in_lat, in_lng, c.lat, c.lng) as distance_m
    from courts c, okno o
   where c.lat between in_lat - o.d_lat and in_lat + o.d_lat
     and c.lng between in_lng - o.d_lng and in_lng + o.d_lng
     and distance_m(in_lat, in_lng, c.lat, c.lng) <= in_radius_m
   order by distance_m
   limit 5;
$$;

grant execute on function courts_in_radius(double precision, double precision, double precision)
  to anon, authenticated;

/* ---------- kontrola ---------- */
-- Odległość Kraków - Katowice to około 67 km; wynik poniżej powinien to potwierdzić.
select round(distance_m(50.0647, 19.9450, 50.2649, 19.0238)::numeric / 1000, 1) as km_krakow_katowice;
