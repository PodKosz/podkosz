import { SzkicKafla, type RodzajSzkicu } from "./SzkicKafla";
import Link from "next/link";
import { ACCESS_LABEL, Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { czyAutorAnonimowy, formatDistance, slugifyPlace } from "@/lib/site";
import type { NearbyCourt } from "@/lib/repo";
import type { WeatherHour } from "@/lib/pogoda";
import { CourtPhoto } from "./CourtPhoto";
import {
  LinkEdycji,
  LinkWydarzenia,
  PasekLosowania,
  Podpalenie,
  Ulubione,
  ZagramDzis,
} from "./reakcje";
import { Pogoda } from "./Pogoda";
import { Gallery } from "./Gallery";
import { ShortsPlayer } from "./ShortsPlayer";
import { ReportButton } from "./ReportButton";
import { wysokiPlakat, type Wydarzenie } from "@/lib/wydarzenia";
import { BoxWydarzenia } from "./BoxWydarzenia";
import {
  ArrowLeftIcon,
  FireBallIcon,
  BasketApprovedBadge,
  FunnyBadge,
  PinIcon,
} from "./icons";

/**
 * Wspólna szerokość treści. Na dużych monitorach kolumna 1152 px gubiła się w środku
 * ekranu, więc powyżej 1536 px rośnie razem z oknem (do 1720 px).
 */
const SHELL = "mx-auto w-full max-w-6xl px-6 2xl:max-w-[min(1720px,88vw)] 2xl:px-10";

/*
  Karta boiska jest taka sama dla wszystkich - wszystko, co zależy od patrzącego (podpalenie,
  ulubione, skrót administratora, pasek losowania), dociągają komponenty z `reakcje.tsx`
  już w przeglądarce. Dopiero to pozwala trzymać tę stronę w pamięci podręcznej.
*/
export function CourtDetail({
  court,
  nearby = [],
  weather = [],
  nowHour = 12,
  wydarzenie = null,
}: {
  court: Court;
  /** wydarzenie na tym boisku - dostaje własny box nad wszystkim innym */
  wydarzenie?: Wydarzenie | null;
  nearby?: NearbyCourt[];
  /** prognoza godzinowa - pusta dla boisk krytych i gdy open-meteo nie odpowiada */
  weather?: WeatherHour[];
  /** aktualna godzina w Polsce, policzona na serwerze */
  nowHour?: number;
}) {
  /*
    Układ karty zależy od PROPORCJI PLAKATU wydarzenia - patrz `BoxWydarzenia`.
    Pion idzie w prawą kolumnę obok kafelków i opisu, poziom zostaje szerokim pasem nad
    nimi. Rozstrzygamy to tutaj, bo od tej jednej wartości zależy cała siatka sekcji,
    a nie tylko wnętrze samego boxa.
  */
  const wydarzenieObok = wydarzenie !== null && wysokiPlakat(wydarzenie);

  return (
    <main className="min-h-dvh pb-24">
      <section className="relative h-[62vh] max-h-[780px] min-h-[420px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <CourtPhoto photo={court.photos[0]} seed={court.seed} priority sizes="100vw" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/45 to-void/70" />
        {/*
          Mocniejsze wygaszenie dołu: kafelki parametrów wchodzą na zdjęcie i muszą być czytelne.
          Na telefonie pas jest wyższy, bo tytuł, plakietki, współrzędne i przyciski stoją niżej -
          wszystkie muszą leżeć na przygaszonym tle, nie na samym kadrze.
        */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-void via-void/85 to-transparent sm:h-56" />

        <div className={`relative flex h-full flex-col justify-end pb-10 ${SHELL}`}>
          <div className="mb-auto mt-16 flex flex-wrap items-center gap-2 sm:mt-24 sm:gap-3">
            <Link
              href="/"
              className="glass inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted transition hover:text-ink sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> mapa
            </Link>
            <LinkEdycji slug={court.slug} />
            <LinkWydarzenia slug={court.slug} />
            <PasekLosowania slug={court.slug} />
          </div>

          {/*
            Tytuł, a pod nim jedna linia: współrzędne i zaraz obok plakietki (typ boiska,
            województwo, wyróżnienia). Wszystko trzyma się dołu zdjęcia, w obszarze
            gradientu, żeby nie zasłaniać kadru. Na telefonie linia zawija się sama.
          */}
          <div className="flex flex-col">
            <h1 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] sm:mt-3 sm:text-[clamp(34px,6vw,64px)] sm:leading-[1.02]">
              {court.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted sm:gap-2 sm:text-[15px]">
                <PinIcon className="h-4 w-4 shrink-0 text-flame" />
                <span className="truncate">
                  {court.city} · {court.lat.toFixed(4)}, {court.lng.toFixed(4)}
                </span>
              </p>

              <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded-full border border-hairline bg-white/8 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.14em]">
                  {TYPE_LABEL[court.type]}
                </span>
                <span className="rounded-full border border-hairline bg-white/8 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.14em]">
                  {court.voivodeship}
                </span>
                {court.basketApproved && <BasketApprovedBadge />}
                {court.funny && <FunnyBadge />}
              </span>
              {/* na telefonie ulubione siedzą przy współrzędnych, na dużym ekranie w rzędzie akcji */}
              <span className="ml-auto shrink-0 sm:hidden">
                <Ulubione courtId={court.id} compact />
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-3">
            <Podpalenie courtId={court.id} likes={court.likes} />
            <span className="hidden sm:block">
              <Ulubione courtId={court.id} />
            </span>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`}
              target="_blank"
              rel="noreferrer"
              className="glass rounded-full px-4 py-2.5 text-[13px] font-medium text-ink transition hover:bg-white/10 sm:px-5 sm:py-3 sm:text-[14px]"
            >
              Prowadź do boiska
            </a>
            <ReportButton courtId={court.id} />

            {/* autor wpisu i data - przy akcjach, po prawej stronie rzędu */}
            <p className="ml-auto hidden text-right text-[13px] leading-tight text-muted lg:block">
              <span className="block text-[11px] uppercase tracking-[0.16em] text-faint">
                Zgłoszone przez
              </span>
              {/*
                Zgłoszenia bez konta nie mają profilu (i nie wchodzą do rankingu graczy),
                więc podpis „gość" zostaje zwykłym tekstem - link prowadziłby na 404.
              */}
              {czyAutorAnonimowy(court.addedBy) ? (
                <span className="font-semibold text-ink">@{court.addedBy}</span>
              ) : (
                <Link
                  href={`/gracz/${slugifyPlace(court.addedBy)}`}
                  className="font-semibold text-ink transition hover:text-flame"
                >
                  @{court.addedBy}
                </Link>
              )}
              <span className="text-faint">
                {" "}
                · {new Date(court.addedAt).toLocaleDateString("pl-PL")}
              </span>
            </p>
          </div>
        </div>
      </section>

      <div className={SHELL}>
        {/*
          Wydarzenie stoi NAD parametrami boiska i to jest cała hierarchia tej strony
          w jednym miejscu: jeśli na boisku coś się dzieje, to jest najważniejsza rzecz
          o tym boisku. Nawierzchnia i liczba koszy nie zmieniły się od miesięcy i nie
          zmienią przez najbliższą godzinę.

          Szerokim pasem jest tylko wtedy, gdy plakat jest poziomy. Pionowy plakat wchodzi
          niżej, w prawą kolumnę obok kafelków - w pasie zostawiałby ścianę pustki.
        */}
        {wydarzenie && !wydarzenieObok && <BoxWydarzenia wydarzenie={wydarzenie} />}

        {/*
          Dwie kolumny tylko przy pionowym plakacie: po lewej kafelki z parametrami i box
          z opisem, po prawej wysoka karta wydarzenia na całą ich wysokość. Bez wydarzenia
          (albo przy poziomym plakacie) ten sam kod daje zwykły, jednokolumnowy układ -
          `grid` z jedną kolumną nie zmienia niczego w wyglądzie.
        */}
        <div
          className={
            wydarzenieObok
              ? "relative z-10 -mt-6 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]"
              : ""
          }
        >
          {/*
            `@container` czyni z tego miejsca punkt odniesienia dla zapytań `@min-[...]`
            na siatce kafelków niżej. Kafelki muszą zmieścić się W TEJ KOLUMNIE, a nie
            w oknie: gdy obok stoi karta wydarzenia, zabiera z prawej 360 px, więc
            szerokość okna nic o miejscu dla kafelków nie mówi. To pierwsze zapytanie
            kontenerowe w tym projekcie; Tailwind 4 ma je wbudowane.

            Podciągnięcie kafelków na zdjęcie w hero przeniosło się tutaj z samej siatki.
            `container-type` włącza `contain: layout`, a to WYŁĄCZA scalanie marginesów:
            ujemny margines zostawiony na siatce podciągałby ją wewnątrz tego bloku
            i zostawiał pod nią 24 px pustki, zamiast przesunąć całość na zdjęcie.
          */}
          <div
            className={`@container min-w-0 ${
              wydarzenieObok ? "" : `relative z-10 ${wydarzenie ? "mt-3" : "-mt-6"}`
            }`}
          >

        {/*
          z-10 jest konieczne: kafelki wchodzą 24 px na sekcję hero, a przyciemniające
          warstwy hero są pozycjonowane absolutnie, więc bez tego malowałyby się NAD
          kafelkami i ścinały im górną krawędź razem z zaokrągleniem.
        */}
        {/*
          Jeden rząd: sześć węższych kafelków z parametrami i zaraz obok panel „kto dziś gra"
          razem z przyciskiem. Szerokość kafelków wylicza siatka - panel bierze co najmniej
          300 px, a parametry dzielą resztę równo między siebie.
        */}
        {/*
          Ujemny margines podciąga kafelki 24 px na zdjęcie w hero - ale TYLKO wtedy, gdy
          kafelki są pierwsze. Z boxem wydarzenia nad nimi ten sam margines wjeżdżał na
          box i ścinał mu dolną krawędź razem z ramką. Podciągnięcie należy do elementu,
          który stoi najwyżej, nie do konkretnej sekcji.
        */}
        <section
          /*
            LICZBA KOLUMN ZALEŻY OD SZEROKOŚCI KOLUMNY, NIE OKNA.

            Wcześniej stały tu progi okna (`lg`, a przy karcie wydarzenia `xl`) i oba
            były za małe. Zmierzone w przeglądarce przy oknie 1440 px:

              boisko z kartą wydarzenia obok - kolumna 732 px, siedem kolumn dawało
              kafelki po 67 px; „Poliuretan" i „Całodobowo" wystawały z nich i nachodziły
              na sąsiadów, na ekranie było „CałodobTaklo",

              boisko bez wydarzenia - sekcja 1104 px, kafelki po 122 px, a „Poliuretan"
              (97 px) i „Ograniczony" (120 px) mają tylko 88 px na treść.

            Progu okna nie da się tu dobrze ustawić, bo karta wydarzenia zabiera z prawej
            360 px: przy tym samym oknie kafelki mają raz 1104 px, raz 732 px. Dlatego
            pyta się o szerokość kontenera (`@container` wyżej), a nie okna.

            Skąd te dwie liczby. Najdłuższe słowo, jakie może tu trafić, to „Ograniczony"
            z `ACCESS_LABEL`. Zmierzone w przeglądarce: 120 px przy 21 px półgrubą i 148 px
            przy 26 px. Wartość w kafelku ma teraz 22 i 28 px (napis jest na wierzchu
            rysunku i musi być czytelny z daleka), czyli 126 i 160 px, a z wyściółką
            2 x 16 i 2 x 20 px - 158 i 200 px na kafelek:

              6 kafelków po 158 px + 5 przerw po 12 px             = 1008  ->  @min-[1020px]
              6 kafelków po 200 px + panel 300 px + 6 przerw       = 1572  ->  @min-[1580px]

            CZCIONKA I WYŚCIÓŁKA IDĄ TYM SAMYM PROGIEM co kolumny (patrz `Spec` na dole
            pliku), a nie progiem okna `2xl`. Inaczej te dwie liczby by się rozjechały:
            próg kolumn pytałby o kontener, a rozmiar napisu o okno, i przy oknie 1600 px
            z węższą kolumną kafelki dostawałyby sześć kolumn policzonych dla czcionki
            21 px, a napis rysowałby się czcionką 26 px.

            Poniżej 1020 px kafelki idą po trzy w rzędzie, a na telefonie po dwa - i tam
            mają po 165 px, czyli tyle, ile trzeba (158 px), z zapasem siedmiu pikseli.
            Gdyby wartość miała jeszcze urosnąć, to jest miejsce, które pęknie pierwsze.

            Panel „kto dziś gra" siedzi obok kafelków tylko w układzie siedmiokolumnowym;
            niżej bierze cały rząd, bo w węższej kolumnie jego przycisk nie ma się gdzie
            zmieścić.
          */
          className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3 @min-[1020px]:grid-cols-6 @min-[1580px]:grid-cols-[repeat(6,minmax(0,1fr))_minmax(300px,1.2fr)]"
        >
          <Spec rodzaj="kosze" label="Kosze" value={String(court.hoops)} />
          <Spec rodzaj="nawierzchnia" label="Nawierzchnia" value={surfaceLabel(court.surface)} />
          <Spec rodzaj="godziny" label="Godziny" value={court.hours} />
          <Spec rodzaj="dostep" label="Dostęp" value={ACCESS_LABEL[court.access]} />
          <Spec rodzaj="oswietlenie" label="Oświetlenie" value={court.lit ? "Tak" : "Brak"} />
          <Spec rodzaj="ogrodzenie" label="Ogrodzenie" value={court.fenced ? "Tak" : "Brak"} />

          {/*
            Panel „kto dziś gra" zajmuje cały rząd, dopóki kafelki nie ustawią się w siedem
            kolumn. `col-span-full` zamiast wyliczanych `col-span-2 sm:col-span-3`: liczba
            kolumn zmienia się teraz zapytaniem kontenerowym, więc żadna stała liczba nie
            byłaby dobra we wszystkich układach - a „cały rząd" jest dobra w każdym.
          */}
          <div className="col-span-full @min-[1580px]:col-span-1">
            <ZagramDzis courtId={court.id} />
          </div>
        </section>

        {court.basketApproved && court.basketNote && (
          <section className="relative mt-12 overflow-hidden rounded-[28px] p-[1.5px] basket-gradient">
            <div className="relative overflow-hidden rounded-[27px] bg-[#0e0817] px-7 py-9 sm:px-12 sm:py-12">
              {/* poświata w tle, żeby sekcja świeciła a nie tylko miała ramkę */}
              <span
                className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(168,85,247,.45) 0%, rgba(109,40,217,.12) 55%, transparent 72%)",
                }}
              />
              <span
                className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(109,40,217,.35) 0%, transparent 70%)",
                }}
              />

              <div className="relative">
                <div className="flex items-center gap-3">
                  <FireBallIcon variant="basket" className="h-8 w-8" />
                  <p className="text-[13px] font-bold uppercase tracking-[0.28em] basket-text">
                    Basket Approved
                  </p>
                </div>

                <blockquote className="mt-5 text-[clamp(21px,2.9vw,34px)] font-semibold leading-[1.28] tracking-[-0.015em] text-kadr">
                  {court.basketNote}
                </blockquote>

                <p className="mt-5 text-[13px] text-kadr/55">
                  - Basket, twórca PodKosza
                </p>
              </div>
            </div>
          </section>
        )}

          </div>

          {/*
            Karta wydarzenia w prawej kolumnie. Na telefonie kolumny nie ma, więc idzie
            NA GÓRĘ (`order-first`) - wydarzenie jest ważniejsze od nawierzchni, a przy
            jednej kolumnie kolejność w drzewie to cała hierarchia.
          */}
          {wydarzenie && wydarzenieObok && (
            <div className="order-first lg:order-none">
              <BoxWydarzenia wydarzenie={wydarzenie} />
            </div>
          )}
        </div>

        <section className="mt-14">
          <h2 className="mb-4 text-[13px] uppercase tracking-[0.18em] text-faint">
            Galeria · {court.photos.length} zdjęć
            {court.shortsUrl && <span className="text-flame"> + film</span>}
          </h2>
          {/* film wchodzi w prawą kolumnę galerii (na telefonie ląduje pod zdjęciami) */}
          <Gallery
            court={court}
            video={
              court.shortsUrl ? (
                <ShortsPlayer url={court.shortsUrl} title={`${court.name}, ${court.city}`} />
              ) : null
            }
          />
        </section>


        {/*
          Opis boiska idzie po galerii i jest największym tekstem na stronie - to jedyne
          zdanie napisane ręką człowieka, więc ma prawo krzyczeć. Gradient marki zamiast
          zwykłej bieli.
        */}
        <section className="mt-16">
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">O boisku</h2>
          <p className="mt-4 max-w-4xl flame-text text-[clamp(24px,3.4vw,40px)] font-semibold leading-[1.25] tracking-[-0.01em]">
            {court.description}
          </p>

          {/* odnośniki do podstron miejsca: nawigacja dla ludzi i ścieżka dla wyszukiwarek */}
          <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Więcej boisk:
            <Link
              href={`/miasto/${slugifyPlace(court.city)}`}
              className="rounded-full border border-hairline bg-white/6 px-3 py-1 transition hover:text-ink"
            >
              {court.city}
            </Link>
            <Link
              href={`/wojewodztwo/${slugifyPlace(court.voivodeship)}`}
              className="rounded-full border border-hairline bg-white/6 px-3 py-1 transition hover:text-ink"
            >
              {court.voivodeship}
            </Link>
          </p>
        </section>

        {/* pod opisem pogoda, a pod nią najbliższe boiska */}
        {weather.length > 0 && <Pogoda hours={weather} nowHour={nowHour} />}

        {nearby.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-[13px] uppercase tracking-[0.18em] text-faint">
              Najbliższe boiska
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {nearby.map(({ court: c, distanceM }) => (
                <Link
                  key={c.id}
                  href={`/boisko/${c.slug}`}
                  className="glass group overflow-hidden rounded-[22px] transition hover:brightness-110"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="(max-width: 640px) 100vw, 380px" />
                    {distanceM !== null && (
                      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">
                        {formatDistance(distanceM)}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-[15px] font-semibold">{c.name}</p>
                    <p className="text-[13px] text-muted">
                      {c.city} · {TYPE_LABEL[c.type]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* stopka karty boiska - zaproszenie do poprawki wpisu, na samym końcu strony */}
      <div className={`mt-20 border-t border-hairline pt-10 ${SHELL}`}>
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[18px] font-semibold">Coś się nie zgadza?</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted">
            Zmieniły się godziny, zniknęła siatka, zdjęcia są nieaktualne? Napisz - zaktualizujemy
            wpis.
          </p>
          <div className="mt-6">
            <ReportButton courtId={court.id} label="Zgłoś zmianę" prominent />
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Kafelek z jednym parametrem boiska.
 *
 * Pod napisem leży rysunek w tym samym języku, co obrysy w tle rankingu, graczy i „o nas"
 * (`SzkicKafla`): włosowa kreska w barwie marki, przygaszona i miejscami puszczona, jakby
 * stawiała ją ręka. Wcześniej stała tu mała pomarańczowa ikonka w lewym górnym narożniku
 * i wartość przy lewej krawędzi - kafelek wyglądał jak wiersz tabeli.
 *
 * Kolejność jest tu odwrócona względem tego, co zwykle: NAPIS JEST TREŚCIĄ, rysunek tłem.
 * Dlatego rysunek ma 22% widoczności i nie dotyka krawędzi (86% pola), a wartość dostała
 * 22 px zamiast 21 i stoi na środku. Gdyby rysunek był mocniejszy, konkurowałby z liczbą,
 * po którą się na ten kafelek patrzy.
 *
 * Rozmiary rosną progiem KONTENERA (`@min-[1580px]`), nie okna: to ten sam próg, którym
 * siatka wyżej przechodzi na siedem kolumn, i dokładnie dla tych rozmiarów policzono tam
 * szerokość kafelka. Rozjazd tych dwóch progów oznaczałby napis policzony dla innej
 * czcionki, niż się rysuje.
 */
function Spec({
  rodzaj,
  label,
  value,
}: {
  rodzaj: RodzajSzkicu;
  label: string;
  value: string;
}) {
  return (
    <div className="glass kafel-zywy relative flex h-full min-h-[150px] flex-col items-center justify-center overflow-hidden rounded-[20px] p-4 @min-[1580px]:p-5">
      {/*
        Rysunek wypełnia CAŁY kafelek, bez wcięcia. To zamierzone: ma być fragmentem
        czegoś większego, wychodzącym za krawędzie, a nie ikonką położoną na środku
        z marginesem wokół (patrz nota w `SzkicKafla`). Przycięcie robi `overflow-hidden`
        na kafelku, a zaokrąglenie narożników bierze się z jego `rounded-[20px]`.
      */}
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <SzkicKafla rodzaj={rodzaj} />
      </span>

      {/*
        Osłona pod napisem. Rysunek jest teraz grubą kreską przechodzącą przez cały
        kafelek, więc bez niej linie biegną dokładnie przez litery. Promienista i bardzo
        miękka - ma odjąć kontrast pod tekstem, a nie położyć pod nim prostokąt.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 44% at 50% 58%, rgb(var(--rgb-plyta) / .72) 0%," +
            "rgb(var(--rgb-plyta) / .5) 34%, rgb(var(--rgb-plyta) / .22) 62%," +
            "rgb(var(--rgb-plyta) / 0) 100%)",
        }}
      />

      <span className="relative flex flex-col items-center text-center">
        {/* `break-words` to bezpiecznik: gdyby kiedyś trafiła tu wartość dłuższa niż
            „Ograniczony" (na podstawie którego dobrane są progi kolumn wyżej), złamie
            się w środku słowa zamiast wyjść na sąsiedni kafelek */}
        <p className="text-[22px] font-semibold leading-[1.15] break-words @min-[1580px]:text-[28px]">
          {value}
        </p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-faint @min-[1580px]:text-[11px]">
          {label}
        </p>
      </span>
    </div>
  );
}
