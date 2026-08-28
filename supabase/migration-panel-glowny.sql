-- =====================================================================
--  Kokpit panelu administratora
--
--  Strona tytułowa panelu ma odpowiadać na jedno pytanie: „czy coś się dziś dzieje i czy
--  coś na mnie czeka". Odpowiedź składa się z kilkunastu liczb rozsianych po ośmiu
--  tabelach, więc zbieramy je JEDNYM zapytaniem. Kilkanaście osobnych odpytań przez
--  PostgREST to kilkanaście podróży po sieci, a kokpit ma się pojawić od razu.
--
--  O granulacji uczciwie: „w ostatnie 24 h" da się policzyć dokładnie tylko dla kont
--  (auth.users trzyma czas ostatniego logowania). Odwiedzający siedzą w `visit_days`,
--  gdzie jest wyłącznie data - bez godziny - więc tam mowa o DNIU, nie o dobie, i tak to
--  jest podpisane w panelu.
-- =====================================================================

create or replace function panel_glowny()
returns json
language plpgsql
security definer
set search_path = public, storage, auth
as $$
declare res json;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Kokpit jest tylko dla administratora' using errcode = 'check_violation';
  end if;

  select json_build_object(
    /* --- co czeka na decyzję --- */
    'kolejka',              (select count(*) from submissions where status = 'pending'),
    'kolejka_24h',          (select count(*) from submissions
                              where status = 'pending' and created_at > now() - interval '24 hours'),
    'bledy',                (select count(*) from reports where status = 'open'),
    'opinie_nowe',          (select count(*) from feedback where status = 'open'),
    'kandydaci',            (select count(*) from court_leads where status = 'new'),

    /* --- stan bazy --- */
    'boiska',               (select count(*) from courts),
    'boiska_heat',          (select count(*) from courts where basket_approved),
    'boiska_bez_zdjec',     (select count(*) from courts c
                              where not exists (select 1 from court_photos p where p.court_id = c.id)),
    'zdjecia',              (select count(*) from court_photos),
    'podpalenia',           (select coalesce(sum(likes_count), 0) from courts),
    'miast',                (select count(distinct city) from courts),
    'wojewodztw',           (select count(distinct voivodeship) from courts),

    /* --- ludzie --- */
    'konta',                (select count(*) from profiles),
    'konta_24h',            (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'zalogowani_24h',       (select count(*) from auth.users
                              where last_sign_in_at > now() - interval '24 hours'),
    'zablokowani',          (select count(*) from profiles where banned_at is not null),
    'zapisy_na_otwarcie',   (select count(*) from launch_signups),

    /* --- ruch --- */
    'online',               (select count(*) from obecnosc where ostatnio > now() - interval '2 minutes'),
    'goscie_dzis',          (select count(distinct ip_hash) from visit_days where day = current_date),
    'goscie_wczoraj',       (select count(distinct ip_hash) from visit_days where day = current_date - 1),
    'odslony_dzis',         (select coalesce(sum(hits), 0) from visit_days where day = current_date),
    'checkiny_dzis',        (select count(distinct user_id) from checkins where day = current_date),

    /* --- miejsce na dysku --- */
    'storage_bytes',        (select coalesce(sum((metadata ->> 'size')::bigint), 0)
                              from storage.objects where bucket_id = 'court-photos'),
    'db_bytes',             pg_database_size(current_database()),

    /*
      Ostatnio dodane boisko razem ze ścieżką zdjęcia tytułowego. Adres publiczny składa
      sobie przeglądarka - baza nie musi wiedzieć, pod jaką domeną stoi Storage.
    */
    'ostatnie_boisko', (
      select json_build_object(
        'slug', c.slug, 'name', c.name, 'city', c.city, 'voivodeship', c.voivodeship,
        'autor', c.added_by_name, 'kiedy', c.created_at, 'likes', c.likes_count,
        'zdjecie', (select p.storage_path from court_photos p
                     where p.court_id = c.id order by p.sort limit 1)
      )
      from courts c order by c.created_at desc limit 1
    ),

    /* najnowsze opinie - treść skracamy tu, żeby nie ciągnąć dwóch tysięcy znaków na kafelek */
    'opinie', coalesce((
      select json_agg(o) from (
        select f.id, left(f.message, 220) as message, length(f.message) > 220 as ucieta,
               f.contact, f.status, f.created_at,
               coalesce(p.display_name, 'gość') as autor
          from feedback f
          left join profiles p on p.id = f.author_id
         order by f.created_at desc
         limit 4
      ) o
    ), '[]'::json),

    /* ostatnie zgłoszenia w kolejce - żeby było widać, czy to jedna osoba, czy ruch */
    'ostatnie_zgloszenia', coalesce((
      select json_agg(z) from (
        select s.id, s.name, s.city, s.created_at, s.author_name
          from submissions s
         where s.status = 'pending'
         order by s.created_at desc
         limit 4
      ) z
    ), '[]'::json)
  ) into res;

  return res;
end;
$$;

grant execute on function panel_glowny() to authenticated;
