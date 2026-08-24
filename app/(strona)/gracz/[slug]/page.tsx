import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor, listContributors, listCourts } from "@/lib/repo";
import { historiaGracza, nickZeSlugu, statystykiGracza, ulubioneGracza } from "@/lib/profil";
import { CourtCard } from "@/components/CourtCard";
import { PlakietkiZaslug } from "@/components/PlakietkiZaslug";
import { WyroznieniaLatajace } from "@/components/WyroznieniaLatajace";
import { TloPilki } from "@/components/TloPilki";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { czyAutorAnonimowy, dataOpisowa, SITE_NAME, plural, slugifyPlace } from "@/lib/site";
import { ArrowLeftIcon, PinIcon } from "@/components/icons";

export const revalidate = 3600;

/* Profile osób, które już coś dodały, budujemy z góry - reszta dorobi się przy wejściu. */
export async function generateStaticParams() {
  const authors = await listContributors();
  return authors
    .filter((a) => !czyAutorAnonimowy(a.name))
    .map((a) => ({ slug: slugifyPlace(a.name) }));
}

/**
 * Nick spod adresu profilu.
 *
 * Najpierw szukamy wśród autorów boisk (dane publiczne, już w pamięci podręcznej), a jeśli
 * tam nikogo nie ma - wśród kont. Dzięki temu profil ma także ktoś, kto jeszcze nie dodał
 * żadnego boiska: wchodzi, widzi puste odznaczenia i wie, od czego zacząć.
 */
async function nickProfilu(slug: string): Promise<string | null> {
  const autor = await getAuthor(slug);
  if (autor) return czyAutorAnonimowy(autor.name) ? null : autor.name;
  return nickZeSlugu(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const nick = await nickProfilu(slug);
  if (!nick) return { title: `Gracz - ${SITE_NAME}` };

  const statystyki = await statystykiGracza(nick);
  const title = `@${nick} - profil gracza w PodKoszu`;
  const description = `${nick}: ${statystyki.boiska} ${plural(statystyki.boiska, [
    "dodane boisko",
    "dodane boiska",
    "dodanych boisk",
  ])}, ${statystyki.podpaleniaZebrane} ${plural(statystyki.podpaleniaZebrane, [
    "zebrana płonąca piłka",
    "zebrane płonące piłki",
    "zebranych płonących piłek",
  ])}. Zobacz odznaczenia i boiska.`;

  return {
    title,
    description,
    alternates: { canonical: `/gracz/${slug}` },
    openGraph: { type: "profile", locale: "pl_PL", siteName: SITE_NAME, title, description },
  };
}

/**
 * Publiczny profil gracza - wizytówka, nie pulpit.
 *
 * Układ jest wyśrodkowany i czytany z góry na dół: twarz, nick, plakietki za zasługi,
 * liczby, dodane boiska, ulubione i miejsca ostatnich gier. Pełną siatkę odznaczeń z
 * paskami postępu widzi tylko właściciel na swojej stronie „Moje konto" - tam jest to lista
 * celów, tu byłaby listą cudzych zadań.
 */
export default async function GraczPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nick = await nickProfilu(slug);
  if (!nick) notFound();

  const [autor, statystyki, ulubioneId, historia, wszystkie] = await Promise.all([
    getAuthor(slug),
    statystykiGracza(nick),
    ulubioneGracza(nick),
    historiaGracza(nick),
    listCourts(),
  ]);

  const boiska = autor?.courts ?? [];

  /* nazwy i zdjęcia dokładamy z listy boisk, którą i tak mamy w pamięci podręcznej */
  const poId = new Map(wszystkie.map((c) => [c.id, c]));
  const ulubione = ulubioneId.map((id) => poId.get(id)).filter((c) => c !== undefined);
  const wizyty = historia
    .map((w) => ({ day: w.day, court: poId.get(w.courtId) }))
    .filter((w) => w.court !== undefined);

  const kafelki: [string, number][] = [
    ["Boiska w bazie", statystyki.boiska],
    ["Zebrane podpalenia", statystyki.podpaleniaZebrane],
    ["Miejscowości", statystyki.miasta],
    ["Godziny na boisku", statystyki.godziny],
  ];

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <TloPilki uid="gracz" />

      <Link
        href="/ranking"
        className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> ranking graczy
      </Link>

      {/* ---------- wizytówka ---------- */}
      <header className="mt-10 flex flex-col items-center text-center">
        {/*
          Orbita wyróżnień musi być wycentrowana na awatarze, więc opakowujemy go w blok
          z `position: relative`. Sama orbita jest warstwą absolutną, więc nie zajmuje
          miejsca - nick i liczby stoją tam, gdzie stały.
        */}
        <span className="relative inline-grid">
        <span className="awatar-ramka">
          <span className="grid h-[132px] w-[132px] place-items-center overflow-hidden text-[40px] font-bold">
            {statystyki.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={statystyki.avatar}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="flame-text">{nick.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
        </span>

          <WyroznieniaLatajace statystyki={statystyki} />
        </span>

        <h1 className="mt-6 flame-text pb-1 text-[clamp(32px,6vw,58px)] font-semibold tracking-[-0.03em]">
          @{nick}
        </h1>

        <p className="text-[13px] text-muted">
          {statystyki.dolaczyl
            ? `w PodKoszu od ${dataOpisowa(statystyki.dolaczyl)}`
            : "autor boisk w bazie"}
        </p>

        <PlakietkiZaslug statystyki={statystyki} />
      </header>

      {/* ---------- liczby ---------- */}
      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kafelki.map(([label, wartosc]) => (
          <div key={label} className="kafel p-5 text-center">
            <p className="flame-text pb-1 text-[34px] font-bold leading-none tabular-nums">
              {wartosc}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
          </div>
        ))}
      </section>

      {/*
        Nie ma tu sekcji wyróżnień. Zdobyte krążą wokół zdjęcia profilowego, a lista „czego
        jeszcze nie mam" jest zadaniem do odhaczenia - to sprawa właściciela konta i widzi
        ją na /konto. Odwiedzającemu do niczego nie jest potrzebna.
      */}
      {/* ---------- dodane boiska ---------- */}
      <section className="mt-14">
        <NaglowekSekcji tytul={`Dodane boiska (${boiska.length})`} />

        {boiska.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boiska.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        ) : (
          <div className="szklo-pro mt-4 rounded-[28px] p-8 text-center">
            <p className="text-[15px] text-muted">
              Tu jeszcze nic nie ma. Pierwsze boisko zamienia pusty profil w pierwszy stopień
              odznaczenia „Odkrywca”.
            </p>
            <Link
              href="/dodaj"
              className="mt-5 inline-block rounded-2xl flame-gradient px-6 py-3 text-[13px] font-bold text-black transition hover:brightness-110"
            >
              Dodaj boisko
            </Link>
          </div>
        )}
      </section>

      {/* ---------- ulubione ---------- */}
      {ulubione.length > 0 && (
        <section className="mt-14">
          <NaglowekSekcji tytul={`Ulubione boiska (${ulubione.length})`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ulubione.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- gdzie ostatnio grał ---------- */}
      {wizyty.length > 0 && (
        <section className="mt-14">
          <NaglowekSekcji tytul="Gdzie ostatnio grał" />
          <ul className="mt-4 space-y-2">
            {wizyty.map((w, i) => (
              <li
                key={`${w.day}-${w.court?.slug ?? i}`}
                className="kafel flex items-center gap-4 px-5 py-4"
              >
                <span className="w-24 shrink-0 text-[13px] tabular-nums text-muted">
                  {new Date(w.day).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/boisko/${w.court!.slug}`}
                    className="block truncate text-[15px] font-medium transition hover:text-flame"
                  >
                    {w.court!.name}
                  </Link>
                  <span className="flex items-center gap-1.5 text-[12px] text-faint">
                    <PinIcon className="h-3 w-3 text-flame" /> {w.court!.city}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
