# Baza — kolejność migracji

Migracje uruchamia się **ręcznie**, w panelu Supabase → SQL Editor. Nie ma tu żadnego
automatu i to jest świadoma decyzja: projekt ma jedną bazę produkcyjną, a narzędzie, które
samo puszcza SQL na produkcję przy każdym wdrożeniu, prędzej czy później puści coś, czego
nikt nie przeczytał.

Cena jest taka, że **po sklonowaniu repozytorium na czystą bazę trzeba przejść tę listę po
kolei**. Pliki są napisane tak, żeby dało się je puścić drugi raz bez szkody
(`create table if not exists`, `create or replace function`, `drop policy if exists`), więc
w razie wątpliwości bezpieczniej jest uruchomić ponownie niż zgadywać.

## Kolejność

Najpierw szkielet, potem warstwy funkcjonalne. Numeracja to kolejność uruchamiania, nie
część nazwy pliku.

| # | Plik | Co dokłada |
|---|------|-----------|
| 1 | `schema.sql` | tabele, profile, boiska, zgłoszenia, polubienia, RLS |
| 2 | `migration-konto.sql` | konto użytkownika, usuwanie własnego konta, lista kont dla admina |
| 3 | `migration-bezpieczenstwo.sql` | polityki Storage, limity uploadu |
| 4 | `migration-reports.sql` | zgłoszenia błędów w danych |
| 5 | `migration-reports-limit.sql` | limit zgłoszeń z jednego adresu |
| 6 | `migration-feedback.sql` | opinie z formularza |
| 7 | `migration-zagram-dzis.sql` | deklaracje „idę dziś zagrać" |
| 8 | `migration-odznaczenia.sql` | zakres godzin, statystyki gracza, odznaczenia |
| 9 | `migration-wyroznienia.sql` | wyróżnienia (te bez poziomów) |
| 10 | `migration-basket-approved.sql` | wyróżnienie Heat |
| 11 | `migration-statystyki-plakietka-shorts.sql` | `admin_overview()`, licznik wizyt, Shorts |
| 12 | `migration-wizyty-serwer.sql` | liczenie wizyt po stronie serwera |
| 13 | `migration-obecnosc.sql` | puls obecności i licznik „ilu teraz na stronie" |
| 14 | `migration-kandydaci-osm.sql` | kandydaci na boiska z OpenStreetMap |
| 15 | `migration-bany-ip.sql` | blokady adresów IP |
| 16 | `migration-beta-testerzy.sql` | lista beta testerów |
| 17 | `migration-szukanie.sql` | wyszukiwanie boisk |
| 18 | `migration-odleglosc.sql` | sortowanie po odległości |
| 19 | `migration-nawierzchnia-plytki.sql` | dodatkowy rodzaj nawierzchni |
| 20 | `migration-autor-panelu.sql` | podpis autora przy boiskach dodanych z panelu |
| 21 | `migration-mail-powitalny.sql` | jednorazowe powitanie nowego konta |
| 22 | `migration-zapisy-na-otwarcie.sql` | zapisy na otwarcie ze strony „Już niedługo" |
| 23 | `migration-minigra.sql` | wyniki mini-gry i osobne rankingi |
| 24 | `migration-plomien-pinezki.sql` | `checkiny_dzisiaj()` dla ognia na pinezkach |
| 25 | `migration-limit-boisk-dziennie.sql` | najwyżej dwa boiska dziennie, jedno województwo |
| 26 | `migration-usuwanie-kont.sql` | usuwanie kont przez admina + archiwum na 180 dni |
| 27 | `migration-panel-glowny.sql` | `panel_glowny()` — liczby do kokpitu |

## Nieuruchomione (świadomie)

| Plik | Dlaczego leży |
|------|---------------|
| `migration-profil-publiczny.sql` | udostępnia publicznie ulubione i historię gry — decyzja produktowa, nie techniczna |
| `migration-heat.sql` | rozdzieliłby Heat od Basket Approved; dziś to jedna flaga i to wystarcza |
| `seed-demo.sql` | dane przykładowe, tylko do pustej bazy na testy |

## Rzeczy, które nie sprzątają się same

- **`checkins`** rośnie bez końca. Funkcja czyszcząca została skasowana w
  `migration-odznaczenia.sql`, bo godziny z przeszłości są potrzebne do liczenia odznaczeń.
  Przy obecnej skali to nieistotne (kilkadziesiąt bajtów na deklarację), ale jeśli kiedyś
  zajmie zauważalną część limitu 500 MB, trzeba świadomie zdecydować, po ilu miesiącach
  historia przestaje być potrzebna — usunięcie jej zmieni komuś odznaczenia.
- **`konta_usuniete`** czyści się przy każdym odczycie listy w panelu i przy każdym
  usunięciu lub przywróceniu konta (`sprzataj_usuniete_konta()`). Wpisy starsze niż 180 dni
  znikają bezpowrotnie.
- **`obecnosc`** czyści się przy odczycie licznika w panelu (wiersze starsze niż doba).
- **`visit_days`** rośnie: jeden wiersz na adres na dzień. Rocznie to rząd tysięcy wierszy,
  czyli nic.
