-- =====================================================================
--  Zmiana nazwy wyróżnienia: "muala" -> "heat"
--  Uruchom raz na bazie założonej wcześniejszą wersją schema.sql.
--  Świeże projekty mają już poprawną nazwę i tego pliku nie potrzebują.
-- =====================================================================

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'courts' and column_name = 'muala') then
    alter table courts rename column muala to heat;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'submissions' and column_name = 'muala') then
    alter table submissions rename column muala to heat;
  end if;
end $$;

-- funkcja publikująca odwołuje się do kolumny po nazwie — odtwarzamy ją
create or replace function approve_submission(sub_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s        submissions%rowtype;
  new_slug text;
  n        integer := 1;
  new_id   uuid;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator może akceptować zgłoszenia';
  end if;

  select * into s from submissions where id = sub_id;
  if not found then raise exception 'Nie ma takiego zgłoszenia'; end if;
  if s.court_id is not null then return s.court_id; end if;

  new_slug := pl_slugify(s.city) || '-' || pl_slugify(s.name);
  while exists (select 1 from courts where slug = new_slug) loop
    n := n + 1;
    new_slug := pl_slugify(s.city) || '-' || pl_slugify(s.name) || '-' || n;
  end loop;

  insert into courts (slug, name, city, voivodeship, lat, lng, type, surface, hoops,
                      lit, fenced, access, hours, description, heat, added_by, added_by_name)
  values (new_slug, s.name, s.city, s.voivodeship, s.lat, s.lng, s.type, s.surface, s.hoops,
          s.lit, s.fenced, s.access, s.hours,
          coalesce(nullif(s.notes, ''), 'Boisko dodane przez społeczność.'),
          s.heat, s.author_id, coalesce(s.author_name, 'gość'))
  returning id into new_id;

  insert into court_photos (court_id, kind, storage_path, sort)
  select new_id, kind, storage_path, sort from submission_photos where submission_id = sub_id;

  update submissions
     set status = 'approved', court_id = new_id,
         reviewed_at = now(), reviewed_by = auth.uid(), reject_reason = null
   where id = sub_id;

  return new_id;
end $$;

select 'gotowe: kolumna heat + zaktualizowana funkcja approve_submission' as wynik;
