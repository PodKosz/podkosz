-- =====================================================================
--  Brama logowania i zasięg: Polska.
--  Uruchom raz. Świeże projekty dostają to samo w schema.sql.
--
--  Dwie zmiany, obie w politykach zapisu:
--    1. Zgłoszenie boiska i zgłoszenie poprawki wymagają KONTA. Do tej pory oba
--       przyjmowały wiersz z `author_id`/`reporter_id` równym null, czyli od gościa.
--    2. Boiska wolno dodawać TYLKO W POLSCE - z wyjątkiem administratora.
--
--  Okno „musisz się zalogować" w interfejsie jest wygodą, nie zabezpieczeniem: klucz
--  „anon" jest publiczny, więc wpis dawało się zrobić wprost z konsoli, pomijając całą
--  stronę. Dlatego warunek stoi tutaj.
-- =====================================================================

-- ============================================================ 1. zgłoszenia boisk
--  Prostokąt zamiast granicy, i to jest świadomy kompromis: baza nie zna kształtu
--  Polski, a dokładny test („punkt w wielokącie") wymagałby wgrania granicy kraju jako
--  danych i rozszerzenia PostGIS. Prostokąt bierze przy okazji kawał Czech, Słowacji,
--  Litwy i obwodu kaliningradzkiego - ale nie wpuszcza już boiska z Hiszpanii ani
--  z Tajlandii, a granicę rozstrzyga strona: kreator pyta geokoder o KOD KRAJU
--  i przy odpowiedzi innej niż „pl" nie pozwala przejść dalej (patrz `lib/polska.ts`).
--  Tu zostaje siatka bezpieczeństwa na wypadek pominięcia kreatora.

drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and not zbanowany(auth.uid())
    and (
      is_admin(auth.uid())
      or (lat between 48.9 and 55.05 and lng between 13.9 and 24.35)
    )
  );

-- Zdjęcia dopina się do OTWARTEGO, WŁASNEGO zgłoszenia. Gałąź „author_id is null"
-- była potrzebna, dopóki zgłoszenia mogły być anonimowe - teraz nie mogą, a zostawiona
-- otwierałaby dopinanie zdjęć do wierszy bez autora.
create or replace function submission_open(sub uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from submissions s
     where s.id = sub
       and s.status = 'pending'
       and s.created_at > now() - interval '1 hour'
       and s.author_id = auth.uid()
  );
$$;

grant execute on function submission_open(uuid) to anon, authenticated;

-- ============================================================ 2. zgłoszenia poprawek
--  Zgłoszenie poprawki zmienia to, co inni widzą na mapie (moderacja bierze je pod
--  uwagę), więc idzie za bramką razem z podpalaniem i ulubionymi. Limit „jedno na
--  boisko na dobę" zostaje bez zmian - teraz liczy się po koncie, a nie po adresie IP,
--  bo adres da się zmienić, a konta nie.

drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert
  with check (
    auth.uid() is not null
    and reporter_id = auth.uid()
    and not zbanowany(auth.uid())
  );

-- ============================================================ kontrola
select 'zgłoszenia bez autora' as co, count(*)::text as ile
  from submissions where author_id is null
union all select 'poprawki bez autora', count(*)::text from reports where reporter_id is null
union all select 'zgłoszenia poza prostokątem Polski', count(*)::text
  from submissions
 where lat not between 48.9 and 55.05 or lng not between 13.9 and 24.35;
