import Link from "next/link";
import { Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { Place } from "@/lib/repo";
import { CourtCard } from "./CourtCard";
import { ArrowLeftIcon, PinIcon } from "./icons";

/**
 * Wspólna treść podstron „boiska do koszykówki - Kraków" i „- małopolskie". Te strony
 * istnieją dla ludzi, którzy szukają w Google frazy z nazwą miejsca: mapa na stronie
 * głównej nie da się pod takie zapytanie podstawić, bo nie ma osobnego adresu ani nagłówka.
 *
 * Nazwy miejsc występują wyłącznie w mianowniku („boiska do koszykówki - Kraków", a nie
 * „w Krakowie"), bo odmiana polskich nazw własnych wymagałaby słownika, a błędna odmiana
 * czyta się gorzej niż jej brak.
 */
export function PlaceListing({
  place,
  courts,
  kind,
  siblings,
}: {
  place: Place;
  courts: Court[];
  kind: "city" | "voivodeship";
  /** sąsiednie miejsca do przeklikania: miasta w tym województwie albo pozostałe województwa */
  siblings: Place[];
}) {
  const label = kind === "city" ? place.name : `województwo ${place.name}`;
  const lit = courts.filter((c) => c.lit).length;
  const hoops = courts.reduce((sum, c) => sum + c.hoops, 0);
  const surfaces = [...new Set(courts.map((c) => surfaceLabel(c.surface)))];
  const types = [...new Set(courts.map((c) => TYPE_LABEL[c.type]))];

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <Link
        href="/"
        className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> mapa Polski
      </Link>

      <header className="mt-6">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">
          {kind === "city" ? "Miejscowość" : "Województwo"}
        </p>
        <h1 className="mt-2 text-[clamp(30px,5vw,52px)] font-semibold leading-tight tracking-[-0.02em]">
          Boiska do koszykówki - {label}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          {place.name}:{" "}
          {courts.length === 1 ? "jedno boisko" : `${courts.length} boisk`} w bazie PodKosza, razem{" "}
          {hoops} {hoops === 1 ? "kosz" : "koszy"}
          {lit > 0 && `, w tym ${lit} z oświetleniem`}. Każdy wpis ma zdjęcia w jednym standardzie,
          nawierzchnię, godziny dostępności i dokładną lokalizację na mapie.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[...types, ...surfaces].map((t) => (
            <span
              key={t}
              className="rounded-full border border-hairline bg-white/6 px-3 py-1 text-[12px] text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((court) => (
          <CourtCard key={court.id} court={court} showCity={kind !== "city"} />
        ))}
      </div>

      {siblings.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">
            {kind === "city"
              ? `Inne miejscowości - ${place.voivodeship}`
              : "Boiska w pozostałych województwach"}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.slug}
                href={`/${kind === "city" ? "miasto" : "wojewodztwo"}/${s.slug}`}
                className="glass flex items-center gap-2 rounded-full px-4 py-2 text-[13px] text-muted transition hover:text-ink"
              >
                <PinIcon className="h-3.5 w-3.5 text-flame" />
                {s.name}
                <span className="text-faint">{s.courts}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="glass mt-14 rounded-[24px] p-8 text-center">
        <p className="text-[15px] text-muted">
          Znasz boisko, którego tu nie ma? Dodanie zajmuje trzy minuty i nie wymaga konta.
        </p>
        <Link
          href="/dodaj"
          className="mt-5 inline-block rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black transition hover:brightness-110"
        >
          Dodaj boisko
        </Link>
      </section>
    </main>
  );
}
