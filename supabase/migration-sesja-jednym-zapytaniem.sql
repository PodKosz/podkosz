-- =====================================================================
--  Sesja użytkownika jednym zapytaniem.
--  Uruchom raz. Nic nie psuje, dopóki nie jest uruchomiona - patrz „zapas" niżej.
--
--  CO SIĘ ZMIENIA
--
--  `/api/sesja` jest wołane z KAŻDEJ strony, przez każdego zalogowanego, przy każdym
--  wejściu - bo od niego zależy pasek nawigacji, przyciski podpalenia i ulubione. Robiło
--  trzy osobne podróże do bazy:
--
--    1. profiles  - nazwa, avatar, rola, blokada
--    2. likes     - co ten człowiek podpalił
--    3. favorites - co ma w ulubionych
--
--  Dwa ostatnie leciały równolegle, więc kosztowały jak jedno - ale profil czekał na
--  swoją kolej, a każda z tych podróży to pełne żądanie HTTP do PostgREST. Teraz jest
--  jedno zapytanie i jedna odpowiedź.
--
--  DLACZEGO `security definer`, skoro to własne dane
--
--  Nie z powodu uprawnień - polityki i tak przepuszczają właściciela do własnych wierszy.
--  Chodzi o to, że funkcja `stable` z jednym planem jest tańsza niż trzy żądania przez
--  warstwę REST, a `auth.uid()` w środku sprawia, że nie da się jej zapytać o kogoś
--  innego: nie przyjmuje żadnego argumentu. Kto nie jest zalogowany, dostaje null.
--
--  ZAPAS PO STRONIE KODU
--
--  `/api/sesja` woła tę funkcję, a gdy baza odpowie „nie ma takiej", spada na trzy stare
--  zapytania. To nie jest ostrożność na zapas: bez tego okno między wydaniem kodu
--  i uruchomieniem migracji oznaczałoby, że KAŻDY zalogowany widzi się jako
--  niezalogowanego - pasek bez konta, puste ulubione, zniknięte podpalenia.
-- =====================================================================

create or replace function public.sesja_uzytkownika()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'nick',       p.display_name,
    'avatar',     p.avatar_url,
    'admin',      coalesce(p.role = 'admin', false),
    'zbanowany',  p.banned_at is not null,
    'podpalenia', coalesce(
                    (select json_agg(l.court_id) from likes l where l.user_id = q.uid),
                    '[]'::json
                  ),
    'ulubione',   coalesce(
                    (select json_agg(f.court_id) from favorites f where f.user_id = q.uid),
                    '[]'::json
                  )
  )
  /*
    Lewe złączenie, nie zwykłe `where p.id = auth.uid()`. Wiersz w `profiles` zakłada
    wyzwalacz po pierwszym zalogowaniu, więc przez chwilę może go nie być - a wtedy
    zapytanie z `where` nie oddałoby ŻADNEGO wiersza i człowiek zobaczyłby się jako
    niezalogowanego. Tak oddaje sesję z pustą nazwą, a nazwę dokłada kod z tokenu.
  */
  from (select auth.uid() as uid) q
  left join profiles p on p.id = q.uid
  where q.uid is not null;
$$;

grant execute on function public.sesja_uzytkownika() to authenticated;

-- ============================================================ kontrola
-- Wołane z panelu SQL (bez sesji) oddaje pusto - to poprawny wynik, nie błąd.
select public.sesja_uzytkownika() as bez_sesji;
