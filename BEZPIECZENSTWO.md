# Czym można w PodKosza uderzyć i co teraz stoi na drodze

Lista jest napisana od strony atakującego: najpierw **jak bym to zrobił**, potem **co go
zatrzyma**, na końcu **co dalej zostaje otwarte**. Bez tej trzeciej części cała reszta jest
tylko ładna.

Jedna rzecz do zapamiętania przed czytaniem, bo wraca w połowie punktów:

> **Klucz `anon` do Supabase jest publiczny.** Leży w kodzie strony, bo musi - to on
> pozwala przeglądarce czytać boiska bez logowania. Każda funkcja nadana roli `anon` jest
> więc wołalna wprost z konsoli, w pętli, bez otwierania naszej strony. Limity w kodzie
> tras chronią tylko przed leniwym atakiem; wszystko, co ma naprawdę trzymać, musi stać
> w bazie.

---

## 1. Podać się za inny adres IP

**Jak:** `curl -H "cf-connecting-ip: 1.2.3.4"`. Kod czytał adres klienta tak:
`cf-connecting-ip`, a jeśli go nie ma - **pierwsza** wartość z `x-forwarded-for`. Obie są
w całości pod kontrolą tego, kto wysyła żądanie. `x-forwarded-for` to lista dopisywana po
drodze: każdy pośrednik dokleja na **koniec** adres, który sam widział, więc pierwsza
wartość jest tą, którą wpisał klient. A serwis stoi na Vercelu, nie za Cloudflare - więc
`cf-connecting-ip` nie ma prawa tu dojść i jeśli jest, to znaczy, że ktoś go podłożył.

Dawało to dwie rzeczy naraz: **obejście listy banów IP** (zbanowany adres podaje inny
i blokada w proxy przestaje cokolwiek znaczyć) i **zasypanie statystyk** - licznik wizyt
i „ilu jest teraz" trzymają jeden wiersz na skrót adresu, więc inny adres w każdym żądaniu
to dowolnie dużo wierszy i dowolna liczba w panelu.

**Co stoi:** `lib/adres-ip.ts` - jedno miejsce, jedna reguła: **ostatnia** wartość
`x-forwarded-for` (albo nagłówek własny Vercela), nigdy pierwsza; `cf-connecting-ip` tylko
wtedy, gdy `PODKOSZ_ZA_CLOUDFLARE=1`. Reguły w SQL (`reports_rate_limit`,
`feedback_rate_limit`) brały ostatnią wartość od początku - teraz obie strony liczą ten sam
adres.

**Sprawdzone:** czterdzieści żądań do `/api/geo`, w każdym inny `cf-connecting-ip` i inna
pierwsza wartość `x-forwarded-for`, ta sama ostatnia. Wszystkie wpadły do jednego licznika:
trzydzieści przeszło, dziesięć dostało 429.

---

## 2. Zalać serwis żądaniami

**Jak:** `for i in $(seq 1 100000); do curl -s https://podkosz.pl/ranking & done`. Do tej
pory **nie było żadnego limitu**, a każde żądanie przez proxy kosztuje pytanie do Supabase
o sesję, czyli podróż po sieci. Nie trzeba było nawet celować w nic konkretnego.

**Co stoi:** limit w `proxy.ts` - 300 żądań na minutę z jednego adresu, liczony **przed**
pytaniem o sesję (inaczej odrzucone żądanie kosztowałoby tyle samo, co obsłużone). Pliki
statyczne i obrazki tu nie zaglądają, więc limit dotyczy stron i tras API. Osobne, ciaśniejsze
limity mają trasy, które kosztują najwięcej (punkty 3-5).

**Sprawdzone:** przy limicie ustawionym chwilowo na 3 żądania czwarte i kolejne wracały
z 429; przy 300 czterysta żądań w 63 sekundy przechodzi - i tak ma być, to zapas dla
człowieka.

**Co zostaje otwarte:** licznik żyje w pamięci **jednej** instancji funkcji, a Vercel trzyma
ich kilka naraz, więc realny limit jest kilka razy luźniejszy. To warstwa przeciw jednemu
źródłu w pętli, nie zapora. Prawdziwy limit ruchu włącza się w panelu Vercela
(Firewall → Rate Limiting) i tam warto go dołożyć na `/api/*`.

---

## 3. Użyć naszego serwera jako darmowego pośrednika

**Jak:** `/api/geo` przepisywał **wszystkie** parametry zapytania do Nominatim. Czyli przez
nasz serwer dało się wołać OpenStreetMap z dowolnymi parametrami, z naszym adresem IP
i naszą identyfikacją w nagłówku - cudzy ruch, nasza kara. Nominatim za przekraczanie
limitu blokuje po adresie IP i robi to bez ostrzeżenia: pewnego dnia wyszukiwarka adresów
przestaje działać i nie wiadomo dlaczego.

**Co stoi:** biała lista parametrów z limitem długości każdego (dokładnie to, czego używa
`lib/geo.ts`), lista dozwolonych trybów (`search`, `reverse`) i trzydzieści zapytań na
minutę z adresu. Człowiek piszący w polu wyszukiwania mieści się z zapasem.

---

## 4. Zablokować wyszukiwarkę adresów jej własną kolejką

**Jak:** regulamin OSM pozwala na jedno zapytanie na sekundę, więc `/api/geo` szeregował
żądania po 1,1 s - a kolejka **nie miała końca**. Setne żądanie czekało sto dziesięć sekund
i przez ten czas zajmowało instancję funkcji. Kilkaset żądań w pętli zajmowało wszystkie
instancje na kilka minut i wyszukiwarka przestawała działać dla wszystkich naraz. Najtańsza
dziura w całym serwisie: jedna linijka w bashu.

**Co stoi:** kolejka ma sufit 2,5 s. Kto trafi na zatłoczoną, dostaje 429 z nagłówkiem
`Retry-After` - odmowa w ćwierć sekundy jest zawsze lepsza niż odpowiedź po dwóch minutach.

**Sprawdzone:** osiem równoległych żądań z jednego adresu - cztery odrzucone natychmiast,
cztery obsłużone. Bez sufitu ostatnie czekałoby osiem sekund.

---

## 5. Zrobić z nas maszynkę do maili na cudze adresy

**Jak:** `/api/zapis-na-otwarcie` wysyła potwierdzenie na **każdy nowy** adres. Klucz główny
tabeli chronił tylko przed powtórzeniem tego samego adresu, więc jednego człowieka nie dało
się zalać - ale tysiąc **różnych** adresów to tysiąc listów z naszej domeny do tysiąca
obcych ludzi. To najkrótsza droga do spalenia reputacji domeny i do wylądowania w spamie
na zawsze. Do tego `anon` miał `insert` na `launch_signups` **wprost**, kluczem publicznym:
miliony wierszy bez przechodzenia przez naszą trasę.

**Co stoi:** jedno wejście - funkcja `zapis_na_otwarcie(email, ip)` - i trzy liczniki: pięć
na godzinę z adresu IP, dwadzieścia na dobę, sześćset na godzinę w całym serwisie. Wprost
do tabeli nie wchodzi już nikt (`revoke insert`). Licznik jest w bazie, nie w kodzie trasy,
bo instancji funkcji jest kilka, a wpis i tak dawał się zrobić bez nich.

**Co zostaje otwarte:** sufit sześciuset na godzinę oznacza, że botnet ze stu dwudziestu
adresów IP może wyciszyć zapisy na godzinę. Świadomy wybór: godzina ciszy na zapisach jest
tańsza niż sto tysięcy listów z naszej domeny. Warto też ustawić dzienny limit wysyłki po
stronie Resend - to sufit, którego nasz kod nie przeskoczy nawet przez błąd.

---

## 6. Podłożyć kod w cudzą stronę przez nazwę boiska

**Jak:** dane strukturalne dla Google idą do `<script type="application/ld+json">`, a do
środka wchodzą nazwy, opisy i adresy boisk - czyli tekst wpisany przez ludzi w zgłoszeniu.
Wnętrze `<script>` przeglądarka czyta jako surowy tekst i kończy je na **pierwszym** napisie
`</script`, nie zważając na to, że stoi on w środku łańcucha JSON. Boisko o nazwie
`</script><img src=x onerror=...>` zamykało skrypt i wstawiało swój kod w stronę - zapisany
XSS, uruchamiany każdemu, kto otworzy tę podstronę.

Moderacja tego nie łapie: w panelu widać zwykły tekst, a nie to, co zrobi z niego parser
HTML. Nagłówek CSP też nie, bo kod stoi w naszym dokumencie i jest tak samo „nasz" jak
reszta strony.

**Co stoi:** `lib/json-ld.ts` - `<`, `>`, `&` oraz U+2028/U+2029 zamieniane na sekwencje
`\uXXXX`. Dla czytnika JSON to ten sam napis, dla parsera HTML nie ma już czego domykać.

**Sprawdzone:** nazwa `</script><img src=x onerror="alert(document.cookie)"><script>` -
stara wersja rzeczywiście zamykała skrypt, nowa nie zawiera ani jednego `<`, `>` czy `&`,
a `JSON.parse` oddaje dokładnie tę samą nazwę i opis.

---

## 7. Podpisać się pod rekordem w minigrze

**Jak:** wynik powstaje w przeglądarce, więc wystarczyła jedna linijka w konsoli:
`supabase.rpc('minigra_zapisz', {p_miejsce:'venice', p_seria:500})` i czoło rankingu.

**Co stoi:** wynik jest teraz podpięty pod **czas, w którym mógł powstać**. Runda musi być
otwarta funkcją `minigra_start`, wynik nie może przekroczyć tego, co da się zrobić w czasie
od jej otwarcia (kozły: dziesięć kliknięć na sekundę, rzuty: 1,2 rzutu na sekundę, plus
stały zapas dziesięciu na opóźnienie sieci), a runda **gaśnie po użyciu** - każdy zapis
potrzebuje świeżej.

**Co zostaje otwarte, uczciwie:** wyniku z przeglądarki **nie da się zweryfikować** bez
przeliczenia całej rozgrywki na serwerze. Kto chce oszukać, może otworzyć rundę, odczekać
minutę i wysłać liczbę, którą w minutę da się zdobyć. Tyle da się tu zrobić bez pisania gry
od nowa po stronie serwera - i tyle wystarcza, żeby ranking nie pokazywał liczb
nieosiągalnych fizycznie.

---

## 8. Uruchamiać nasze zadanie utrzymaniowe w pętli

**Jak:** `/api/utrzymanie` sprawdzał sekret tak: „jeśli `CRON_SECRET` **jest ustawiony**,
porównaj go". A nie był ustawiony. Czyli sprzątanie archiwum, chodzące po całej bazie, mógł
uruchomić ktokolwiek, dowolnie często - gotowa dźwignia do obciążenia bazy cudzym kosztem.

**Co stoi:** brak sekretu zamyka trasę na głucho (503). Brak konfiguracji nie może otwierać
drzwi.

---

## 9. Hodować tabele statystyk i obecności

**Jak:** `log_visit_ip(text)` i `puls_obecnosci(text)` biorą adres IP **jako parametr** i są
nadane roli `anon`. Kluczem publicznym da się wołać je wprost i podawać za każdym razem
inny adres - każdy inny adres to nowy wiersz.

**Co stoi:** uwierzytelnić tu nikogo nie można (klucz publiczny to klucz publiczny), więc
ograniczamy szkodę: dobowy sufit dwudziestu tysięcy różnych skrótów w `visit_days`, pięć
tysięcy wierszy w `obecnosc`, sufit na licznik w wierszu, próg dwudziestu sekund między
zapisami tego samego skrótu i sprzątanie starych wierszy przy zapisie (wcześniej tabela
czekała na wejście administratora w panel). Do tego limity na trasach `/api/wizyta`
i `/api/obecnosc`.

**Co zostaje otwarte:** ktoś uparty wciąż zawyży licznik wizyt do sufitu. To liczba
w panelu, nie zabezpieczenie - ważne było, żeby nie dało się nią urosnąć bazie.

---

## 10. Rzeczy, które trzymały już wcześniej

Warto wiedzieć, że stoją, bo to one zamykają najbardziej oczywiste pomysły:

- **Brak klucza serwisowego w kodzie.** Nigdzie, ani w kodzie strony, ani w trasach API.
  Wszystko idzie przez RLS i funkcje `security definer`, więc wyciek czegokolwiek z frontu
  nie daje władzy nad bazą.
- **Zasłona przed premierą** wpuszcza tylko konta z listy beta-testerów, sprawdzane w bazie
  (`czy_wpuscic`). Obejścia ciasteczkiem ani kluczem w adresie nie ma - zostało usunięte
  po tym, jak okazało się, że działa na produkcji.
- **Zgłoszenia boisk** wymagają obecności na miejscu (±25 m z GPS), mają dzienny limit na
  konto i zostawiają ślad odległości oceniany jako „ok / podejrzane".
- **Opinie**: jedna na dobę z adresu IP, a mail wychodzi tylko wtedy, gdy wiersz naprawdę
  jest w bazie i nie był jeszcze wysłany (`feedback_claim_for_mail`).
- **Zdjęcia**: najwyżej dwanaście na zgłoszenie, 4 MB na plik, tylko do otwartego
  zgłoszenia, ścieżka sprawdzana w polityce `storage`.
- **Nagłówki**: CSP, `X-Frame-Options: DENY` i reszta w `next.config.ts`.
- **Sufity na pamięci w proxy**: mapy z wynikami sprawdzeń mają limit rozmiaru, bo mapa bez
  sufitu sama jest dziurą.

---

## 11. Co jeszcze warto zrobić poza kodem

Tego nie da się załatwić w repozytorium, ale to najtańsze pieniądze w całej liście:

1. **Vercel → Firewall → Rate Limiting** na `/api/*`. To jedyna warstwa, która odsiewa ruch
   przed uruchomieniem naszej funkcji, czyli zanim zacznie kosztować.
2. **Supabase → limit wydatków / alert** na zużycie. Nie zapobiega atakowi, ale nie pozwala
   mu urosnąć w rachunek.
3. **Resend → dzienny limit wysyłki.** Sufit, którego nasz kod nie przeskoczy nawet przez
   pomyłkę w pętli.
4. **`CRON_SECRET` na Vercelu.** Bez niego zadanie utrzymaniowe jest teraz wyłączone (503),
   czyli archiwum się nie sprząta.
5. **Kopie bazy.** Największą szkodą nie jest przeciążenie, tylko utrata danych - a plan
   „przywrócimy z kopii" trzeba mieć **przed**, nie po.
