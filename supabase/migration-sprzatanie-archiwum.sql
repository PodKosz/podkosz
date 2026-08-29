-- =====================================================================
--  Archiwum usuniętych kont sprząta się przy odczycie
--
--  `sprzataj_usuniete_konta()` wołane było tylko przy usuwaniu i przywracaniu konta.
--  Jeśli przez pół roku nie zrobisz ani jednego, wpisy po 180 dniach po prostu leżą dalej -
--  a obietnica brzmi „znika bezpowrotnie", nie „znika, gdy coś jeszcze skasujesz".
--
--  Najtańsze pewne miejsce to odczyt listy w panelu: wchodzisz na zakładkę kont, lista
--  jest już posprzątana. Funkcja przestaje być `stable` (bo kasuje), więc trzeba ją
--  napisać jako plpgsql zwracające zbiór.
-- =====================================================================

drop function if exists lista_usunietych_kont();

create or replace function lista_usunietych_kont()
returns table (
  id             uuid,
  email          text,
  display_name   text,
  avatar_url     text,
  usuniete_at    timestamptz,
  wygasa_at      timestamptz,
  oczekuje       boolean,
  przywrocone_at timestamptz,
  dane           jsonb
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    return;
  end if;

  perform sprzataj_usuniete_konta();

  return query
    select k.id, k.email, k.display_name, k.avatar_url, k.usuniete_at, k.wygasa_at,
           k.oczekuje, k.przywrocone_at, k.dane
      from konta_usuniete k
     order by k.usuniete_at desc;
end $$;

grant execute on function lista_usunietych_kont() to authenticated;
