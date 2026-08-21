-- =====================================================================
--  Publiczny profil gracza: ulubione i historia gry
--
--  Obie tabele są zamknięte politykami (właściciel widzi tylko swoje wiersze),
--  a profil ma je pokazywać każdemu odwiedzającemu. Dlatego dwie funkcje
--  `security definer`, które zwracają wyłącznie identyfikatory boisk i daty -
--  nazwy, zdjęcia i resztę dociąga już strona z publicznej tabeli `courts`.
--
--  UWAGA: od tej migracji lista ulubionych boisk i miejsca ostatnich gier są
--  jawne dla każdego, kto wejdzie na profil. To świadoma decyzja produktowa.
-- =====================================================================

create or replace function ulubione_gracza(p_nick text)
returns table (court_id uuid)
language sql stable security definer set search_path = public as $$
  select f.court_id
    from favorites f
    join profiles p on p.id = f.user_id
   where lower(p.display_name) = lower(btrim(p_nick))
   order by f.created_at desc
   limit 12;
$$;

grant execute on function ulubione_gracza(text) to anon, authenticated;

/*
  Historia gry: jeden wiersz na dzień i boisko. Godzin nie zwracamy - na profilu liczy się
  „gdzie i kiedy", a nie o której ktoś tam był.
*/
create or replace function historia_gracza(p_nick text)
returns table (day date, court_id uuid)
language sql stable security definer set search_path = public as $$
  select ch.day, ch.court_id
    from checkins ch
    join profiles p on p.id = ch.user_id
   where lower(p.display_name) = lower(btrim(p_nick))
     and ch.day <= current_date
   group by ch.day, ch.court_id
   order by ch.day desc
   limit 12;
$$;

grant execute on function historia_gracza(text) to anon, authenticated;

/* ---------- kontrola ---------- */
select
  (select count(*) from ulubione_gracza('Basket')) as ulubione,
  (select count(*) from historia_gracza('Basket')) as wizyty;
