-- =====================================================================
--  Król Boiska, propsy i „Teraz na boisku” (24.10.2026)
--
--  1. meldunki        - potwierdzona GPS-em obecność na boisku: jeden wiersz na osobę,
--                       boisko i dzień (czas polski). Ważna 2 godziny od ostatniego
--                       potwierdzenia albo do „Wychodzę”.
--  2. propsy          - props od osoby, która była na boisku w tym samym czasie.
--                       Jeden od danej osoby dla danej osoby na dzień.
--  3. profiles.pokaz_na_boisku - zgoda na widoczność: null = jeszcze nie pytaliśmy,
--                       true / false = odpowiedź. Bez zgody nie widzisz innych i nie
--                       jesteś w rankingu bywalców (symetrycznie).
--  4. Funkcje: zamelduj, wymelduj, na_boisku, daj_props, ustaw_widocznosc_na_boisku,
--     krol_boiska (ranking bywalców z 30 dni: 1 pkt za dzień + najwyżej 3 propsy dziennie).
--
--  Czym to NIE jest: dowodem. Współrzędne przychodzą z przeglądarki i da się je
--  podmienić - patrz nota w lib/obecnosc.ts. Dlatego props ma znaczenie: podrobiona
--  obecność siedzi na boisku sama i propsa od drugiej, też zameldowanej osoby nie dostanie.
--  Surowej pozycji NIE zapisujemy - tylko odległość od pinezki i dokładność odczytu.
-- =====================================================================

/* dzień w czasie polskim - baza liczy w UTC, a „dziś” na boisku kończy się o północy w Polsce */
create or replace function dzis_pl()
returns date language sql stable as $$
  select (now() at time zone 'Europe/Warsaw')::date;
$$;

/* ---------- 1. meldunki ---------- */
create table if not exists meldunki (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references courts(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  dzien        date not null default dzis_pl(),
  od           timestamptz not null default now(),
  ostatnio     timestamptz not null default now(),
  wazne_do     timestamptz not null default now() + interval '2 hours',
  odleglosc_m  real,
  dokladnosc_m real,
  unique (court_id, user_id, dzien)
);

create index if not exists meldunki_boisko_idx on meldunki (court_id, wazne_do desc);
create index if not exists meldunki_gracz_idx on meldunki (user_id, ostatnio desc);
create index if not exists meldunki_dzien_idx on meldunki (court_id, dzien);

alter table meldunki enable row level security;
/* nikt nie czyta ani nie pisze wprost - tylko przez funkcje niżej */
revoke all on meldunki from anon, authenticated;

/* ---------- 2. propsy ---------- */
create table if not exists propsy (
  od_user    uuid not null references profiles(id) on delete cascade,
  do_user    uuid not null references profiles(id) on delete cascade,
  court_id   uuid not null references courts(id) on delete cascade,
  dzien      date not null default dzis_pl(),
  created_at timestamptz not null default now(),
  primary key (od_user, do_user, dzien),
  check (od_user <> do_user)
);

create index if not exists propsy_boisko_idx on propsy (court_id, dzien);
create index if not exists propsy_odbiorca_idx on propsy (do_user, dzien);

alter table propsy enable row level security;
revoke all on propsy from anon, authenticated;

/* ---------- 3. zgoda na widoczność ---------- */
alter table profiles add column if not exists pokaz_na_boisku boolean;

create or replace function ustaw_widocznosc_na_boisku(in_pokaz boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Wymaga konta' using errcode = 'check_violation';
  end if;
  update profiles set pokaz_na_boisku = in_pokaz where id = auth.uid();
end $$;

revoke all on function ustaw_widocznosc_na_boisku(boolean) from public, anon;
grant execute on function ustaw_widocznosc_na_boisku(boolean) to authenticated;

/* odległość w metrach (haversine) - ta sama, co `odlegloscM` w lib/obecnosc.ts */
create or replace function odleglosc_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

/* ---------- 4a. zamelduj ---------- */
/*
  Promień 60 m: pinezka stoi na środku płyty, a człowiek przy linii bocznej albo na ławce
  jest od niej 20-30 m; do tego niepewność odczytu. Dokładność gorsza niż 40 m to odczyt
  z sieci komórkowej - nic nie znaczy (ten sam próg co przy dodawaniu boiska).
  „Teleport”: meldunek na innym boisku w ostatnich 30 min z prędkością ponad 120 km/h
  między nimi - odrzucamy.
*/
create or replace function zamelduj(in_court uuid, in_lat float8, in_lng float8, in_dokladnosc float8)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b record;
  odl float8;
  poprz record;
  wiersz meldunki;
  pokaz boolean;
begin
  if uid is null then
    return json_build_object('ok', false, 'powod', 'konto');
  end if;
  if zbanowany(uid) then
    return json_build_object('ok', false, 'powod', 'blokada');
  end if;
  if in_dokladnosc is null or in_dokladnosc > 40 then
    return json_build_object('ok', false, 'powod', 'za-slaby-sygnal');
  end if;

  select lat, lng into b from courts where id = in_court;
  if not found then
    return json_build_object('ok', false, 'powod', 'brak-boiska');
  end if;

  odl := odleglosc_m(in_lat, in_lng, b.lat, b.lng);
  if odl > 60 then
    return json_build_object('ok', false, 'powod', 'za-daleko', 'odleglosc', round(odl));
  end if;

  select m.ostatnio, c.lat, c.lng into poprz
    from meldunki m join courts c on c.id = m.court_id
   where m.user_id = uid and m.court_id <> in_court and m.ostatnio > now() - interval '30 minutes'
   order by m.ostatnio desc limit 1;
  if found and odleglosc_m(poprz.lat, poprz.lng, b.lat, b.lng)
               / greatest(extract(epoch from now() - poprz.ostatnio), 60) * 3.6 > 120 then
    return json_build_object('ok', false, 'powod', 'za-szybko');
  end if;

  /* jest się na jednym boisku naraz - inne meldunki tej osoby wygasają */
  update meldunki set wazne_do = now()
   where user_id = uid and court_id <> in_court and wazne_do > now();

  insert into meldunki (court_id, user_id, odleglosc_m, dokladnosc_m)
  values (in_court, uid, odl, in_dokladnosc)
  on conflict (court_id, user_id, dzien) do update
     set ostatnio = now(),
         /* po „Wychodzę” i powrocie tego samego dnia obecność zaczyna się od nowa */
         od = case when meldunki.wazne_do < now() then now() else meldunki.od end,
         wazne_do = now() + interval '2 hours',
         odleglosc_m = excluded.odleglosc_m,
         dokladnosc_m = excluded.dokladnosc_m
  returning * into wiersz;

  select pokaz_na_boisku into pokaz from profiles where id = uid;

  return json_build_object('ok', true, 'od', wiersz.od, 'wazne_do', wiersz.wazne_do, 'pokaz', pokaz);
end $$;

revoke all on function zamelduj(uuid, float8, float8, float8) from public, anon;
grant execute on function zamelduj(uuid, float8, float8, float8) to authenticated;

/* ---------- 4b. wymelduj ---------- */
create or replace function wymelduj(in_court uuid)
returns void language sql security definer set search_path = public as $$
  update meldunki set wazne_do = now()
   where user_id = auth.uid() and court_id = in_court and wazne_do > now();
$$;

revoke all on function wymelduj(uuid) from public, anon;
grant execute on function wymelduj(uuid) to authenticated;

/* ---------- 4c. ranking bywalców (Król Boiska) ---------- */
/*
  Ostatnie 30 dni, liczone po dniach w czasie polskim: 1 pkt za każdy dzień z meldunkiem
  plus propsy, ale najwyżej 3 dziennie (żeby grupka kolegów nie nabiła sobie korony).
  W rankingu są tylko osoby, które zgodziły się być widoczne na boisku.
  Remis: więcej dni, potem kto wcześniej zaczął bywać.
*/
create or replace function krol_boiska(in_court uuid, in_limit int default 5)
returns table (user_id uuid, nick text, avatar text, slug text, punkty int, dni int, propsy int)
language sql stable security definer set search_path = public as $$
  with dni as (
    select m.user_id, count(distinct m.dzien)::int as dni, min(m.od) as pierwszy
      from meldunki m
     where m.court_id = in_court and m.dzien > dzis_pl() - 30
     group by m.user_id
  ),
  pr as (
    select p.do_user as user_id, sum(least(p.ile, 3))::int as propsy
      from (
        select do_user, dzien, count(*) as ile
          from propsy
         where court_id = in_court and dzien > dzis_pl() - 30
         group by do_user, dzien
      ) p
     group by p.do_user
  )
  select d.user_id, coalesce(nullif(btrim(pf.display_name), ''), 'gracz'), pf.avatar_url, pf.slug,
         (d.dni + coalesce(pr.propsy, 0))::int, d.dni, coalesce(pr.propsy, 0)::int
    from dni d
    join profiles pf on pf.id = d.user_id
    left join pr on pr.user_id = d.user_id
   where pf.pokaz_na_boisku is true and pf.banned_at is null
   order by 5 desc, d.dni desc, d.pierwszy asc
   limit greatest(1, least(in_limit, 50));
$$;

grant execute on function krol_boiska(uuid, int) to anon, authenticated;

/* ---------- 4d. kto jest teraz na boisku ---------- */
/*
  Lista innych widocznych osób z ważnym meldunkiem - ale TYLKO dla kogoś, kto sam stoi
  na tym boisku i sam jest widoczny. Z domu, z innego miasta ani anonimowo tej listy się
  nie zobaczy: to jest lokalizacja ludzi w czasie rzeczywistym.
*/
create or replace function na_boisku(in_court uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  moj meldunki;
  pokaz boolean;
  krol uuid;
begin
  if uid is null then
    return json_build_object('jestem', false);
  end if;

  select * into moj from meldunki
   where user_id = uid and court_id = in_court and wazne_do > now()
   order by ostatnio desc limit 1;
  select pokaz_na_boisku into pokaz from profiles where id = uid;

  if moj.id is null then
    return json_build_object('jestem', false, 'pokaz', pokaz);
  end if;

  if pokaz is not true then
    return json_build_object('jestem', true, 'od', moj.od, 'wazne_do', moj.wazne_do, 'pokaz', pokaz, 'gracze', '[]'::json);
  end if;

  select k.user_id into krol from krol_boiska(in_court, 1) k;

  return json_build_object(
    'jestem', true, 'od', moj.od, 'wazne_do', moj.wazne_do, 'pokaz', pokaz,
    'gracze', coalesce((
      select json_agg(json_build_object(
               'id', pf.id,
               'nick', coalesce(nullif(btrim(pf.display_name), ''), 'gracz'),
               'avatar', pf.avatar_url,
               'slug', pf.slug,
               'od', m.od,
               'krol', pf.id = krol,
               'props', exists (select 1 from propsy p where p.od_user = uid and p.do_user = pf.id and p.dzien = dzis_pl())
             ) order by m.od)
        from meldunki m
        join profiles pf on pf.id = m.user_id
       where m.court_id = in_court and m.wazne_do > now() and m.user_id <> uid
         and pf.pokaz_na_boisku is true and pf.banned_at is null
    ), '[]'::json)
  );
end $$;

revoke all on function na_boisku(uuid) from public, anon;
grant execute on function na_boisku(uuid) to authenticated;

/* ---------- 4e. daj propsa ---------- */
/*
  Wolno tylko komuś, z kim się DZIŚ było na tym boisku w tym samym czasie (przedziały
  obecności nachodzą na siebie) - także po wyjściu, do północy. Najwyżej 15 propsów
  rozdanych dziennie.
*/
create or replace function daj_props(in_court uuid, in_do uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ja meldunki;
  on_ meldunki;
begin
  if uid is null then
    return json_build_object('ok', false, 'powod', 'konto');
  end if;
  if uid = in_do then
    return json_build_object('ok', false, 'powod', 'sobie');
  end if;
  if zbanowany(uid) then
    return json_build_object('ok', false, 'powod', 'blokada');
  end if;

  select * into ja from meldunki where user_id = uid and court_id = in_court and dzien = dzis_pl();
  select * into on_ from meldunki where user_id = in_do and court_id = in_court and dzien = dzis_pl();
  if ja.id is null or on_.id is null
     or not (ja.od < on_.wazne_do and on_.od < ja.wazne_do) then
    return json_build_object('ok', false, 'powod', 'nie-razem');
  end if;

  if (select count(*) from propsy where od_user = uid and dzien = dzis_pl()) >= 15 then
    return json_build_object('ok', false, 'powod', 'limit');
  end if;

  insert into propsy (od_user, do_user, court_id) values (uid, in_do, in_court)
  on conflict do nothing;
  return json_build_object('ok', true);
end $$;

revoke all on function daj_props(uuid, uuid) from public, anon;
grant execute on function daj_props(uuid, uuid) to authenticated;

/* kontrola */
select
  (select count(*) from information_schema.tables where table_name in ('meldunki', 'propsy')) as tabele,
  (select count(*) from pg_proc where proname in ('zamelduj', 'wymelduj', 'na_boisku', 'daj_props', 'krol_boiska', 'ustaw_widocznosc_na_boisku')) as funkcje;
