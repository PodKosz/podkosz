# PodKosz

Interaktywna mapa i baza boisk do koszykówki w Polsce — ze zdjęciami w powtarzalnym standardzie,
filtrami, rankingiem i moderowanymi zgłoszeniami od graczy.

## Stack

| Warstwa | Wybór |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind v4 |
| Mapa | MapLibre GL + kafelki CARTO `dark_nolabels` + własne polskie etykiety miast |
| Baza / auth / zdjęcia | Supabase (Postgres + RLS, Google OAuth, Storage) |
| Hosting | Vercel (frontend) + Supabase (dane) — oba darmowe tiery |

## Uruchomienie

```bash
npm install
npm run dev
```

Bez pliku `.env.local` aplikacja działa w **trybie testowym**: 18 przykładowych boisk, a zgłoszenia
i decyzje moderacyjne siedzą w `localStorage` przeglądarki. Cała pętla *dodaj → akceptuj → pinezka
na mapie* jest klikalna bez backendu.

## Podpięcie Supabase (5 kroków)

1. **Projekt** — [supabase.com](https://supabase.com) → *New project*. Region: `Central EU (Frankfurt)`.
   Zapisz hasło do bazy.
2. **Schemat** — SQL Editor → wklej całość [`supabase/schema.sql`](supabase/schema.sql) → *Run*.
   Tworzy tabele, RLS, bucket na zdjęcia i funkcję publikującą zgłoszenia.
3. **Klucze** — skopiuj `.env.local.example` na `.env.local` i uzupełnij `NEXT_PUBLIC_SUPABASE_URL`
   oraz `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → Data API / API Keys). Restart `npm run dev`.
4. **Logowanie Google** — Authentication → Sign In / Providers → Google → włącz.
   Client ID i Secret bierzesz z Google Cloud Console (OAuth 2.0), a jako *Authorized redirect URI*
   wklejasz adres pokazany przez Supabase. W Supabase → Authentication → URL Configuration dodaj
   `http://localhost:3000` i późniejszą domenę produkcyjną.
5. **Rola admina** — zaloguj się w aplikacji, potem SQL Editor:
   ```sql
   update profiles set role = 'admin' where id = 'UUID-z-Authentication-Users';
   ```
   Od tej chwili `/admin` pokazuje kolejkę zgłoszeń.

Po kroku 3 aplikacja automatycznie przełącza się z danych testowych na bazę — kod jest ten sam,
przełącznikiem jest obecność kluczy (`lib/supabase/config.ts`).

## Co działa

- `/` — mapa Polski, pinezki, hover z miniaturkami i szybkim info, filtry (typ, nawierzchnia,
  województwo, minimum lajków, dostępność, oświetlenie), wyszukiwarka.
- `/boisko/[slug]` — karta boiska: sekcja Basket Approved, galeria z lightboxem, parametry, opis,
  „podpal" (lajk), ulubione, nawigacja, przycisk „Zgłoś błąd".
- `/dodaj` — kreator: tutorial z kadrami, 6 zdjęć z aparatu z ramką pomocniczą, GPS, formularz,
  wysyłka jako gość albo na koncie Google. Zdjęcia lądują w Storage, zgłoszenie w tabeli.
- `/admin` — cztery zakładki: kolejka moderacji, błędy zgłoszone przez użytkowników, lista
  opublikowanych boisk (edycja i kasowanie) oraz ręczne dodawanie. Tylko dla roli `admin`.
- `/ranking` — top boisk wg lajków + ranking osób, które dodały najwięcej boisk.
- `/ulubione` — lista zapisanych boisk zalogowanego użytkownika.

## Basket Approved

Osobista rekomendacja twórcy. W panelu włączasz przełącznik i dopisujesz 2-3 zdania — na karcie
boiska pojawia się wtedy fioletowa sekcja z tym tekstem dużą czcionką, a pinezka na mapie świeci
fioletem zamiast pomarańczu. Kolumny: `courts.basket_approved` i `courts.basket_note`.
Sekcja pokazuje się dopiero wtedy, gdy komentarz jest niepusty — sam przełącznik zmienia tylko
odznakę i kolor pinezki.

## Zgłaszanie błędów

Każdy, również gość bez konta, może na karcie boiska kliknąć „Zgłoś błąd", wybrać powód
(godziny, dane, nawierzchnia, zdjęcia, boiska już nie ma, inne) i dopisać szczegóły. Zgłoszenia
lądują w tabeli `reports` i w zakładce „Błędy w danych", gdzie boiska są sortowane po liczbie
otwartych zgłoszeń albo po dacie ostatniego. Zamknięcie ustawia `status = 'resolved'`.

## Bezpieczeństwo danych

RLS jest włączone na wszystkich tabelach:

- boiska i zdjęcia — odczyt publiczny, zapis wyłącznie dla roli `admin`,
- zgłoszenia — dodać może każdy (również gość), odczytać tylko autor albo admin,
- lajki i ulubione — każdy operuje wyłącznie na swoich wierszach,
- Storage — wgrywanie tylko do katalogu `zgloszenia/`, limit 8 MB, dozwolone jpeg/png/webp.

Publikacja zgłoszenia idzie przez funkcję `approve_submission()` (SECURITY DEFINER z kontrolą roli),
więc klient nie ma prawa zapisu do tabeli `courts`.

## Gdzie lądują zdjęcia

W bazie trzymamy wyłącznie ścieżki — pliki idą do Supabase Storage, bucket `court-photos`:

```
court-photos/
├── zgloszenia/{id-zgłoszenia}/…   ← z kreatora (użytkownik, także gość)
└── boiska/{id-boiska}/…           ← dodane ręcznie w panelu administratora
```

Odczyt jest publiczny, wgrywanie dozwolone tylko do `zgloszenia/` (limit 8 MB, jpeg/png/webp).
Zdjęcia są zmniejszane jeszcze w przeglądarce: 1280 px z aparatu, 1920 px z dysku, zawsze JPEG —
komplet sześciu kadrów to około 2 MB, czyli w darmowym gigabajcie mieści się ~400–500 boisk.

Sprzątanie plików:

| Akcja | Co dzieje się ze zdjęciami |
|---|---|
| Odrzucenie zgłoszenia | zostają — służą jako ślad moderacyjny |
| Trwałe usunięcie zgłoszenia | kasowane od razu |
| Usunięcie zdjęcia w edytorze | kasowane od razu |
| Usunięcie boiska | kasowane razem z wpisem |

Akceptacja zgłoszenia nie przenosi plików — karta boiska wskazuje na ten sam obiekt w `zgloszenia/`.
Dlatego kasowanie zawsze sprawdza, czy z pliku nie korzysta już opublikowane boisko
(`removeUnusedFiles` w `lib/queue.ts`), i takie pliki pomija.

> Uwaga przy weryfikacji: publiczne adresy zdjęć idą przez CDN, więc usunięty plik potrafi jeszcze
> przez chwilę zwracać 200. Źródłem prawdy jest `storage.objects` albo lista obiektów w panelu.

## Struktura

```
app/            trasy (mapa, boisko, dodaj, admin, ranking, ulubione, o-nas, auth/callback)
components/     UI: MapView, Sidebar, HoverCard, CourtDetail, add/*, admin/*
lib/            typy, filtry, dane testowe, repo (odczyt), queue (zgłoszenia), supabase/*
supabase/       schema.sql — cały backend w jednym pliku
public/geo/     granice województw
scripts/        kopiowanie workera MapLibre do public/
```

## Do zrobienia

- powiadomienia mailowe o akceptacji/odrzuceniu zgłoszenia (Supabase Edge Function + Resend),
- warianty rozmiarów zdjęć (miniatura do hovera, pełne do galerii),
- deploy na Vercel i domena `podkosz.pl`,
- aplikacja mobilna na tym samym backendzie.
