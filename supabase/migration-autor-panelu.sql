/*
  Autorstwo boisk dodanych z panelu.

  Wpisy redakcyjne (przycisk „Dodaj ręcznie") miały dotąd tylko podpis w `added_by_name`,
  bez `added_by`. Wszystko, co łączyło administratora z jego boiskami, wisiało więc na
  nicku: zmiana podpisu odcinałaby go od własnych wpisów, a każde miejsce w kodzie musiało
  liczyć boiska „po nazwie".

  Ten skrypt dopisuje istniejącym wpisom identyfikator konta administratora - tylko tam,
  gdzie podpis zgadza się z jego nickiem. Nowe boiska dostają go już przy zapisie
  (`autorPanelu()` w lib/admin.ts).

  Uruchom raz w SQL editorze Supabase. Można bezpiecznie puścić drugi raz - bierze pod
  uwagę wyłącznie wiersze bez `added_by`.
*/

/* ---------- 1. co się zmieni ---------- */
select c.slug, c.added_by_name, p.id as konto
  from courts c
  join profiles p
    on p.role = 'admin'
   and lower(c.added_by_name) = lower(coalesce(p.display_name, ''))
 where c.added_by is null
 order by c.slug;

/* ---------- 2. dopisanie właściciela ---------- */
update courts c
   set added_by = p.id
  from profiles p
 where c.added_by is null
   and p.role = 'admin'
   and lower(c.added_by_name) = lower(coalesce(p.display_name, ''));

/* ---------- 3. kontrola ---------- */
/*
  Po migracji bez właściciela zostają tylko boiska ze zgłoszeń anonimowych (podpis „gosc")
  i te opublikowane pod czyimś innym nickiem.
*/
select coalesce(added_by_name, '-') as podpis,
       count(*)                    as boisk,
       count(added_by)             as z_kontem
  from courts
 group by 1
 order by 2 desc;
