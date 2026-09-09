-- =====================================================================
--  Okno licznika obecności: dwie minuty -> pięć.
--  Uruchom raz, po `migration-obecnosc.sql`.
--
--  CO SIĘ ZMIENIA I DLACZEGO
--
--  Puls obecności szedł z przeglądarki co 45 sekund. Przy stu otwartych kartach to dwa
--  żądania na sekundę, przy trzystu - prawie siedem, i to bez przerwy: tyle samo wywołań
--  funkcji na Vercelu i tyle samo zapisów tutaj. Cała ta praca utrzymywała jedną liczbę
--  w panelu administratora.
--
--  Puls idzie teraz co 150 sekund (`PULS_MS` w `components/VisitPing.tsx`). Te dwie
--  liczby są sprzężone: okno musi być na tyle szerokie, żeby wybaczyć jedno zgubione
--  uderzenie, inaczej połowa ludzi wypada z licznika w przerwie między pulsami.
--
--    było:  puls 45 s,  okno 2 min  (mieści dwa uderzenia z zapasem)
--    jest:  puls 150 s, okno 5 min  (mieści dwa uderzenia z zapasem)
--
--  Ten sam stosunek, jedna trzecia ruchu. Licznik pokazuje teraz „ilu było na stronie
--  w ostatnich pięciu minutach" - dla liczby, na którą patrzy się raz na godzinę, to ta
--  sama informacja.
--
--  Sprzątanie starych wierszy zostaje bez zmian: tabela ma jeden wiersz na odwiedzającego,
--  a wiersze starsze niż doba znikają przy odczycie.
-- =====================================================================

create or replace function public.ilu_online()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ilu integer;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Tylko administrator.';
  end if;

  delete from obecnosc where ostatnio < now() - interval '1 day';

  select count(*)::integer into ilu
    from obecnosc
   where ostatnio > now() - interval '5 minutes';

  return ilu;
end;
$$;

revoke all on function public.ilu_online() from public;
grant execute on function public.ilu_online() to authenticated;

-- ============================================================ kontrola
select count(*) filter (where ostatnio > now() - interval '5 minutes') as w_oknie,
       count(*)                                                        as sledzonych
  from public.obecnosc;
