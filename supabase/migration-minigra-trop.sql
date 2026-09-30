-- =====================================================================
--  Minigra Trop - zgadywanie, gdzie stoi boisko (w stylu GeoGuessr).
--  Uruchom raz, po `migration-odleglosc.sql` (distance_m) i `migration-limit-wspolny.sql`.
--
--  Pinezka stoi w Las Vegas. Gra ma 5 rund, w każdej jedno losowe boisko z całej bazy
--  (każde boisko ze zdjęciem wchodzi do puli samo, w chwili publikacji).
--
--  PUNKTY LICZY BAZA, NIE PRZEGLĄDARKA. W innych minigrach przeglądarka zgłasza wynik,
--  a baza sprawdza jego wiarygodność. Tu wynik zależy od współrzędnych, a te nie mogą
--  trafić do gracza przed zgadnięciem - więc gracz dostaje tylko zdjęcie, wysyła swój
--  strzał i dopiero w odpowiedzi poznaje miejsce, odległość i punkty.
--
--    - BONUS ZA JEDNO ZDJĘCIE (+10%): kolejne zdjęcia rundy wydaje dopiero `trop_zdjecia`
--      i od tej chwili runda jest oznaczona jako odkryta. Nie da się obejrzeć wszystkich
--      i zgłosić, że widziało się jedno.
--    - 3 MINUTY NA RUNDĘ: start rundy stempluje baza (`runda_od`). Strzał po 3 min
--      + 10 s zapasu na sieć liczy się za 0.
--    - Rundy po kolei: odpowiedź przyjmowana tylko dla bieżącej rundy, raz.
--
--  PUNKTACJA (0-1000 na rundę, x1,1 z bonusem, max 5500 na grę):
--    - do 10 m od boiska: 1000,
--    - do promienia miasta: od 1000 do 500, logarytmicznie (każde podwojenie odległości
--      kosztuje tyle samo) - trafione miasto daje zawsze co najmniej 500,
--    - dalej: 500 i wykładniczy spadek (ok. 350 za 50 km, 150 za 150 km, 0 za ~600 km).
--    Promień miasta: 12 km dla dużych miast, 6 km dla reszty.
-- =====================================================================

create table if not exists public.trop_gry (
  id         uuid primary key default gen_random_uuid(),
  /* null = gość; gra się bez konta, ale wynik bez konta nie wchodzi do rankingu */
  user_id    uuid references auth.users(id) on delete cascade,
  boiska     uuid[] not null,
  runda      smallint not null default 1,
  /* 'gra' - runda trwa, 'wynik' - strzał oddany, czeka na następną, 'koniec' */
  stan       text not null default 'gra' check (stan in ('gra', 'wynik', 'koniec')),
  runda_od   timestamptz not null default now(),
  odkryte    boolean not null default false,
  punkty     integer[] not null default '{}',
  suma       integer not null default 0,
  zaczeta    timestamptz not null default now(),
  zakonczona timestamptz
);
alter table public.trop_gry enable row level security;
/* bez polityk - wszystko idzie przez funkcje niżej */
revoke all on public.trop_gry from anon, authenticated;

create table if not exists public.trop_wyniki (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  najlepszy  integer not null check (najlepszy between 0 and 5500),
  gier       integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.trop_wyniki enable row level security;
drop policy if exists trop_wyniki_wlasny on public.trop_wyniki;
create policy trop_wyniki_wlasny on public.trop_wyniki for select using (user_id = auth.uid());
revoke insert, update, delete on public.trop_wyniki from anon, authenticated;
grant select on public.trop_wyniki to authenticated;

/* ---------- pomocnicze ---------- */

/* kolejność zdjęć jak na stronie boiska (lib/photos.ts) - pierwsze jest kadrem tytułowym z narożnika */
create or replace function public.trop_kolejnosc(p_rodzaj text)
returns integer
language sql immutable as $$
  select coalesce(array_position(array['narożnik', 'kosz-a', 'kosz-b', 'detal-kosza', 'nawierzchnia',
    'ogólne-2', 'narożnik-2', 'ogólne-1', 'ogólne-3'], p_rodzaj), 99);
$$;

/* pierwsze zdjęcie rundy i ile ich jest - bez współrzędnych i bez nazwy boiska */
create or replace function public.trop_zdjecie_rundy(p_boisko uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'zdjecie', (select jsonb_build_object('sciezka', p.storage_path, 'rodzaj', p.kind)
                  from court_photos p where p.court_id = p_boisko
                 order by trop_kolejnosc(p.kind), p.sort, p.id limit 1),
    'ile_zdjec', (select count(*) from court_photos p where p.court_id = p_boisko)
  );
$$;
revoke all on function public.trop_zdjecie_rundy(uuid) from public, anon, authenticated;

create or replace function public.trop_punkty(p_odleglosc double precision, p_miasto text)
returns integer
language plpgsql immutable as $$
declare
  r double precision := case when p_miasto in ('Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk',
    'Szczecin', 'Bydgoszcz', 'Lublin', 'Białystok', 'Katowice', 'Gdynia') then 12000 else 6000 end;
  d double precision := greatest(coalesce(p_odleglosc, 1e9), 0);
begin
  if d <= 10 then return 1000; end if;
  if d <= r then return round(1000 - 500 * ln(d / 10) / ln(r / 10)); end if;
  return greatest(0, round(500 * exp(-(d - r) / 120000.0)));
end;
$$;
grant execute on function public.trop_punkty(double precision, text) to anon, authenticated;

/* gra należy do tego, kto pyta - gość do gościa (null), konto do konta */
create or replace function public.trop_moja(p_gra uuid)
returns public.trop_gry
language plpgsql security definer set search_path = public as $$
declare g trop_gry;
begin
  select * into g from trop_gry where id = p_gra for update;
  if g.id is null or g.user_id is distinct from auth.uid() then
    raise exception 'Nie ma takiej gry.';
  end if;
  return g;
end;
$$;
revoke all on function public.trop_moja(uuid) from public, anon, authenticated;

/* ---------- start gry ---------- */
create or replace function public.trop_start()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  kto text := coalesce(auth.uid()::text,
    split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
  czekaj integer;
  lista uuid[];
  g trop_gry;
begin
  /* limit: 40 gier na godzinę z jednego konta albo adresu; bez limitera w bazie gra i tak rusza */
  begin
    czekaj := przepustka_wspolna('trop', kto, 40, 3600);
  exception when undefined_function then
    czekaj := 0;
  end;
  if czekaj > 0 then
    raise exception 'Za dużo gier naraz - spróbuj za % min.', ceil(czekaj / 60.0);
  end if;

  /* sprzątanie przy okazji: gry sprzed dwóch dni nikomu nie są potrzebne */
  if random() < 0.02 then
    delete from trop_gry where zaczeta < now() - interval '2 days';
  end if;

  select array_agg(id) into lista from (
    select c.id from courts c
     where exists (select 1 from court_photos p where p.court_id = c.id)
     order by random() limit 5
  ) x;
  if coalesce(array_length(lista, 1), 0) = 0 then
    raise exception 'Na mapie nie ma jeszcze boisk ze zdjęciami.';
  end if;

  insert into trop_gry (user_id, boiska) values (auth.uid(), lista) returning * into g;
  return jsonb_build_object('gra', g.id, 'rund', array_length(lista, 1), 'runda', 1)
      || trop_zdjecie_rundy(lista[1]);
end;
$$;
grant execute on function public.trop_start() to anon, authenticated;

/* ---------- więcej zdjęć (koniec bonusu) ---------- */
create or replace function public.trop_zdjecia(p_gra uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare g trop_gry;
begin
  g := trop_moja(p_gra);
  if g.stan <> 'gra' then raise exception 'Runda już się skończyła.'; end if;
  update trop_gry set odkryte = true where id = g.id;
  return coalesce((select jsonb_agg(jsonb_build_object('sciezka', p.storage_path, 'rodzaj', p.kind)
                                    order by trop_kolejnosc(p.kind), p.sort, p.id)
                     from court_photos p where p.court_id = g.boiska[g.runda]), '[]'::jsonb);
end;
$$;
grant execute on function public.trop_zdjecia(uuid) to anon, authenticated;

/* ---------- strzał ---------- */
create or replace function public.trop_zgadnij(p_gra uuid, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g trop_gry;
  c courts;
  czas double precision;
  d double precision;
  baza integer := 0;
  wynik integer := 0;
  rund integer;
  koniec boolean;
  rekord integer;
  nowy boolean := false;
  pozycja integer;
begin
  g := trop_moja(p_gra);
  if g.stan <> 'gra' then raise exception 'Ta runda ma już odpowiedź.'; end if;

  select * into c from courts where id = g.boiska[g.runda];
  czas := extract(epoch from now() - g.runda_od);
  rund := array_length(g.boiska, 1);

  if p_lat is not null and p_lng is not null and c.id is not null then
    d := distance_m(p_lat, p_lng, c.lat, c.lng);
    if czas <= 190 then
      baza := trop_punkty(d, c.city);
      wynik := case when g.odkryte then baza else round(baza * 1.1) end;
    end if;
  end if;

  koniec := g.runda >= rund;
  update trop_gry
     set punkty = punkty || wynik,
         suma = suma + wynik,
         stan = case when koniec then 'koniec' else 'wynik' end,
         zakonczona = case when koniec then now() else null end
   where id = g.id
   returning * into g;

  if koniec and auth.uid() is not null then
    select najlepszy into rekord from trop_wyniki where user_id = auth.uid();
    nowy := rekord is null or g.suma > rekord;
    insert into trop_wyniki (user_id, najlepszy, gier, updated_at)
    values (auth.uid(), g.suma, 1, now())
    on conflict (user_id) do update
      set gier = trop_wyniki.gier + 1,
          najlepszy = greatest(trop_wyniki.najlepszy, excluded.najlepszy),
          updated_at = case when excluded.najlepszy > trop_wyniki.najlepszy then now() else trop_wyniki.updated_at end;
    select najlepszy into rekord from trop_wyniki where user_id = auth.uid();
    select count(*) + 1 into pozycja from trop_wyniki w join profiles p on p.id = w.user_id
     where p.banned_at is null and w.najlepszy > rekord;
  end if;

  return jsonb_build_object(
    'runda', g.runda, 'rund', rund, 'punkty', wynik, 'bazowe', baza, 'bonus', not g.odkryte and wynik > 0,
    'odleglosc', case when d is null then null else round(d) end,
    'spoznione', czas > 190,
    'boisko', jsonb_build_object('nazwa', c.name, 'miasto', c.city, 'slug', c.slug, 'lat', c.lat, 'lng', c.lng),
    'suma', g.suma, 'koniec', koniec,
    'rekord', rekord, 'nowy_rekord', nowy, 'pozycja', pozycja
  );
end;
$$;
grant execute on function public.trop_zgadnij(uuid, double precision, double precision) to anon, authenticated;

/* ---------- następna runda ---------- */
create or replace function public.trop_nastepna(p_gra uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare g trop_gry;
begin
  g := trop_moja(p_gra);
  if g.stan <> 'wynik' then raise exception 'Najpierw zgadnij bieżącą rundę.'; end if;
  update trop_gry set runda = runda + 1, stan = 'gra', runda_od = now(), odkryte = false
   where id = g.id returning * into g;
  return jsonb_build_object('gra', g.id, 'rund', array_length(g.boiska, 1), 'runda', g.runda)
      || trop_zdjecie_rundy(g.boiska[g.runda]);
end;
$$;
grant execute on function public.trop_nastepna(uuid) to anon, authenticated;

/* ---------- ranking ---------- */
create or replace function public.trop_ranking(p_ile integer default 20)
returns table (nick text, avatar text, wynik integer, gier integer, kiedy timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(p.display_name), ''), 'gracz'), p.avatar_url, w.najlepszy, w.gier, w.updated_at
    from trop_wyniki w
    join profiles p on p.id = w.user_id
   where p.banned_at is null
   order by w.najlepszy desc, w.updated_at
   limit greatest(1, least(coalesce(p_ile, 20), 100));
$$;
grant execute on function public.trop_ranking(integer) to anon, authenticated;

-- ============================================================ kontrola
select 'boisk w puli' as co, count(*)::text as ile
  from courts c where exists (select 1 from court_photos p where p.court_id = c.id)
union all select 'punkty za 5 m / 1 km / 8 km / 50 km (Kraków)',
  trop_punkty(5, 'Kraków') || ' / ' || trop_punkty(1000, 'Kraków') || ' / ' || trop_punkty(8000, 'Kraków') || ' / ' || trop_punkty(50000, 'Kraków');
