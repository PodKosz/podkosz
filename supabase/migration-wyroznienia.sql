-- =====================================================================
--  Więcej wyróżnień na profilu
--
--  Wyróżnienia to odznaczenia bez progów: albo je masz, albo nie. Dotąd były cztery,
--  teraz jest ich szesnaście, więc `statystyki_gracza` musi policzyć kilka nowych rzeczy:
--  gra w weekend, długość serii dni, zimowe wyjścia, oświetlenie i plakietki na boiskach,
--  komplet kadrów, różnorodność nawierzchni i typów, pierwsze boisko w miejscowości.
--
--  Funkcja zyskuje kolumny, więc trzeba ją najpierw skasować - Postgres nie pozwala
--  zmienić typu zwracanego przez `create or replace`. Stary kod strony czyta ją po
--  nazwach pól, więc nowe kolumny niczego nie psują.
-- =====================================================================

drop function if exists statystyki_gracza(text);

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
  pionier            boolean,
  /* ---- nowe ---- */
  weekend            boolean,
  maraton            boolean,
  seria              integer,
  zima               boolean,
  oswietlone         boolean,
  approved           boolean,
  smieszne           boolean,
  komplet            boolean,
  nawierzchnie       integer,
  typy               integer,
  pierwszy_w_miescie boolean
)
language sql stable security definer set search_path = public as $$
  with p as (
    select pr.id, pr.display_name, pr.avatar_url, pr.created_at
      from profiles pr
     where lower(pr.display_name) = lower(btrim(p_nick))
     limit 1
  ),
  moje as (
    select c.id, c.city, c.voivodeship, c.likes_count, c.created_at,
           c.lit, c.basket_approved, c.funny, c.surface, c.type
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
  ),
  dni_gry as (
    select distinct day from gra
  ),
  serie as (
    /*
      Klasyczna sztuczka na „ile dni pod rząd": od daty odejmujemy numer wiersza. Dla dni
      idących jeden po drugim wynik jest stały, więc grupowanie po nim daje długości serii.
    */
    select count(*)::integer as dlugosc
      from (select day - (row_number() over (order by day))::integer as kubelek
              from dni_gry) t
     group by kubelek
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
    ),
    /* weekend: sobota albo niedziela (ISO: 6 i 7) */
    (select exists (select 1 from gra g where extract(isodow from g.day) >= 6)),
    /* maraton: sześć godzin gry w jednym dniu */
    (select exists (
       select 1 from (select g.day, count(*) as ile from gra g group by g.day) d
        where d.ile >= 6)),
    /* najdłuższa seria dni pod rząd */
    (select coalesce(max(s.dlugosc), 0)::integer from serie s),
    /* zima: gra w grudniu, styczniu albo lutym */
    (select exists (select 1 from gra g where extract(month from g.day) in (12, 1, 2))),
    /*
      Kolumny kwalifikujemy aliasem `m` nie dla ozdoby: nazwy pól wyjściowych tej funkcji
      pokrywają się z nazwami kolumn tabel, a niekwalifikowana nazwa byłaby dwuznaczna.

      Uwaga: w bazie NIE MA kolumny `courts.heat` - migracja `migration-heat.sql` nigdy nie
      została wgrana, a fioletowe wyróżnienie Heat na mapie stoi na `basket_approved`
      (patrz `markerHtml` w components/MapView.tsx). Osobne odznaczenie za Heat dublowałoby
      więc „Basket Approved"; w jego miejsce jest boisko z oświetleniem.
    */
    /* własne boisko z oświetleniem */
    (select exists (select 1 from moje m where m.lit)),
    /* własne boisko z plakietką twórcy */
    (select exists (select 1 from moje m where m.basket_approved)),
    /* własne boisko z plakietką „Śmieszne boisko" */
    (select exists (select 1 from moje m where m.funny)),
    /* komplet kadrów: boisko z co najmniej sześcioma różnymi rodzajami zdjęć */
    (select exists (
       select 1 from court_photos cp
        where cp.court_id in (select id from moje)
        group by cp.court_id
       having count(distinct cp.kind) >= 6)),
    (select count(distinct m.surface)::integer from moje m),
    (select count(distinct m.type)::integer from moje m),
    /* pierwsze boisko w miejscowości - nikt nie dodał tam wcześniej niczego */
    (select exists (
       select 1 from moje m
        where coalesce(btrim(m.city), '') <> ''
          and not exists (
            select 1 from courts c2
             where lower(c2.city) = lower(m.city)
               and c2.created_at < m.created_at)));
$$;

grant execute on function statystyki_gracza(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select nick, boiska, seria, weekend, maraton, zima, oswietlone, approved, smieszne,
       komplet, nawierzchnie, typy, pierwszy_w_miescie
  from statystyki_gracza('Basket');
