-- =====================================================================
--  Uszczelnienie bezpieczeństwa PodKosza
--  Zamyka nadużycia możliwe przy publicznym kluczu anon: zalew zgłoszeń,
--  zapychanie Storage, podszywanie się pod cudze zgłoszenia, samodzielne
--  nadanie sobie roli administratora i wielokrotną wysyłkę tego samego maila.
-- =====================================================================

/* ---------- 1. rolę administratora nadaje wyłącznie administrator ---------- */
-- Polityka RLS pilnowała tego pośrednio (porównaniem do starej wartości).
-- Wyzwalacz mówi to wprost i działa niezależnie od kolejności polityk.
create or replace function profiles_guard_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin(auth.uid()) then
    raise exception 'Roli nie zmienia się z aplikacji' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role_trigger on profiles;
create trigger profiles_guard_role_trigger
  before update on profiles
  for each row execute function profiles_guard_role();

/* ---------- 2. limity długości tekstów od użytkowników ---------- */
-- Bez nich gość mógł wysłać megabajtowy ciąg w polu „nazwa” i puchnąć bazę.
do $$ begin
  alter table submissions add constraint submissions_text_len check (
    length(name) <= 120 and length(city) <= 80 and length(voivodeship) <= 40
    and length(hours) <= 60 and length(notes) <= 2000
    and length(coalesce(author_name, '')) <= 80
    and length(coalesce(author_email, '')) <= 160
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table reports add constraint reports_comment_len check (length(comment) <= 1000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table feedback add constraint feedback_contact_len check (length(contact) <= 200);
exception when duplicate_object then null; end $$;

/* ---------- 3. limit zgłoszeń boisk z jednego adresu ---------- */
alter table submissions add column if not exists ip_hash text;
create index if not exists submissions_limit_idx on submissions (ip_hash, created_at desc);

create or replace function submissions_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fwd   text := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  parts text[] := string_to_array(coalesce(fwd, ''), ',');
  ip    text := nullif(btrim(coalesce(parts[array_length(parts, 1)], '')), '');
  ile   integer;
begin
  new.ip_hash := md5(coalesce(ip, 'nieznany') || '|podkosz-submission-v1');

  select count(*) into ile
    from submissions s
   where s.created_at > now() - interval '24 hours'
     and (
           (new.author_id is not null and s.author_id = new.author_id)
        or (ip is not null and s.ip_hash = new.ip_hash)
         );

  if ile >= 6 then
    raise exception 'Dzienny limit zgłoszeń z tego urządzenia został wyczerpany. Wróć jutro albo napisz do nas.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists submissions_rate_limit_trigger on submissions;
create trigger submissions_rate_limit_trigger
  before insert on submissions
  for each row execute function submissions_rate_limit();

/* ---------- 4. zdjęcia tylko do własnego, świeżego zgłoszenia ---------- */
-- Wcześniej `with check (true)`: dało się dopiąć wiersze do cudzego zgłoszenia
-- albo wskazać dowolną ścieżkę w Storage.
create or replace function submission_open(sub uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from submissions s
     where s.id = sub
       and s.status = 'pending'
       and s.created_at > now() - interval '1 hour'
       and (s.author_id is null or s.author_id = auth.uid())
  );
$$;

grant execute on function submission_open(uuid) to anon, authenticated;

-- Liczenie zdjęć musi iść przez funkcję security definer: polityka odpytująca własną
-- tabelę powoduje „infinite recursion detected in policy” (sprawdzone na żywym API).
create or replace function submission_photo_room(sub uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select (select count(*) from submission_photos p where p.submission_id = sub) < 12;
$$;

grant execute on function submission_photo_room(uuid) to anon, authenticated;

drop policy if exists submission_photos_insert on submission_photos;
create policy submission_photos_insert on submission_photos for insert
  with check (submission_open(submission_id) and submission_photo_room(submission_id));

/* ---------- 5. Storage: wgrywanie tylko pod otwarte zgłoszenie ---------- */
-- Ścieżka musi wyglądać tak: zgloszenia/<id zgłoszenia>/<plik>, a zgłoszenie
-- musi istnieć, być świeże i mieć mniej niż 12 plików. Dzięki temu zapychanie
-- dysku jest ograniczone tym samym limitem, co liczba zgłoszeń na dobę.
create or replace function submission_upload_allowed(path text)
returns boolean language plpgsql security definer stable set search_path = public, storage as $$
declare
  parts text[] := string_to_array(path, '/');
  sub   uuid;
begin
  if array_length(parts, 1) < 3 or parts[1] <> 'zgloszenia' then
    return false;
  end if;

  begin
    sub := parts[2]::uuid;
  exception when others then
    return false;
  end;

  if not submission_open(sub) then
    return false;
  end if;

  return (
    select count(*) from storage.objects o
     where o.bucket_id = 'court-photos'
       and o.name like 'zgloszenia/' || parts[2] || '/%'
  ) < 12;
end $$;

grant execute on function submission_upload_allowed(text) to anon, authenticated;

drop policy if exists court_photos_upload on storage.objects;
create policy court_photos_upload on storage.objects for insert
  with check (bucket_id = 'court-photos' and submission_upload_allowed(name));

-- zdjęcia z telefonu ważą ~0,5 MB; 4 MB to i tak duży zapas, a mniejszy limit
-- ogranicza szkody przy próbie zapchania dysku
update storage.buckets
   set file_size_limit = 4194304,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'court-photos';

/* ---------- 6. mail z opinią wysyłany dokładnie raz ---------- */
alter table feedback add column if not exists mailed_at timestamptz;

-- Funkcja „zaklepuje” opinię do wysyłki: pierwsze wywołanie zwraca true,
-- każde kolejne false. Bez tego dało się wielokrotnie uderzyć w endpoint
-- pocztowy tą samą treścią i zasypać skrzynkę.
create or replace function feedback_claim_for_mail(msg text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  claimed uuid;
begin
  update feedback f
     set mailed_at = now()
   where f.id = (
     select id from feedback
      where message = btrim(msg)
        and mailed_at is null
        and created_at > now() - interval '5 minutes'
      order by created_at desc
      limit 1
      for update skip locked
   )
  returning f.id into claimed;

  return claimed is not null;
end $$;

grant execute on function feedback_claim_for_mail(text) to anon, authenticated;

-- stara funkcja była wyrocznią: pozwalała sprawdzać, czy dana treść jest w bazie
drop function if exists feedback_recent_exists(text);

/* ---------- kontrola ---------- */
select
  (select count(*) from pg_policies where schemaname = 'public') as polityki_public,
  (select count(*) from pg_policies where tablename = 'objects' and schemaname = 'storage') as polityki_storage,
  (select file_size_limit from storage.buckets where id = 'court-photos') as limit_pliku;
