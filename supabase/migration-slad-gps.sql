/*
  Ślad GPS przy zgłoszeniu boiska - jedna kolumna do moderacji.

  Kreator od teraz wpuszcza dalej tylko wtedy, gdy pinezka stoi najwyżej 25 m od odczytu
  GPS (patrz lib/obecnosc.ts). To sprawdzenie dzieje się w przeglądarce, a przeglądarce
  nie da się ufać: pozycję podmienia się w narzędziach deweloperskich w dwie sekundy
  i serwer nie ma jak tego wykryć - dostaje dwie liczby i musi im uwierzyć.

  Skoro nie da się tego zablokować, to niech chociaż będzie widać. Zapisujemy odległość
  pinezki od odczytu, a panel zestawia ją z zapisaną już dokładnością (`accuracy`)
  i wystawia ocenę: „ok" albo „podejrzane". Podejrzane nie znaczy odrzucone - znaczy
  „popatrz na to zgłoszenie uważniej niż na inne".

  Kolumna jest opcjonalna z rozmysłem. Zgłoszenia sprzed tej zmiany jej nie mają i nie ma
  z czego jej wyliczyć - w panelu dostają stan „bez śladu", nie „podejrzane". Fałszywe
  oskarżenie o oszustwo za to, że wpis jest starszy od mechanizmu, byłoby gorsze niż brak
  oceny.

  Uruchomienie: SQL Editor w Supabase, wklej całość, Run. Bezpieczne do powtórzenia.
*/

alter table submissions
  add column if not exists gps_odleglosc_m integer;

comment on column submissions.gps_odleglosc_m is
  'Odległość pinezki od surowego odczytu GPS w metrach, mierzona w kreatorze. '
  'NULL = zgłoszenie sprzed pomiaru obecności albo z pominięciem kreatora.';

/*
  Sensowny zakres: od zera do promienia obecności z zapasem. Wartość ujemna albo tysiąc
  metrów oznaczałaby, że ktoś strzela do endpointu wprost, a nie że stał daleko - kreator
  takiego zgłoszenia nie wypuści. Ograniczenie jest hojne (100 m), bo ma odsiewać bzdury,
  a nie dublować regułę z kreatora: samą regułę ocenia panel i to on ma prawo powiedzieć
  „podejrzane", zamiast bazy odrzucającej zgłoszenie bez śladu.
*/
do $$ begin
  alter table submissions add constraint submissions_gps_odleglosc_zakres check (
    gps_odleglosc_m is null or (gps_odleglosc_m >= 0 and gps_odleglosc_m <= 100)
  );
exception when duplicate_object then null; end $$;

/* ---------- kontrola ---------- */
select
  count(*) as zgloszenia,
  count(gps_odleglosc_m) as ze_sladem,
  count(*) filter (where gps_odleglosc_m is null) as bez_sladu
from submissions;
