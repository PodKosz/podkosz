import Link from "next/link";
import { ACCESS_LABEL, Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { formatDistance, slugifyPlace } from "@/lib/site";
import type { NearbyCourt } from "@/lib/repo";
import type { WeatherHour } from "@/lib/pogoda";
import { CourtPhoto } from "./CourtPhoto";
import { LinkEdycji, PasekLosowania, Podpalenie, Ulubione, ZagramDzis } from "./reakcje";
import { Pogoda } from "./Pogoda";
import { Gallery } from "./Gallery";
import { ShortsPlayer } from "./ShortsPlayer";
import { ReportButton } from "./ReportButton";
import {
  ArrowLeftIcon,
  BulbIcon,
  ClockIcon,
  CourtIcon,
  FenceIcon,
  FireBallIcon,
  HoopIcon,
  BasketApprovedBadge,
  FunnyBadge,
  PinIcon,
  SurfaceIcon,
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
}: {
  court: Court;
  nearby?: NearbyCourt[];
  /** prognoza godzinowa - pusta dla boisk krytych i gdy open-meteo nie odpowiada */
  weather?: WeatherHour[];
  /** aktualna godzina w Polsce, policzona na serwerze */
  nowHour?: number;
}) {
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
              <Link
                href={`/gracz/${slugifyPlace(court.addedBy)}`}
                className="font-semibold text-ink transition hover:text-flame"
              >
                @{court.addedBy}
              </Link>
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
          z-10 jest konieczne: kafelki wchodzą 24 px na sekcję hero, a przyciemniające
          warstwy hero są pozycjonowane absolutnie, więc bez tego malowałyby się NAD
          kafelkami i ścinały im górną krawędź razem z zaokrągleniem.
        */}
        {/*
          Jeden rząd: sześć węższych kafelków z parametrami i zaraz obok panel „kto dziś gra"
          razem z przyciskiem. Szerokość kafelków wylicza siatka - panel bierze co najmniej
          300 px, a parametry dzielą resztę równo między siebie.
        */}
        <section className="relative z-10 -mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_minmax(300px,1.2fr)]">
          <Spec icon={<HoopIcon className="h-7 w-7" />} label="Kosze" value={String(court.hoops)} />
          <Spec
            icon={<SurfaceIcon className="h-7 w-7" />}
            label="Nawierzchnia"
            value={surfaceLabel(court.surface)}
          />
          <Spec icon={<ClockIcon className="h-7 w-7" />} label="Godziny" value={court.hours} />
          <Spec
            icon={<CourtIcon className="h-7 w-7" />}
            label="Dostęp"
            value={ACCESS_LABEL[court.access]}
          />
          <Spec
            icon={<BulbIcon className="h-7 w-7" />}
            label="Oświetlenie"
            value={court.lit ? "Tak" : "Brak"}
          />
          <Spec
            icon={<FenceIcon className="h-7 w-7" />}
            label="Ogrodzenie"
            value={court.fenced ? "Tak" : "Brak"}
          />

          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
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

                <blockquote className="mt-5 text-[clamp(21px,2.9vw,34px)] font-semibold leading-[1.28] tracking-[-0.015em] text-white">
                  {court.basketNote}
                </blockquote>

                <p className="mt-5 text-[13px] text-white/55">
                  - Basket, twórca PodKosza
                </p>
              </div>
            </div>
          </section>
        )}

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

function Spec({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    /* wysokość równa panelowi „kto dziś gra" w tym samym rzędzie, więc wartość i podpis
       spychamy do dolnej krawędzi - inaczej kafelki miałyby puste dno */
    /* Kafelki równają się do wysokości panelu „kto dziś gra" (h-full), a wartość z podpisem
       siedzi pośrodku wolnej przestrzeni pod ikoną - nie przy dolnej krawędzi. */
    <div className="glass flex h-full min-h-[150px] flex-col rounded-[20px] p-4 2xl:p-5">
      <span className="text-flame">{icon}</span>
      <span className="flex flex-1 flex-col justify-center">
        <p className="text-[21px] font-semibold leading-[1.15] 2xl:text-[26px]">{value}</p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-faint 2xl:text-[11px]">
          {label}
        </p>
      </span>
    </div>
  );
}
