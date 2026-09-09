-- =====================================================================
--  Limit zapytań wspólny dla wszystkich instancji funkcji.
--  Uruchom raz. Bez niej `/api/geo` działa jak dotąd - patrz „fail open" niżej.
--
--  PO CO, SKORO LIMIT JUŻ JEST
--
--  Jest, ale w PAMIĘCI JEDNEJ INSTANCJI (`lib/limity.ts`). Konsekwencja jest przewrotna:
--  im większy ruch, tym więcej instancji trzyma Vercel, tym luźniejszy limit. Przy jednej
--  instancji `/api/geo` przepuszcza 30 zapytań na minutę z adresu, przy dziesięciu - 300.
--  Zapora rozpuszcza się dokładnie wtedy, gdy zaczyna być potrzebna.
--
--  Dla większości tras to akceptowalny kompromis: koszt przekroczenia ponosimy my i jest
--  policzalny. `/api/geo` jest inne, bo koszt ponosi ktoś inny. Ta trasa pośredniczy do
--  Nominatim (OpenStreetMap), a regulamin OSM mówi: najwyżej jedno zapytanie na sekundę
--  z jednego źródła. Źródłem jesteśmy MY - jeden adres IP naszych funkcji. Za jego
--  przekroczenie Nominatim blokuje po adresie IP, bez ostrzeżenia i bez terminu:
--  pewnego dnia wyszukiwarka adresów w kreatorze przestaje zwracać cokolwiek.
--
--  Dlatego ta jedna trasa dostaje limit, który zna wszystkie instancje naraz. Jedno
--  dodatkowe zapytanie do bazy na wyszukanie adresu jest tanie; utrata dostępu do
--  Nominatim nie jest, bo nie da się jej odkupić.
--
--  CZYM JEST KLUCZ
--
--  Czymkolwiek, co identyfikuje rozliczanego: adresem IP z trasy API albo identyfikatorem
--  konta z funkcji w bazie. Funkcja nie musi wiedzieć, co dostała - liczy z tego skrót
--  z solą i tyle. Dzięki temu ten sam licznik obsługuje `/api/geo` (po adresie) i minigrę
--  (po koncie), zamiast dwóch prawie takich samych mechanizmów.
--
--  Adres IP wchodzi surowy, tak samo jak w `log_visit_ip` i `puls_obecnosci`: funkcję woła
--  NASZ serwer, więc baza widziałaby adres funkcji, nie odwiedzającego. Skrót liczy się
--  tutaj, więc w tabeli nie ma ani jednego czytelnego adresu - a wołający nie może celować
--  w kubełek kogoś innego, bo nie zna soli.
--
--  OKNO STAŁE, NIE PRZESUWNE
--
--  Przy przesuwnym trzeba trzymać listę znaczników czasu na każdy klucz, czyli tyle
--  pamięci, ile ruchu. Stałe okno kosztuje dwie liczby i różni się tylko tym, że na styku
--  dwóch okien przepuszcza do dwóch porcji. Przy tych limitach to bez znaczenia.
-- =====================================================================

create table if not exists public.limit_zapytan (
  klucz text primary key,
  /* numer okna czasowego - `floor(epoch / okno)` */
  okno  bigint  not null,
  ile   integer not null
);

/*
  Indeks pod sprzątanie. Bez niego usuwanie starych wierszy skanowałoby całą tabelę przy
  każdym żądaniu - a to jest funkcja wołana najczęściej z tych, które piszą.
*/
create index if not exists limit_zapytan_okno_idx on public.limit_zapytan (okno);

alter table public.limit_zapytan enable row level security;
/* nikt nie sięga do tabeli wprost - ani do odczytu, ani do zapisu */

/**
 * Czy wolno wykonać żądanie. Zwraca 0, gdy tak, a w przeciwnym razie liczbę sekund
 * do zwolnienia okna.
 */
create or replace function public.przepustka_wspolna(
  p_kubelek text,
  p_klucz   text,
  p_ile     integer,
  p_okno_s  integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  kto    text := nullif(btrim(coalesce(p_klucz, '')), '');
  okno_s integer := greatest(1, least(coalesce(p_okno_s, 60), 86400));
  limit_ integer := greatest(1, coalesce(p_ile, 1));
  teraz  bigint := floor(extract(epoch from now()))::bigint;
  nr     bigint;
  klucz_ text;
  ile_   integer;
begin
  /* nie da się przypisać żądania do nikogo - lepiej przepuścić niż rozliczać wszystkich razem */
  if kto is null then
    return 0;
  end if;

  nr := teraz / okno_s;
  klucz_ := left(coalesce(p_kubelek, 'x'), 32) || '|' ||
            md5(kto || '|podkosz-limit-v1') || '|' || nr::text;

  /*
    Sprzątanie przy okazji, nie osobnym zadaniem: tabela rośnie tylko o wiersze z okien,
    które już minęły, a usunięcie ich kosztuje tu jedno uderzenie w indeks. Zostawiamy
    dwa poprzednie okna - wiersz z okna sprzed sekundy może być jeszcze potrzebny.

    Sprzątamy losowo raz na jakieś sto wywołań. Przy każdym byłoby to sto razy więcej
    pracy niż trzeba, a wiersze i tak nikomu nie przeszkadzają dłużej niż chwilę.
  */
  if random() < 0.01 then
    delete from limit_zapytan where okno < nr - 2;
  end if;

  insert into limit_zapytan (klucz, okno, ile)
  values (klucz_, nr, 1)
  on conflict (klucz) do update set ile = limit_zapytan.ile + 1
  returning ile into ile_;

  if ile_ > limit_ then
    /* ile sekund do końca okna, minimum jedna - „wróć za 0 s" nic nie znaczy */
    return greatest(1, ((nr + 1) * okno_s - teraz)::integer);
  end if;

  return 0;
end;
$$;

/*
  Wołane z naszych tras kluczem `anon` - innego serwer nie ma. Kto zawoła to wprost,
  podbije wyłącznie własny kubełek: klucz powstaje ze skrótu z solą, więc nie da się
  celować w cudzy.
*/
grant execute on function public.przepustka_wspolna(text, text, integer, integer)
  to anon, authenticated;

-- ============================================================ kontrola
-- Trzy wywołania przy limicie 2 na 60 s: 0, 0, a potem liczba sekund do końca okna.
select public.przepustka_wspolna('kontrola', '203.0.113.7', 2, 60) as pierwsze,
       public.przepustka_wspolna('kontrola', '203.0.113.7', 2, 60) as drugie,
       public.przepustka_wspolna('kontrola', '203.0.113.7', 2, 60) as trzecie_ma_byc_dodatnie;

delete from public.limit_zapytan where klucz like 'kontrola|%';
