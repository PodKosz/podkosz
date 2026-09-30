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
część nazwy pliku. Nowy plik dopisuj od razu w tym samym commicie, w którym go dodajesz.

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
| 27a | `migration-sprzatanie-archiwum.sql` | archiwum usuniętych kont sprząta się też przy każdym odczycie listy w panelu - `lista_usunietych_kont()` woła `sprzataj_usuniete_konta()`, więc 180 dni to 180 dni, a nie „do następnego usunięcia”. **Po nr 26** |
| 28 | `migration-slad-gps.sql` | odległość pinezki od odczytu GPS — ocena „ok / podejrzane" w kolejce |
| 29 | `migration-minigra-chicago.sql` | trzecie miejsce minigry (Chicago, kozłowanie) — zawarte w `migration-tarcza.sql`, więc jeśli uruchamiasz tarczę, tej pomiń |
| 30 | `migration-tarcza.sql` | limity i sufity na tym, co otwarte dla świata: zapisy na otwarcie tylko przez funkcję z licznikiem na IP, sufity na statystykach i obecności, wyniki minigry podpięte pod czas rundy. **Najpierw wdróż kod, potem uruchom migrację** — zapis wyniku wymaga od tej pory otwartej rundy (`minigra_start`) |
| 31 | `migration-brama-i-polska.sql` | zgłoszenia boisk i poprawek wymagają konta (koniec z anonimowymi), a boiska wolno dodawać tylko w prostokącie Polski - z wyjątkiem administratora |
| 32 | `migration-wydarzenia.sql` | wydarzenia na boiskach: tabela `wydarzenia`, odczyt dla wszystkich, zapis tylko dla administratora, plakaty w katalogu `wydarzenia/` bucketa zdjęć |
| 33 | `migration-wydarzenia-powiadomienia.sql` | maile o wydarzeniu do osób, które podpaliły boisko albo okolicę: `wydarzenie_odbiorcy`, zaklepywanie wysyłki (`powiadomiono_at`) i wyłącznik `profiles.powiadomienia` |
| 34 | `migration-wydarzenia-proporcje.sql` | proporcja plakatu wydarzenia (`zdjecie_proporcje`) - od niej zależy układ boxa na karcie boiska: pion daje wysoką kartę w prawej kolumnie, poziom szeroki pas nad kafelkami |
| 34a | `migration-minigra-sufit.sql` | sufit wyniku minigry 500 -> 5000 (warunek kolumny i `minigra_zapisz`) - 500 obcinało uczciwe wyniki w kozłach. **Po nr 30** |
| 34b | `migration-limit-wspolny.sql` | `przepustka_wspolna()` i tabela `limit_zapytan` - limit zapytań wspólny dla wszystkich instancji funkcji na Vercelu (zamiast licznika w pamięci jednej). Korzystają z niej 34c, 34k, 34n i 40 |
| 34c | `migration-minigra-tempo.sql` | tempo minigry: ile rund na minutę wolno otworzyć i zapisać. **Po 34a i 34b** |
| 34d | `migration-checkin-panel.sql` | `checkin_panel()` - panel „kto gra” na karcie boiska jednym zapytaniem zamiast czterech. **Po nr 25** (`checkin_blokada`), **przed nr 35 i 37** |
| 34e | `migration-obecnosc-okno.sql` | okno licznika „ilu teraz na stronie” z 2 do 5 minut (`ilu_online()`). **Po nr 13** |
| 34f | `migration-sesja-jednym-zapytaniem.sql` | `sesja_uzytkownika()` - dane sesji dla `/api/sesja` jednym zapytaniem. Kod działa też bez niej |
| 34g | `migration-slug-profilu.sql` | `profiles.slug` i `slug_nicku()` - adres profilu bez czytania całej tabeli kont. Kod działa też bez niej |
| 34h | `migration-punkty-osm.sql` | punkty nieodkrytych boisk z OpenStreetMap: `punkty_osm`, odkrywanie po dodaniu boiska, zgłaszanie braku boiska. **Po nr 18** (`distance_m`) |
| 34i | `dane-punkty-osm.sql` | same dane do `punkty_osm` (7832 punkty, stan OSM z 10.09.2026). **Nie ma go w repozytorium** (`.gitignore`) - generuje go `scripts/punkty-osm.mjs`. **Po 34h** |
| 34j | `migration-boiska-bez-pelnej-listy.sql` | koniec z pobieraniem wszystkich boisk naraz: `courts.city_slug` / `voivodeship_slug` / `added_by_slug`, indeksy, `miejsca_boisk()` i `kadry_odkrywcow()`. **Po 34g** (`slug_nicku`) |
| 34k | `migration-minigra-zapis-kolumna.sql` | naprawa `minigra_zapisz()`: kolumna to `updated_at` - wcześniej zapisywał się tylko pierwszy wynik na boisku. Ostatnia wersja tej funkcji, więc **po 34c** |
| 34l | `migration-zgloszenia-tylko-zalogowani.sql` | boisko i jego zdjęcia dodaje tylko zalogowany autor zgłoszenia; rola anonimowa traci prawo zapisu. Zaostrza polityki z nr 31, więc **po nr 31** |
| 34m | `migration-poprawki-zdjec.sql` | poprawki zdjęć: `photo_swaps`, `court_photos.author_id`, limit zgłoszeń i `przyjmij_poprawke()` - zalogowany może podmienić albo dołożyć kadr do cudzego boiska. **Przed nr 39** (sprząta odrzucone poprawki) |
| 34n | `migration-sufit-poczty.sql` | dzienny sufit wysyłki poczty po naszej stronie (`poczta_doba`, `poczta_przepustka()`, `poczta_zwrot()`), bo Resend takiego ustawienia nie ma. **Po 34b** |
| 35 | `migration-jedna-godzina-jedno-boisko.sql` | nie da się zadeklarować gry na dwóch boiskach w tej samej godzinie: indeks unikatowy `(user_id, day, hour)`, komunikat po polsku w wyzwalaczu i lista zajętych godzin w `checkin_panel`. **Wymaga `migration-checkin-panel.sql` (34d)**. Jeśli w danych są już kolizje, indeks nie powstanie, dopóki nie uruchomisz bloku porządkującego z punktu 2 w pliku |
| 36 | `migration-statystyki-zbiorczo.sql` | `statystyki_graczy(text[])` - statystyki wielu graczy jednym zapytaniem, dla piłek odznaczeń w rankingu. Woła istniejącą `statystyki_gracza` przez `cross join lateral`, więc reguły odznaczeń zostają w jednym miejscu. Kod działa też bez niej (cofa się do pytania o każdego osobno), więc kolejność wdrożenia jest dowolna |
| 37 | `migration-deklaracje-tydzien.sql` | deklaracje „kto gra" na dziś i sześć kolejnych dni: `checkin_panel(uuid, date)` z podglądem tygodnia (`tydzien`, `moje_dni`) i `checkin_blokada(uuid, date)`; komunikaty wyzwalacza bez „na dziś". **Wymaga nr 35.** Kod działa też bez niej - pokazuje wtedy sam dzisiejszy dzień, jak dawniej |
| 38 | `migration-siatka.sql` | siatka na koszach (`łańcuch / siatka / brak`) w `courts` i `submissions`; wyzwalacz przenosi ją ze zgłoszenia na boisko po akceptacji, bez ruszania `approve_submission()` |
| 39 | `migration-rodo.sql` | terminy z polityki prywatności jako mechanizm: nocne `sprzataj_dane_osobowe()` pod pg_cron (skróty IP po 30 dniach, opinie i raporty po 24 miesiącach, wizyty po 12, bany 30 dni po końcu, lista na otwarcie 30 dni po liście), tokeny wypisu (`wypis_tokeny`, `wypisz_z_powiadomien`) i token w `wydarzenie_odbiorcy`; odrzucone zgłoszenia i poprawki po 12 miesiącach kasuje panel razem ze zdjęciami (`odrzucone_do_usuniecia`, `usun_odrzucone`). **Wymaga nr 33.** Kod działa też bez niej - listy mają wtedy w stopce odesłanie do ustawień konta |
| 40 | `migration-minigra-trop.sql` | minigra Trop (pinezka w Las Vegas, zgadywanie, gdzie stoi boisko): `trop_gry` i `trop_wyniki`, punkty, czas rundy i bonus za jedno zdjęcie liczone w bazie (`trop_start`, `trop_zdjecia`, `trop_zgadnij`, `trop_nastepna`, `trop_ranking`). Pula to wszystkie boiska ze zdjęciami. **Wymaga `migration-odleglosc.sql` (#18) i `przepustka_wspolna`** |

Wiersze z literą (27a, 34a-34n) to pliki, które przez jakiś czas nie trafiały do tej tabeli.
Dopisane 30.09.2026 w kolejności dodania do repozytorium i sprawdzone dwa razy: zależności
między plikami (każdy stoi po tym, czego używa, i przed tym, co z niego korzysta) i stan
produkcji (każdy z tych plików ma w bazie swój ślad - funkcję, tabelę, kolumnę albo politykę).
Litery zamiast nowych numerów, bo na numery 1-40 powołują się nagłówki innych migracji.

## Nieuruchomione (świadomie)

| Plik | Dlaczego leży |
|------|---------------|
| `migration-profil-publiczny.sql` | udostępnia publicznie ulubione i historię gry — decyzja produktowa, nie techniczna. **Przed uruchomieniem trzeba zmienić politykę prywatności** - dziś mówi, że deklaracje gry nie są publiczne |
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
