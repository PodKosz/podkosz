-- =====================================================================
--  Minigra „rzut do kosza" - tablice wyników
--
--  Dwa miejsca (Venice Beach i Manhattan) mają osobne rankingi, więc kluczem jest para
--  (miejsce, konto). Trzymamy wyłącznie NAJLEPSZY wynik danej osoby w danym miejscu -
--  historia rzutów nie jest do niczego potrzebna, a tabela nie rośnie w nieskończoność.
--
--  Grać może każdy, ale do rankingu wchodzą tylko konta: bez logowania nie ma czego
--  podpisać. Zapis idzie funkcją SECURITY DEFINER, żeby nikt nie mógł wstawić wyniku
--  pod cudzym identyfikatorem ani obniżyć komuś rekordu.
-- =====================================================================

create table if not exists public.minigra_wyniki (
  miejsce    text not null check (miejsce in ('venice', 'manhattan')),
  user_id    uuid not null references profiles(id) on delete cascade,
  seria      integer not null check (seria >= 0 and seria <= 500),
  updated_at timestamptz not null default now(),
  primary key (miejsce, user_id)
);

create index if not exists minigra_ranking_idx
  on public.minigra_wyniki (miejsce, seria desc, updated_at);

alter table public.minigra_wyniki enable row level security;

/*
  Tabeli nikt nie rusza wprost - ani do zapisu, ani do odczytu. Ranking wychodzi funkcją,
  która dokłada nick i awatar z profilu, a zapis idzie osobną funkcją z kontrolą.
*/
grant select on table public.minigra_wyniki to authenticated;

drop policy if exists minigra_wlasny on public.minigra_wyniki;
create policy minigra_wlasny on public.minigra_wyniki
  for select using (user_id = auth.uid());

/* ---------- zapis wyniku ---------- */
/*
  Zapisujemy tylko wtedy, gdy nowa seria bije poprzednią. Dzięki temu wielokrotne wysłanie
  tego samego wyniku nic nie zmienia, a gorszy przebieg nie kasuje rekordu.

  To jest easter egg, nie turniej: wynik przychodzi z przeglądarki, więc ktoś uparty go
  podrobi. Górna granica pilnuje tylko, żeby tablica nie zamieniła się w listę liczb
  z kosmosu; poza tym świadomie nie budujemy tu żadnej obrony.
*/
create or replace function public.minigra_zapisz(p_miejsce text, p_seria integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  wynik  integer;
begin
  if uid is null then
    return null;
  end if;

  if p_miejsce is null or p_miejsce not in ('venice', 'manhattan') then
    raise exception 'Nieznane miejsce.';
  end if;

  if zbanowany(uid) then
    raise exception 'Konto jest zablokowane.';
  end if;

  insert into minigra_wyniki (miejsce, user_id, seria)
  values (p_miejsce, uid, greatest(0, least(coalesce(p_seria, 0), 500)))
  on conflict (miejsce, user_id) do update
    set seria = greatest(minigra_wyniki.seria, excluded.seria),
        updated_at = case
          when excluded.seria > minigra_wyniki.seria then now()
          else minigra_wyniki.updated_at
        end
  returning seria into wynik;

  return wynik;
end;
$$;

revoke all on function public.minigra_zapisz(text, integer) from public;
grant execute on function public.minigra_zapisz(text, integer) to authenticated;

/* ---------- ranking ---------- */
/*
  Publiczny: tablicę wyników widzą wszyscy, także niezalogowani - inaczej nie byłoby po co
  grać. Funkcja oddaje sam nick i awatar, więc identyfikatory kont zostają w bazie.
*/
create or replace function public.minigra_ranking(p_miejsce text, p_ile integer default 20)
returns table (nick text, avatar text, seria integer, kiedy timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(p.display_name), ''), 'gracz'),
         p.avatar_url,
         w.seria,
         w.updated_at
    from minigra_wyniki w
    join profiles p on p.id = w.user_id
   where w.miejsce = p_miejsce
     and p.banned_at is null
   order by w.seria desc, w.updated_at
   limit greatest(1, least(coalesce(p_ile, 20), 100));
$$;

grant execute on function public.minigra_ranking(text, integer) to anon, authenticated;

/* ---------- kontrola ---------- */
select count(*) as wynikow from public.minigra_wyniki;
