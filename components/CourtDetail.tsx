import Link from "next/link";
import { ACCESS_LABEL, Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { slugifyPlace } from "@/lib/site";
import { CourtPhoto } from "./CourtPhoto";
import { Gallery } from "./Gallery";
import { ShortsPlayer } from "./ShortsPlayer";
import { LikeButton } from "./LikeButton";
import { FavoriteButton } from "./FavoriteButton";
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
  DiceIcon,
  FunnyBadge,
  PencilIcon,
  PinIcon,
  SurfaceIcon,
} from "./icons";

/**
 * Wspólna szerokość treści. Na dużych monitorach kolumna 1152 px gubiła się w środku
 * ekranu, więc powyżej 1536 px rośnie razem z oknem (do 1720 px).
 */
const SHELL = "mx-auto w-full max-w-6xl px-6 2xl:max-w-[min(1720px,88vw)] 2xl:px-10";

export function CourtDetail({
  court,
  nearby = [],
  liked = false,
  favorite = false,
  signedIn = false,
  isAdmin = false,
  random,
}: {
  court: Court;
  nearby?: Court[];
  liked?: boolean;
  favorite?: boolean;
  signedIn?: boolean;
  /** administrator dostaje skrót do edycji tego wpisu */
  isAdmin?: boolean;
  /** wejście z losowania - wtedy na dole siedzi pasek „losuj dalej” */
  random?: { onlyFunny: boolean };
}) {
  return (
    <main className="min-h-dvh pb-24">
      <section className="relative h-[62vh] max-h-[780px] min-h-[420px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <CourtPhoto photo={court.photos[0]} seed={court.seed} />
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
            {isAdmin && (
              <Link
                href={`/admin?edytuj=${court.slug}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-full flame-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
              >
                <PencilIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> edytuj
              </Link>
            )}
            {random && (
              <Link
                href={`/losowe?omin=${court.slug}${random.onlyFunny ? "&dziwne=1" : ""}`}
                prefetch={false}
                className="inline-flex w-fit items-center gap-1.5 rounded-full flame-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
              >
                <DiceIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> losuj dalej
              </Link>
            )}
          </div>

          {/*
            Na telefonie kolejność jest inna niż na dużym ekranie: najpierw tytuł, pod nim
            plakietki, a potem współrzędne z ulubionymi po prawej. Wszystko trzyma się dołu
            zdjęcia, w obszarze gradientu, żeby nie zasłaniać kadru.
          */}
          <div className="flex flex-col">
            <h1 className="order-1 text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] sm:order-2 sm:mt-3 sm:text-[clamp(34px,6vw,64px)] sm:leading-[1.02]">
              {court.name}
            </h1>

            <div className="order-2 mt-2 flex flex-wrap items-center gap-1.5 sm:order-1 sm:mt-0 sm:gap-2">
              <span className="rounded-full border border-hairline bg-white/8 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.14em]">
                {TYPE_LABEL[court.type]}
              </span>
              <span className="rounded-full border border-hairline bg-white/8 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.14em]">
                {court.voivodeship}
              </span>
              {court.basketApproved && <BasketApprovedBadge />}
              {court.funny && <FunnyBadge />}
            </div>

            <div className="order-3 mt-2 flex items-center gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted sm:gap-2 sm:text-[15px]">
                <PinIcon className="h-4 w-4 shrink-0 text-flame" />
                <span className="truncate">
                  {court.city} · {court.lat.toFixed(4)}, {court.lng.toFixed(4)}
                </span>
              </p>
              {/* na telefonie ulubione siedzą przy współrzędnych, na dużym ekranie w rzędzie akcji */}
              <span className="ml-auto shrink-0 sm:hidden">
                <FavoriteButton
                  courtId={court.id}
                  initiallyFavorite={favorite}
                  signedIn={signedIn}
                  compact
                />
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-3">
            <LikeButton
              courtId={court.id}
              initial={court.likes}
              initiallyLiked={liked}
              signedIn={signedIn}
            />
            <span className="hidden sm:block">
              <FavoriteButton
                courtId={court.id}
                initiallyFavorite={favorite}
                signedIn={signedIn}
              />
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
          </div>
        </div>
      </section>

      <div className={SHELL}>
        {/*
          z-10 jest konieczne: kafelki wchodzą 24 px na sekcję hero, a przyciemniające
          warstwy hero są pozycjonowane absolutnie, więc bez tego malowałyby się NAD
          kafelkami i ścinały im górną krawędź razem z zaokrągleniem.
        */}
        <section className="relative z-10 -mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Spec icon={<HoopIcon className="h-5 w-5" />} label="Kosze" value={String(court.hoops)} />
          <Spec
            icon={<SurfaceIcon className="h-5 w-5" />}
            label="Nawierzchnia"
            value={surfaceLabel(court.surface)}
          />
          <Spec icon={<ClockIcon className="h-5 w-5" />} label="Godziny" value={court.hours} />
          <Spec
            icon={<CourtIcon className="h-5 w-5" />}
            label="Dostęp"
            value={ACCESS_LABEL[court.access]}
          />
          <Spec
            icon={<BulbIcon className="h-5 w-5" />}
            label="Oświetlenie"
            value={court.lit ? "Tak" : "Brak"}
          />
          <Spec
            icon={<FenceIcon className="h-5 w-5" />}
            label="Ogrodzenie"
            value={court.fenced ? "Tak" : "Brak"}
          />
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

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">O boisku</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink/90">{court.description}</p>

            {/* odnośniki do podstron miejsca: nawigacja dla ludzi i ścieżka dla wyszukiwarek */}
            <p className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
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
          </div>
          <div className="glass rounded-[22px] p-5">
            <h3 className="text-[13px] uppercase tracking-[0.18em] text-faint">Zgłoszone przez</h3>
            <p className="mt-2 text-[16px] font-semibold">@{court.addedBy}</p>
            <p className="text-[13px] text-muted">
              dodane {new Date(court.addedAt).toLocaleDateString("pl-PL")}
            </p>
            <div className="mt-4 border-t border-hairline pt-4 text-[13px] text-muted">
              Coś się nie zgadza? Napisz do nas - zaktualizujemy wpis.
            </div>
          </div>
        </section>

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

        {nearby.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-[13px] uppercase tracking-[0.18em] text-faint">
              W tym samym województwie
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {nearby.map((c) => (
                <Link
                  key={c.id}
                  href={`/boisko/${c.slug}`}
                  className="glass group overflow-hidden rounded-[22px] transition hover:brightness-110"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <CourtPhoto photo={c.photos[0]} seed={c.seed} />
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
    <div className="glass rounded-[20px] p-4 2xl:p-5">
      <span className="text-flame">{icon}</span>
      <p className="mt-2 text-[15px] font-semibold leading-tight 2xl:text-[17px]">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>
    </div>
  );
}
