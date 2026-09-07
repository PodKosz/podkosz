-- =====================================================================
--  Tarcza: limity i sufity na wszystkim, co jest otwarte dla świata.
--  Uruchom raz, w całości. Świeże projekty dostają to samo w schema.sql.
--
--  Rzecz, którą trzeba wiedzieć przed czytaniem: KLUCZ "anon" JEST PUBLICZNY.
--  Leży w kodzie strony, bo musi - to on pozwala przeglądarce czytać boiska bez
--  logowania. Znaczy to, że każda funkcja nadana roli anon jest wołalna wprost,
--  z konsoli, w pętli, bez otwierania naszej strony. Limity w kodzie tras
--  (lib/limity.ts) chronią więc tylko przed leniwym atakiem; wszystko, co ma
--  naprawdę trzymać, musi stać tutaj.
-- =====================================================================

-- ============================================================ 1. zapisy na otwarcie
--  Było: grant insert on launch_signups to anon plus zapis przez naszą trasę.
--  Czyli dwa wejścia, oba bez licznika:
--    - wprost do tabeli, kluczem publicznym: miliony wierszy, adresy dowolnej długości,
--    - przez trasę: KAŻDY nowy adres dostaje list z naszej domeny. Tysiąc różnych
--      adresów to tysiąc listów do obcych ludzi - maszynka do zasypywania cudzych
--      skrzynek i najkrótsza droga do spalenia reputacji domeny.
--  Teraz: jedno wejście (funkcja poniżej) i trzy liczniki: na adres IP, na dobę
--  i na cały serwis. Adres IP podaje trasa, bo wołana z serwera baza widzi adres
--  naszej funkcji, nie odwiedzającego - w bazie i tak zostaje sam skrót.

alter table public.launch_signups add column if not exists ip_hash text;
create index if not exists launch_signups_limit_idx
  on public.launch_signups (ip_hash, created_at desc);

-- tylko przez funkcję - wprost do tabeli nie wchodzi już nikt
drop policy if exists launch_signups_insert on public.launch_signups;
revoke insert on table public.launch_signups from anon, authenticated;

create or replace function public.zapis_na_otwarcie(p_email text, p_ip text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mail  text := lower(btrim(coalesce(p_email, '')));
  hash  text := md5(coalesce(nullif(btrim(coalesce(p_ip, '')), ''), 'nieznany') || '|podkosz-zapis-v1');
  ile   integer;
begin
  if length(mail) > 200
     or mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'To nie wygląda na adres e-mail.' using errcode = 'check_violation';
  end if;

  -- pięć na godzinę z jednego adresu: człowiek zapisuje się raz, może dwa razy z literówką
  select count(*) into ile
    from launch_signups
   where ip_hash = hash and created_at > now() - interval '1 hour';
  if ile >= 5 then return 'limit'; end if;

  select count(*) into ile
    from launch_signups
   where ip_hash = hash and created_at > now() - interval '24 hours';
  if ile >= 20 then return 'limit'; end if;

  -- Sufit na cały serwis. Żeby go dobić przy limicie pięciu na adres, trzeba stu
  -- dwudziestu różnych adresów IP w ciągu godziny - czyli to już nie pomyłka, tylko
  -- botnet, a wtedy godzina ciszy na zapisach jest właściwą odpowiedzią. Bez tego
  -- sufitu botnet zamienia się w wysyłkę stu tysięcy listów z naszej domeny.
  select count(*) into ile from launch_signups where created_at > now() - interval '1 hour';
  if ile >= 600 then return 'limit'; end if;

  insert into launch_signups (email, ip_hash)
  values (mail, hash)
  on conflict (email) do nothing;

  if not found then return 'byl'; end if;
  return 'nowy';
end;
$$;

revoke all on function public.zapis_na_otwarcie(text, text) from public;
grant execute on function public.zapis_na_otwarcie(text, text) to anon, authenticated;

-- ============================================================ 2. statystyki i obecność
--  log_visit_ip(text) i puls_obecnosci(text) biorą adres IP JAKO PARAMETR i są
--  nadane roli anon - czyli kluczem publicznym da się wołać je wprost i podawać
--  za każdym razem inny adres. Każdy inny adres to nowy wiersz, więc tabele rosły
--  bez sufitu, a licznik "ilu jest teraz" pokazywał, co się komu podoba.
--
--  Uwierzytelnić tu nikogo nie można (klucz publiczny to klucz publiczny), więc
--  zamiast tego OGRANICZAMY SZKODĘ: dobowy sufit liczby różnych skrótów, próg czasu
--  między zapisami tego samego skrótu i sprzątanie starych wierszy przy zapisie.
--  Te liczby są statystyką w panelu, nie zabezpieczeniem - ważne, żeby nie dało się
--  nimi urosnąć bazie.

create or replace function public.log_visit_ip(in_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ip   text := nullif(btrim(coalesce(in_ip, '')), '');
  hash text;
  ile  integer;
begin
  if ip is null then return; end if;
  hash := md5(ip || '|podkosz-visits-v1');

  -- znany skrót: zwykłe dobicie licznika, z sufitem na wiersz
  update visit_days
     set hits = least(hits + 1, 100000)
   where ip_hash = hash and day = current_date;
  if found then return; end if;

  -- Nowy skrót. Dwadzieścia tysięcy różnych adresów na dobę to wielokrotność
  -- realnego ruchu, a zarazem sufit, powyżej którego liczba i tak nic nie znaczy.
  select count(*) into ile from visit_days where day = current_date;
  if ile >= 20000 then return; end if;

  insert into visit_days (ip_hash, day, hits)
  values (hash, current_date, 1)
  on conflict (ip_hash, day) do update set hits = least(visit_days.hits + 1, 100000);
end;
$$;

create or replace function public.puls_obecnosci(in_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ip   text := nullif(btrim(coalesce(in_ip, '')), '');
  hash text;
  ile  integer;
begin
  if ip is null then return; end if;
  hash := md5(ip || '|podkosz-visits-v1');

  -- Znany skrót: odświeżamy, ale nie częściej niż raz na dwadzieścia sekund. Puls
  -- z przeglądarki idzie co czterdzieści pięć, więc to zapas na kilka kart, a nie
  -- zaproszenie do pisania w pętli.
  update obecnosc set ostatnio = now()
   where ip_hash = hash and ostatnio < now() - interval '20 seconds';
  if found then return; end if;

  if exists (select 1 from obecnosc where ip_hash = hash) then return; end if;

  -- sprzątanie przy okazji - inaczej tabela żyje do następnego wejścia w panel
  if random() < 0.02 then
    delete from obecnosc where ostatnio < now() - interval '1 day';
  end if;

  select count(*) into ile from obecnosc;
  if ile >= 5000 then return; end if;

  insert into obecnosc (ip_hash, ostatnio)
  values (hash, now())
  on conflict (ip_hash) do update set ostatnio = now();
end;
$$;

-- ============================================================ 3. wyniki minigry
--  Wynik przychodzi z przeglądarki, więc z konsoli dało się wpisać jedną linijkę
--  i stanąć na czele rankingu z pięciuset. Uczciwie: WYNIKU Z PRZEGLĄDARKI NIE DA
--  SIĘ ZWERYFIKOWAĆ bez przeliczenia całej rozgrywki na serwerze. Da się natomiast
--  zabrać najłatwiejszą drogę i podpiąć wynik pod CZAS, w którym fizycznie mógł
--  powstać:
--    - runda musi być otwarta funkcją minigra_start,
--    - wynik nie może przekroczyć tego, co da się zrobić w czasie od jej otwarcia,
--    - runda gaśnie po użyciu, więc każdy zapis potrzebuje świeżej.
--  Kto chce oszukać, musi teraz odczekać swoje przy każdej próbie - a ranking nie
--  pokaże liczby, której nie da się zrobić w minutę.

create table if not exists public.minigra_rundy (
  user_id  uuid not null references profiles(id) on delete cascade,
  miejsce  text not null,
  zaczeta  timestamptz not null default now(),
  primary key (user_id, miejsce)
);

alter table public.minigra_rundy enable row level security;
-- bez polityk: tabela jest widoczna tylko dla funkcji poniżej

create or replace function public.minigra_start(p_miejsce text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if p_miejsce is null or p_miejsce not in ('venice', 'manhattan', 'chicago') then
    raise exception 'Nieznane miejsce.';
  end if;

  insert into minigra_rundy (user_id, miejsce, zaczeta)
  values (uid, p_miejsce, now())
  on conflict (user_id, miejsce) do update set zaczeta = now();
end;
$$;

revoke all on function public.minigra_start(text) from public;
grant execute on function public.minigra_start(text) to authenticated;

create or replace function public.minigra_zapisz(p_miejsce text, p_seria integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  wynik     integer;
  poczatek  timestamptz;
  sekundy   double precision;
  maks      integer;
begin
  if uid is null then
    return null;
  end if;

  -- chicago doszło razem z grą w kozły
  if p_miejsce is null or p_miejsce not in ('venice', 'manhattan', 'chicago') then
    raise exception 'Nieznane miejsce.';
  end if;

  if zbanowany(uid) then
    raise exception 'Konto jest zablokowane.';
  end if;

  select zaczeta into poczatek
    from minigra_rundy
   where user_id = uid and miejsce = p_miejsce;

  if poczatek is null then
    raise exception 'Runda nie została rozpoczęta.' using errcode = 'check_violation';
  end if;

  sekundy := extract(epoch from now() - poczatek);
  if sekundy > 7200 then
    raise exception 'Runda wygasła.' using errcode = 'check_violation';
  end if;

  -- Ile najwyżej można zdobyć w danym czasie.
  --   - kozły: jedno kliknięcie to jedno kozłowanie, dziesięć na sekundę to i tak
  --     więcej, niż da się wyklikać palcem,
  --   - rzuty: jeden rzut to celowanie plus 0,55 s lotu plus powrót piłki, więc
  --     nawet 1,2 na sekundę jest hojne.
  -- Plus stały zapas dziesięciu, żeby zaokrąglenia i opóźnienie sieci nikomu nie
  -- zabrały uczciwego wyniku.
  maks := 10 + ceil(sekundy * case p_miejsce when 'chicago' then 10 else 1.2 end);

  if p_seria > maks then
    raise exception 'Wynik niemożliwy w tym czasie (% w % s).', p_seria, round(sekundy)
      using errcode = 'check_violation';
  end if;

  -- runda gaśnie po użyciu - następny zapis potrzebuje nowej
  delete from minigra_rundy where user_id = uid and miejsce = p_miejsce;

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

-- ---------- ograniczenie na miejsce w tabeli wyników ----------
alter table public.minigra_wyniki drop constraint if exists minigra_wyniki_miejsce_check;
alter table public.minigra_wyniki
  add constraint minigra_wyniki_miejsce_check
  check (miejsce in ('venice', 'manhattan', 'chicago'));

-- ============================================================ sprzątanie po testach
--  Sprawdzając ścieżkę zapisu na otwarcie (i limit pięciu na minutę) wpisałem do bazy
--  sześć sztucznych adresów w domenie example.com. Domena jest zarezerwowana przez IANA
--  właśnie do takich rzeczy i nikt jej nie używa, więc usunięcie po niej jest bezpieczne -
--  ale zostawione w tabeli dostałyby list o otwarciu jak każdy inny zapis.
delete from public.launch_signups where email like '%@example.com';

-- ============================================================ kontrola
select 'zapisy' as co, count(*) as ile from public.launch_signups
union all select 'wizyty dziś', count(*) from public.visit_days where day = current_date
union all select 'obecni', count(*) from public.obecnosc
union all select 'wyniki minigry', count(*) from public.minigra_wyniki;
