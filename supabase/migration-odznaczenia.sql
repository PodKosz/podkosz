-- =====================================================================
--  Odznaczenia i zakres godzin w deklaracjach gry
--
--  1. checkins  - jedna osoba może zapisać się na kilka godzin pod rząd
--                 („18:00-21:00"), a nie tylko na jedną. Godziny z przeszłości
--                 zostają w tabeli, bo z nich liczymy odznaczenia za czas na boisku.
--  2. statystyki_gracza() - liczby do profilu i odznaczeń. Same sumy, bez list:
--                 kto co polubił i gdzie bywa, zostaje prywatne.
-- =====================================================================

/* ---------- 1. deklaracja na zakres godzin ---------- */

/*
  Do tej pory ograniczenie (boisko, osoba, dzień) pozwalało na dokładnie jedną godzinę.
  Zakres zapisujemy jako osobny wiersz na każdą godzinę - dzięki temu „kto o której"
  liczy się dalej zwykłym `group by hour`, bez rozwijania przedziałów w zapytaniach.
*/
alter table checkins drop constraint if exists checkins_court_id_user_id_day_key;

create unique index if not exists checkins_court_user_day_hour_uidx
  on checkins (court_id, user_id, day, hour);

/* Zapora na absurdy w rodzaju „jestem tam 24 godziny": najwyżej 12 godzin dziennie. */
create or replace function checkins_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ile int;
begin
  select count(*) into ile
    from checkins
   where court_id = new.court_id
     and user_id = new.user_id
     and day = new.day;

  if ile >= 12 then
    raise exception 'Najwyżej 12 godzin na jednym boisku w ciągu dnia'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists checkins_limit_trg on checkins;
create trigger checkins_limit_trg before insert on checkins
  for each row execute function checkins_limit();

/*
  Liczby na mapie i na liście wyników: jedna osoba to jedna osoba, także wtedy, gdy
  zapisała się na cztery godziny. Bez `distinct` zakresy nadmuchałyby tłum na boisku.
*/
create or replace function checkins_summary(in_courts uuid[])
returns table (court_id uuid, people integer, first_hour smallint)
language sql stable security definer set search_path = public as $$
  select c.court_id, count(distinct c.user_id)::integer as people, min(c.hour)::smallint
    from checkins c
   where c.day = current_date
     and c.court_id = any (in_courts)
   group by c.court_id;
$$;

grant execute on function checkins_summary(uuid[]) to anon, authenticated;

/*
  Ile różnych osób wybiera się dziś na boisko. Suma po godzinach już tego nie powie:
  ktoś zapisany od 18:00 do 21:00 to jedna osoba w czterech wierszach.
*/
create or replace function checkins_osoby(in_court uuid, in_day date default current_date)
returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct c.user_id)::integer
    from checkins c
   where c.court_id = in_court
     and c.day = in_day;
$$;

grant execute on function checkins_osoby(uuid, date) to anon, authenticated;

/*
  Sprzątaczka starych deklaracji odchodzi: godziny z przeszłości są teraz historią gry
  i podstawą odznaczeń za czas na boisku. Nikt jej nie wołał z aplikacji, ale zostawiona
  w bazie byłaby miną - jedno wywołanie i wszystkim znikają odznaczenia.
*/
drop function if exists checkins_cleanup();

/* ---------- 2. statystyki do profilu i odznaczeń ---------- */

/*
  Wszystko liczone dla jednego nicku. Boiska bierzemy dwiema drogami (identyfikator konta
  albo podpis autora), bo wpisy redakcyjne z panelu miały kiedyś tylko podpis.

  Funkcja jest `security definer`, bo czyta tabele zamknięte politykami (`likes`,
  `favorites`, `checkins`). Na zewnątrz wychodzą wyłącznie sumy - żadnej listy, więc
  nie da się z niej wyciągnąć, które boiska ktoś polubił ani gdzie bywa.
*/
create or replace function statystyki_gracza(p_nick text)
returns table (
  user_id            uuid,
  nick               text,
  avatar             text,
  dolaczyl           timestamptz,
  boiska             integer,
  podpalenia_zebrane integer,
  podpalenia_dane    integer,
  ulubione           integer,
  godziny            integer,
  dni                integer,
  miasta             integer,
  wojewodztwa        integer,
  zdjecia            integer,
  nocne              boolean,
  ranne              boolean,
  pionier            boolean
)
language sql stable security definer set search_path = public as $$
  with p as (
    select pr.id, pr.display_name, pr.avatar_url, pr.created_at
      from profiles pr
     where lower(pr.display_name) = lower(btrim(p_nick))
     limit 1
  ),
  moje as (
    select c.id, c.city, c.voivodeship, c.likes_count
      from courts c
     where c.added_by = (select id from p)
        or lower(c.added_by_name) = lower(btrim(p_nick))
  ),
  gra as (
    /* tylko godziny, które już były - zapisy na kolejne dni to plan, nie historia */
    select ch.day, ch.hour
      from checkins ch
     where ch.user_id = (select id from p)
       and ch.day <= current_date
  )
  select
    (select id from p),
    coalesce((select display_name from p), btrim(p_nick)),
    (select avatar_url from p),
    (select created_at from p),
    (select count(*)::integer from moje),
    (select coalesce(sum(likes_count), 0)::integer from moje),
    (select count(*)::integer from likes l where l.user_id = (select id from p)),
    (select count(*)::integer from favorites f where f.user_id = (select id from p)),
    (select count(*)::integer from gra),
    (select count(distinct day)::integer from gra),
    (select count(distinct city)::integer from moje),
    (select count(distinct voivodeship)::integer from moje),
    (select count(*)::integer from court_photos cp where cp.court_id in (select id from moje)),
    (select exists (select 1 from gra where hour >= 21)),
    (select exists (select 1 from gra where hour <= 8)),
    /* pionier: konto w pierwszej setce, licząc po dacie założenia */
    coalesce(
      (select count(*) <= 100 from profiles p2
        where p2.created_at <= (select created_at from p)),
      false
    );
$$;

grant execute on function statystyki_gracza(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select * from statystyki_gracza('Basket');
