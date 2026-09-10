-- =====================================================================
--  Punkty nieodkrytych boisk.
--  Uruchom raz, PRZED `dane-punkty-osm.sql` (który wsypuje same współrzędne).
--  Wymaga `migration-odleglosc.sql` (funkcja `distance_m`).
--
--  CO TO JEST
--
--  Siedem tysięcy osiemset szarych pinezek: miejsc, w których według OpenStreetMap stoi
--  boisko do kosza, a u nas jeszcze go nie ma. Widać je dopiero po mocnym przybliżeniu
--  mapy, klika się w nie i dostaje jedno zdanie: „przyjdź tu i dodaj to boisko". Kiedy
--  ktoś doda boisko bliżej niż pięćdziesiąt metrów, punkt gaśnie sam.
--
--  CZYM TO NIE JEST: importem boisk. Z OSM biorą się WYŁĄCZNIE WSPÓŁRZĘDNE - żadnych nazw,
--  nawierzchni, godzin. Punkt nie ma karty w serwisie, nie wchodzi do rankingów, nie jest
--  w mapie witryny i nigdzie nie wychodzi jako dane. Powód jest podwójny: prawny (osiem
--  tysięcy rekordów to istotny wyciąg z bazy na licencji ODbL, a przy „Produced Work"
--  wystarcza atrybucja) i produktowy (osiem tysięcy pustych podstron ciągnęłoby w dół
--  pozycję prawdziwych boisk). Szczegóły w `scripts/punkty-osm.mjs`.
--
--  Atrybucja: dane pochodzą z OpenStreetMap, na licencji ODbL. Musi być widoczna przy mapie.
-- =====================================================================

create table if not exists public.punkty_osm (
  /* identyfikator z OSM: typ i numer, np. „w123456". Trwały, więc powtórny import
     nie dubluje punktów i nie gubi tego, co ktoś już odkrył. */
  osm_id        text primary key,
  lat           double precision not null,
  lng           double precision not null,
  /* boisko, które ten punkt odkryło - null znaczy „wciąż do wzięcia" */
  odkryte_przez uuid references public.courts(id) on delete set null,
  odkryte_at    timestamptz,
  /* punkt-widmo: w OSM jest, w rzeczywistości nie ma. Gasi administrator. */
  ukryty        boolean not null default false,
  zgloszen      integer not null default 0
);

/*
  Indeks CZĘŚCIOWY. Mapa pyta wyłącznie o punkty nieodkryte i niewygaszone, więc reszta
  nie ma po co w nim siedzieć - a z czasem to właśnie odkryte będą przybywać.
*/
create index if not exists punkty_osm_kadr_idx
  on public.punkty_osm (lat, lng)
  where odkryte_przez is null and not ukryty;

alter table public.punkty_osm enable row level security;
/* nikt nie sięga do tabeli wprost - wszystko idzie funkcjami niżej */

/* ---------- 1. punkty w kadrze mapy ---------- */

/**
 * Punkty widoczne w danym prostokącie. Wołane przy każdym zatrzymaniu mapy, ale tylko
 * przy dużym przybliżeniu - patrz `PRZYBLIZENIE_PUNKTOW` w `components/MapView.tsx`.
 */
create or replace function public.punkty_w_kadrze(
  in_min_lat double precision,
  in_min_lng double precision,
  in_max_lat double precision,
  in_max_lng double precision,
  in_limit   integer default 300
)
returns table (osm_id text, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p.osm_id, p.lat, p.lng
    from punkty_osm p
   where p.odkryte_przez is null
     and not p.ukryty
     /*
       Sufit na wielkość kadru. Pół stopnia to jakieś 55 km - kilkanaście razy więcej, niż
       widać przy przybliżeniu, od którego te pinezki się w ogóle pojawiają. Bez tego jedno
       zapytanie o prostokąt wielkości Polski oddawałoby pół tabeli naraz; z nim trzeba by
       przejechać kraj kadr po kadrze, a to jest dokładnie ta praca, której nikt nie zrobi
       dla danych, które i tak są w OSM.
     */
     and in_max_lat - in_min_lat <= 0.5
     and in_max_lng - in_min_lng <= 0.5
     and p.lat between in_min_lat and in_max_lat
     and p.lng between in_min_lng and in_max_lng
   limit greatest(1, least(coalesce(in_limit, 300), 500));
$$;

grant execute on function public.punkty_w_kadrze(
  double precision, double precision, double precision, double precision, integer
) to anon, authenticated;

/* ---------- 2. jeden punkt, pod stronę „boisko nieodkryte" ---------- */

/**
 * Jeden punkt po identyfikatorze. `odkryte_slug` jest tu po to, żeby strona nieodkrytego
 * boiska umiała odesłać na kartę boiska, gdy ktoś otworzy stary link do miejsca, które
 * w międzyczasie zostało odkryte - zamiast pokazywać zaproszenie do czegoś, co już jest.
 */
create or replace function public.punkt_osm(in_id text)
returns table (
  osm_id        text,
  lat           double precision,
  lng           double precision,
  ukryty        boolean,
  odkryte_slug  text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.osm_id, p.lat, p.lng, p.ukryty, c.slug
    from punkty_osm p
    left join courts c on c.id = p.odkryte_przez
   where p.osm_id = in_id;
$$;

grant execute on function public.punkt_osm(text) to anon, authenticated;

/* ---------- 3. odkrywanie ---------- */

/**
 * Ile metrów od punktu musi stanąć nowe boisko, żeby go odkryć.
 *
 * Pięćdziesiąt, a nie dwadzieścia pięć jak przy sprawdzaniu obecności: tam chodzi o to, czy
 * człowiek NA PEWNO stoi na boisku, tu o to, czy dodane boisko to TO SAMO boisko. Punkt
 * z OSM bywa środkiem ciężkości obrysu, a boisko ma dwadzieścia osiem metrów długości, więc
 * pinezka postawiona przy koszu potrafi leżeć piętnaście metrów od środka - a przy dużym
 * kompleksie i więcej.
 */
create or replace function public.odkryj_punkty_osm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /* 50 m w stopniach; w długości stopień jest krótszy o cosinus szerokości */
  d_lat double precision := 50.0 / 111320.0;
  d_lng double precision := 50.0 / (111320.0 * greatest(cos(radians(new.lat)), 0.01));
begin
  update punkty_osm p
     set odkryte_przez = new.id,
         odkryte_at    = now()
   where p.odkryte_przez is null
     and p.lat between new.lat - d_lat and new.lat + d_lat
     and p.lng between new.lng - d_lng and new.lng + d_lng
     and distance_m(new.lat, new.lng, p.lat, p.lng) <= 50;

  return new;
end;
$$;

/*
  Także przy zmianie współrzędnych, nie tylko przy wstawieniu: administrator poprawiający
  pinezkę w panelu potrafi ją przesunąć na punkt, którego wcześniej nie dotykała.
*/
drop trigger if exists odkryj_punkty_osm_trigger on public.courts;
create trigger odkryj_punkty_osm_trigger
  after insert or update of lat, lng on public.courts
  for each row execute function public.odkryj_punkty_osm();

/* ---------- 4. zgłoszenie „tu nie ma boiska" ---------- */

create table if not exists public.punkty_osm_zgloszenia (
  punkt_id   text not null references public.punkty_osm(osm_id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (punkt_id, user_id)
);

alter table public.punkty_osm_zgloszenia enable row level security;

/**
 * „Tu nie ma boiska". Wymaga konta - i to nie z ostrożności, tylko dlatego, że bez niego
 * jedna osoba wygasiłaby dowolny punkt tyloma zgłoszeniami, ile ma cierpliwości. Klucz
 * główny na parze (punkt, konto) sprawia, że drugie zgłoszenie tej samej osoby nic nie robi.
 *
 * Punkt NIE gaśnie sam po iluś zgłoszeniach. Trzy konta wystarczyłyby, żeby skasować
 * prawdziwy checkpoint, a odtworzyć go potem nie ma jak - decyzję podejmuje człowiek
 * w panelu.
 */
create or replace function public.zglos_brak_boiska(in_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ile integer;
begin
  if uid is null then
    raise exception 'Trzeba być zalogowanym.';
  end if;

  if zbanowany(uid) then
    raise exception 'Konto jest zablokowane.';
  end if;

  insert into punkty_osm_zgloszenia (punkt_id, user_id)
  values (in_id, uid)
  on conflict (punkt_id, user_id) do nothing;

  if not found then
    /* powtórka tej samej osoby - oddajemy stan bez zmian */
    select zgloszen into ile from punkty_osm where osm_id = in_id;
    return coalesce(ile, 0);
  end if;

  update punkty_osm
     set zgloszen = zgloszen + 1
   where osm_id = in_id
  returning zgloszen into ile;

  return coalesce(ile, 0);
end;
$$;

grant execute on function public.zglos_brak_boiska(text) to authenticated;

/* ---------- 5. panel administratora ---------- */

/** Punkty ze zgłoszeniami - do przejrzenia w panelu. */
create or replace function public.punkty_osm_zgloszone(in_limit integer default 100)
returns table (osm_id text, lat double precision, lng double precision, zgloszen integer, ukryty boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  return query
    select p.osm_id, p.lat, p.lng, p.zgloszen, p.ukryty
      from punkty_osm p
     where p.zgloszen > 0
       and p.odkryte_przez is null
     order by p.zgloszen desc, p.osm_id
     limit greatest(1, least(coalesce(in_limit, 100), 500));
end;
$$;

grant execute on function public.punkty_osm_zgloszone(integer) to authenticated;

/** Gasi albo przywraca punkt-widmo. */
create or replace function public.ustaw_punkt_osm(in_id text, in_ukryty boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  update punkty_osm set ukryty = coalesce(in_ukryty, false) where osm_id = in_id;
end;
$$;

grant execute on function public.ustaw_punkt_osm(text, boolean) to authenticated;

-- ============================================================ kontrola
-- Po wgraniu `dane-punkty-osm.sql` uruchom to jeszcze raz - odkryje punkty pod boiskami,
-- które już są w bazie (wyzwalacz działa dopiero od następnego wstawienia).
update public.punkty_osm p
   set odkryte_przez = c.id,
       odkryte_at    = now()
  from public.courts c
 where p.odkryte_przez is null
   and p.lat between c.lat - 50.0 / 111320.0 and c.lat + 50.0 / 111320.0
   and p.lng between c.lng - 50.0 / (111320.0 * greatest(cos(radians(c.lat)), 0.01))
                 and c.lng + 50.0 / (111320.0 * greatest(cos(radians(c.lat)), 0.01))
   and distance_m(c.lat, c.lng, p.lat, p.lng) <= 50;

select count(*)                                            as punktow,
       count(*) filter (where odkryte_przez is not null)    as odkrytych,
       count(*) filter (where ukryty)                       as wygaszonych
  from public.punkty_osm;
