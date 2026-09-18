-- =====================================================================
--  Boisko dodaje tylko zalogowany
--
--  DECYZJA PRODUKTOWA, NIE TECHNICZNA
--
--  Do tej pory boisko mógł dodać każdy, także bez konta. To było celowe - próg wejścia
--  miał być zerowy. Zmieniamy to świadomie, bo zerowy próg ma drugą stronę:
--
--    - zgłoszenia bez konta nie mają z kim rozmawiać. Gdy coś jest nie tak ze zdjęciem
--      albo z pinezką, nie ma komu zadać pytania i wpis trzeba odrzucić w ciemno;
--    - nie ma czego zablokować. Konto da się zbanować (`zbanowany`), przeglądarki nie;
--    - autor nie dostaje nic w zamian - ani wpisu w rankingu odkrywców, ani odznaczeń,
--      ani powiadomienia o publikacji. Praca wykonana na boisku znika z jego perspektywy.
--
--  SPRAWDZONE PRZED ZMIANĄ, nie założone: pusty klucz anonimowy przechodził przez
--  uprawnienia i wywracał się dopiero na sprawdzeniu typu kolumny - czyli furtka
--  była realnie otwarta, a nie tylko opisana w starym pliku.
--
--  DWIE RZECZY NAPRAWIAMY PRZY OKAZJI
--
--  1. `author_id = auth.uid()` zamiast `author_id is null or author_id = auth.uid()`.
--     Stara wersja pozwalała ZALOGOWANEMU wysłać zgłoszenie z pustym autorem, czyli
--     podszyć się pod gościa i uciec spod własnego bana.
--
--  2. Zdjęcia zgłoszenia mógł dopiąć KTOKOLWIEK, kto znał jego identyfikator - polityka
--     sprawdzała tylko, czy zgłoszenie jest otwarte i czy ma miejsce. Teraz sprawdza
--     jeszcze, czy to autor. Identyfikator jest losowy, więc to nie była dziura do
--     wykorzystania z ulicy, ale opierała się wyłącznie na tym, że nikt go nie zgadnie.
--
--  CZEGO TA MIGRACJA NIE RUSZA
--
--  Starych zgłoszeń bez autora. Zostają, bo są prawdziwe - ktoś je zrobił, stojąc na
--  boisku. Panel pokazuje przy nich „gość" i tak ma zostać.
--
--  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
-- =====================================================================

/* ---------- 1. zgłoszenie zakłada wyłącznie zalogowany, we własnym imieniu ---------- */
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and not zbanowany(auth.uid())
  );

/* ---------- 2. zdjęcia dopina autor zgłoszenia, nie ktokolwiek ---------- */
drop policy if exists submission_photos_insert on submission_photos;
create policy submission_photos_insert on submission_photos for insert
  with check (
    auth.uid() is not null
    and submission_open(submission_id)
    and submission_photo_room(submission_id)
    and exists (
      select 1 from submissions s
       where s.id = submission_id
         and s.author_id = auth.uid()
    )
  );

/*
  ---------- 3. rola anonimowa traci prawo zapisu ----------

  Polityka wystarczyłaby sama, ale nadanie zostawione „na wszelki wypadek" to dokładnie
  ten rodzaj resztki, który ożywa przy następnej zmianie polityki. Skoro gość nie pisze,
  niech nie ma czym.
*/
revoke insert on submissions from anon;
revoke insert on submission_photos from anon;

-- ============================================================ kontrola

-- 1. Czy polityki mają już warunek na zalogowanie.
select polname,
       position('uid() IS NOT NULL' in pg_get_expr(polwithcheck, polrelid)) > 0 as wymaga_zalogowania
  from pg_policy
 where polname in ('submissions_insert', 'submission_photos_insert');

-- 2. Czy anon faktycznie stracił zapis - obie liczby mają być zerami.
select table_name, count(*) as nadan_insert_dla_anon
  from information_schema.role_table_grants
 where grantee = 'anon'
   and table_name in ('submissions', 'submission_photos')
   and privilege_type = 'INSERT'
 group by table_name;

-- 3. Ile starych zgłoszeń bez autora zostaje (mają zostać - to prawdziwe wpisy).
select count(*) filter (where author_id is null) as bez_autora,
       count(*) filter (where author_id is not null) as z_kontem,
       count(*) as wszystkich
  from submissions;
