import Link from "next/link";
import { ACCESS_LABEL, Court, SURFACE_LABEL, TYPE_LABEL } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { Gallery } from "./Gallery";
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
  PinIcon,
  SurfaceIcon,
} from "./icons";

export function CourtDetail({
  court,
  nearby = [],
  liked = false,
  favorite = false,
  signedIn = false,
}: {
  court: Court;
  nearby?: Court[];
  liked?: boolean;
  favorite?: boolean;
  signedIn?: boolean;
}) {
  return (
    <main className="min-h-dvh pb-24">
      <section className="relative h-[62vh] min-h-[420px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <CourtPhoto photo={court.photos[0]} seed={court.seed} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/45 to-void/70" />

        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-10">
          <Link
            href="/"
            className="glass mb-auto mt-24 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" /> mapa
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-hairline bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
              {TYPE_LABEL[court.type]}
            </span>
            <span className="rounded-full border border-hairline bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
              {court.voivodeship}
            </span>
            {court.basketApproved && <BasketApprovedBadge />}
          </div>

          <h1 className="mt-3 text-[clamp(34px,6vw,64px)] font-semibold leading-[1.02] tracking-[-0.02em]">
            {court.name}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-[15px] text-muted">
            <PinIcon className="h-4 w-4 text-flame" /> {court.city} · {court.lat.toFixed(4)},{" "}
            {court.lng.toFixed(4)}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LikeButton
              courtId={court.id}
              initial={court.likes}
              initiallyLiked={liked}
              signedIn={signedIn}
            />
            <FavoriteButton
              courtId={court.id}
              initiallyFavorite={favorite}
              signedIn={signedIn}
            />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`}
              target="_blank"
              rel="noreferrer"
              className="glass rounded-full px-5 py-3 text-[14px] font-medium text-ink transition hover:bg-white/10"
            >
              Prowadź do boiska
            </a>
            <ReportButton courtId={court.id} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <section className="-mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Spec icon={<HoopIcon className="h-5 w-5" />} label="Kosze" value={String(court.hoops)} />
          <Spec
            icon={<SurfaceIcon className="h-5 w-5" />}
            label="Nawierzchnia"
            value={SURFACE_LABEL[court.surface]}
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
                  — Basket, twórca PodKosza
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">O boisku</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink/90">{court.description}</p>
          </div>
          <div className="glass rounded-[22px] p-5">
            <h3 className="text-[13px] uppercase tracking-[0.18em] text-faint">Zgłoszone przez</h3>
            <p className="mt-2 text-[16px] font-semibold">@{court.addedBy}</p>
            <p className="text-[13px] text-muted">
              dodane {new Date(court.addedAt).toLocaleDateString("pl-PL")}
            </p>
            <div className="mt-4 border-t border-hairline pt-4 text-[13px] text-muted">
              Coś się nie zgadza? Napisz do nas — zaktualizujemy wpis.
            </div>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="mb-4 text-[13px] uppercase tracking-[0.18em] text-faint">
            Galeria · {court.photos.length} zdjęć
          </h2>
          <Gallery court={court} />
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
    <div className="glass rounded-[20px] p-4">
      <span className="text-flame">{icon}</span>
      <p className="mt-2 truncate text-[15px] font-semibold">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>
    </div>
  );
}
