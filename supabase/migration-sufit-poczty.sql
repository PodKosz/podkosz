-- =====================================================================
--  Dzienny sufit wysyłki poczty
--
--  ------------------------------------------------------------------ czego NIE da się zrobić
--
--  W kokpicie stało „ustawić dzienny limit wysyłki w Resend". Takiego ustawienia
--  w Resend NIE MA i nigdy nie było - sprawdzone w ich dokumentacji (Usage Limits):
--
--    - limit tempa to 10 żądań na sekundę na zespół i podnosi się go na prośbę,
--      a nie obniża w panelu;
--    - dzienny limit istnieje, ale jest WŁAŚCIWOŚCIĄ PLANU, nie przełącznikiem:
--      „The daily quota applies only to the Free plan (...) Paid sending plans have
--      no daily quota, only the monthly limit".
--
--  Czyli dziś chroni nas cudzy limit darmowego planu (100 listów na dobę), a w dniu
--  przejścia na plan płatny ta ochrona ZNIKA. Dokładnie wtedy, gdy zaczyna być
--  potrzebna. Dlatego sufit musi stać po naszej stronie i dlatego stoi tutaj.
--
--  ------------------------------------------------------------------ dlaczego w bazie, a nie w kodzie
--
--  Bo licznik w pamięci funkcji na Vercelu jest tym luźniejszy, im większy ruch -
--  ta sama pułapka, co w `lib/limity.ts`. Przy jednej instancji sufit trzyma, przy
--  dziesięciu przepuszcza dziesięciokrotność. Zapora rozpuszcza się dokładnie wtedy,
--  gdy zaczyna być potrzebna. Poczta jest rzadka i droga, więc stać ją na jedno
--  zapytanie do bazy przed wysłaniem.
--
--  ------------------------------------------------------------------ kto może podbić licznik
--
--  Funkcja jest nadana rolom `anon` i `authenticated`, bo wysyłkę wywołują też trasy
--  obsługujące gościa (zapis na otwarcie). Gdyby liczyła po samej liczbie listów,
--  każdy z kluczem anonimowym - a ten jedzie w paczce JS każdej strony - mógłby wywołać
--  ją z sufitem i ZABLOKOWAĆ NAM POCZTĘ NA DOBĘ. Wymiana jednego ryzyka na drugie.
--
--  Dlatego kubełek jest keyowany SEKRETEM, a sekretem jest klucz API Resend: serwer ma
--  go zawsze, gdy wysyła, a kto go nie ma, nie trafi w nasz kubełek. Do bazy nie trafia
--  ani sam klucz, ani nic, z czego dałoby się go odtworzyć - liczymy z niego skrót
--  z solą, tak samo jak `przepustka_wspolna` robi to z adresami IP.
--
--  ------------------------------------------------------------------ doba liczona po UTC
--
--  Celowo tak samo, jak liczy ją Resend: „It is a UTC calendar day (00:00-24:00 UTC)
--  and resets at midnight UTC - not a rolling 24-hour window". Dwa różne momenty zerowania
--  znaczyłyby, że w pewnych godzinach nasz sufit i ich limit mówią co innego o tym samym
--  dniu - a wtedy nie da się odpowiedzieć na pytanie „ile jeszcze mogę dziś wysłać".
--
--  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
-- =====================================================================

/* ---------- 1. licznik ---------- */
/*
  Osobna tabela, a nie `limit_zapytan`. Kusiło, bo tamta ma już sprzątanie i skróty -
  ale tamto sprzątanie kasuje wiersze `where okno < nr - 2`, gdzie `nr` zależy od
  DŁUGOŚCI OKNA. Dla okna minutowego `nr` idzie w miliardy, dla dobowego w dziesiątki
  tysięcy - więc pierwsze lepsze wywołanie z okna minutowego skasowałoby nasz wiersz
  dobowy jako „stary". Cicho, bez błędu, i sufit przestałby istnieć.
*/
/*
  Klucz główny jest złożony, bo kubełków w jednym dniu może być kilka: podgląd na Vercelu
  dostaje inny klucz API Resend niż produkcja, a to są dwa osobne limity u dostawcy
  i mają być dwa osobne liczniki u nas. Jeden wspólny licznik znaczyłby, że wysyłka
  testowa z gałęzi zjada sufit produkcji.
*/
create table if not exists public.poczta_doba (
  /* dzień kalendarzowy UTC - patrz nota na górze */
  dzien   date    not null,
  /* skrót z klucza API - patrz „kto może podbić licznik"; samego klucza tu nie ma */
  kubelek text    not null,
  ile     integer not null default 0,
  primary key (dzien, kubelek)
);

alter table public.poczta_doba enable row level security;
/* nikt nie sięga do tabeli wprost - ani do odczytu, ani do zapisu */
revoke all on public.poczta_doba from anon, authenticated;

/* ---------- 2. rezerwacja miejsca ---------- */
/**
 * Rezerwuje `p_ile` listów na dziś. Oddaje `{wolno, uzyte, sufit, zostalo}`.
 *
 * REZERWUJE, a nie „liczy po fakcie" - i to jest tu sedno. Wysyłka hurtowa idzie
 * porcjami po dziewięćdziesiąt, więc liczenie po fakcie znaczyłoby, że ostatnia porcja
 * przekracza sufit i dopiero wtedy się o tym dowiadujemy. Zapas bierzemy z góry, a gdy
 * poczta odmówi - oddajemy go przez `poczta_zwrot` (tak samo jak `zapisy_zwolnij`
 * oddaje adresy do kolejki).
 *
 * Całość w JEDNYM `insert ... on conflict`, bo dwie równoległe wysyłki muszą się
 * wykluczyć. Sprawdzenie „czy się zmieści" osobnym `select` przed `update` dałoby okno,
 * w którym obie porcje widzą miejsce, którego starczy tylko dla jednej.
 */
create or replace function public.poczta_przepustka(
  p_sekret text,
  p_ile    integer,
  p_sufit  integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dzis    date    := (now() at time zone 'utc')::date;
  kub     text;
  ile_    integer := greatest(1, coalesce(p_ile, 1));
  sufit_  integer := greatest(1, coalesce(p_sufit, 1));
  nowe    integer;
  teraz   integer;
begin
  /* bez sekretu nie ma kubełka - i nie ma przepustki; cisza byłaby gorsza od odmowy */
  if nullif(btrim(coalesce(p_sekret, '')), '') is null then
    return jsonb_build_object('wolno', false, 'uzyte', 0, 'sufit', sufit_, 'zostalo', 0,
                              'powod', 'brak sekretu');
  end if;

  kub := md5(p_sekret || '|podkosz-poczta-v1');

  /*
    Jedna porcja większa od całego sufitu nie zmieści się nigdy - odpowiadamy od razu,
    zamiast zostawiać wołającego z „spróbuj jutro", bo jutro będzie tak samo.
  */
  if ile_ > sufit_ then
    return jsonb_build_object('wolno', false, 'uzyte', 0, 'sufit', sufit_, 'zostalo', 0,
                              'powod', 'porcja większa niż cały sufit');
  end if;

  insert into poczta_doba (dzien, kubelek, ile)
  values (dzis, kub, ile_)
  on conflict (dzien, kubelek) do update
     set ile = poczta_doba.ile + ile_
   where poczta_doba.ile + ile_ <= sufit_
  returning ile into nowe;

  if nowe is null then
    /* nie zmieściło się - mówimy, ile dziś poszło, żeby panel mógł to pokazać */
    select ile into teraz from poczta_doba where dzien = dzis and kubelek = kub;
    return jsonb_build_object('wolno', false, 'uzyte', coalesce(teraz, 0), 'sufit', sufit_,
                              'zostalo', greatest(0, sufit_ - coalesce(teraz, 0)),
                              'powod', 'dzienny sufit wyczerpany');
  end if;

  /*
    Sprzątanie przy okazji, nie osobnym zadaniem - tak samo jak w `przepustka_wspolna`.
    Wierszy przybywa najwyżej jeden na dobę, więc i tak nie ma z czym walczyć; trzymamy
    sześćdziesiąt dni, bo to jedyny ślad tego, ile poczty naprawdę wychodzi.
  */
  if random() < 0.02 then
    delete from poczta_doba where dzien < dzis - 60;
  end if;

  return jsonb_build_object('wolno', true, 'uzyte', nowe, 'sufit', sufit_,
                            'zostalo', greatest(0, sufit_ - nowe));
end;
$$;

/* ---------- 3. zwrot niewykorzystanej rezerwacji ---------- */
/**
 * Oddaje `p_ile` miejsc, gdy wysyłka nie doszła do skutku.
 *
 * Bez tego każda awaria dostawcy zjadałaby sufit na stałe: porcja zarezerwowana,
 * listy niewysłane, a licznik do północy pamięta je jako wysłane. Przy paru
 * nieudanych próbach hurtowej wysyłki wystarczyłoby to, żeby zablokować sobie dzień.
 *
 * Nie schodzimy poniżej zera - zwrot bez wcześniejszej rezerwacji nie ma prawa
 * wyprodukować ujemnego licznika, choćby ktoś zawołał to dwa razy.
 */
create or replace function public.poczta_zwrot(p_sekret text, p_ile integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dzis date := (now() at time zone 'utc')::date;
  kub  text;
begin
  if nullif(btrim(coalesce(p_sekret, '')), '') is null then return; end if;
  kub := md5(p_sekret || '|podkosz-poczta-v1');

  update poczta_doba
     set ile = greatest(0, ile - greatest(1, coalesce(p_ile, 1)))
   where dzien = dzis and kubelek = kub;
end;
$$;

grant execute on function public.poczta_przepustka(text, integer, integer) to anon, authenticated;
grant execute on function public.poczta_zwrot(text, integer)               to anon, authenticated;

-- ============================================================ kontrola

-- 1. Sufit 3: trzy listy wchodzą, czwarty odbija się z „dzienny sufit wyczerpany".
select public.poczta_przepustka('kontrola-sufitu', 2, 3) as dwa_maja_wejsc,
       public.poczta_przepustka('kontrola-sufitu', 1, 3) as trzeci_ma_wejsc,
       public.poczta_przepustka('kontrola-sufitu', 1, 3) as czwarty_ma_odbic;

-- 2. Zwrot oddaje miejsce, więc po nim znowu jest wolne.
select public.poczta_zwrot('kontrola-sufitu', 1);
select public.poczta_przepustka('kontrola-sufitu', 1, 3) as po_zwrocie_ma_wejsc;

-- 3. Porcja większa niż sufit odbija się od razu, a nie „spróbuj jutro".
select public.poczta_przepustka('kontrola-sufitu', 500, 3) as za_duza_porcja;

-- 4. Sprzątamy po kontroli - licznik ma liczyć prawdziwą pocztę.
delete from public.poczta_doba where kubelek = md5('kontrola-sufitu' || '|podkosz-poczta-v1');
