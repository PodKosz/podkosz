-- =====================================================================
--  Płomień na pinezce: ile osób wybiera się dziś na każde boisko
--
--  Mapa potrzebuje tego dla WSZYSTKICH boisk naraz, a nie po jednym - `checkins_osoby`
--  odpowiada na pytanie o jedno boisko i przy kilkuset pinezkach byłoby to kilkaset
--  zapytań. Ta funkcja zwraca od razu całą listę, i tylko te boiska, na które ktoś się
--  dziś zapisał: pusty wynik to znacznie mniej danych niż zera dla każdego boiska.
--
--  Tabela `checkins` jest zamknięta politykami (kto gdzie bywa, to nie jest publiczna
--  informacja), więc funkcja jest SECURITY DEFINER - ale oddaje wyłącznie liczby, bez
--  identyfikatorów kont. Dokładnie tyle, ile widać na karcie boiska.
-- =====================================================================

create or replace function public.checkiny_dzisiaj()
returns table (court_id uuid, osoby integer)
language sql stable security definer set search_path = public as $$
  select c.court_id, count(distinct c.user_id)::integer
    from checkins c
   where c.day = current_date
   group by c.court_id;
$$;

grant execute on function public.checkiny_dzisiaj() to anon, authenticated;

/* ---------- kontrola ---------- */
select * from public.checkiny_dzisiaj();
