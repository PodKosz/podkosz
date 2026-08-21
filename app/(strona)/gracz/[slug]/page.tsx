import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor, listContributors } from "@/lib/repo";
import { nickZeSlugu, statystykiGracza } from "@/lib/profil";
import { CourtCard } from "@/components/CourtCard";
import { Odznaczenia } from "@/components/Odznaczenia";
import { TloPilki } from "@/components/TloPilki";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { czyAutorAnonimowy, dataOpisowa, SITE_NAME, plural, slugifyPlace } from "@/lib/site";
import { ArrowLeftIcon, FireBallIcon } from "@/components/icons";

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

export default async function GraczPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nick = await nickProfilu(slug);
  if (!nick) notFound();

  const [autor, statystyki] = await Promise.all([getAuthor(slug), statystykiGracza(nick)]);
  const boiska = autor?.courts ?? [];

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

      {/*
        Wizytówka gracza: avatar w gradientowym pierścieniu, nick i data dołączenia na
        jednej szklanej płycie. Liczby siedzą w tej samej karcie, więc profil otwiera się
        jednym spójnym kadrem, a nie serią osobnych pudełek.
      */}
      <header className="szklo-pro mt-6 rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span className="awatar-ramka shrink-0">
            <span className="grid h-[86px] w-[86px] place-items-center overflow-hidden text-[28px] font-bold">
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

          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Profil gracza</p>
            <h1 className="mt-1 truncate text-[clamp(28px,5vw,48px)] font-semibold tracking-[-0.02em]">
              @{nick}
            </h1>
            {statystyki.dolaczyl && (
              <p className="mt-1 text-[13px] text-muted">
                w PodKoszu od {dataOpisowa(statystyki.dolaczyl)}
              </p>
            )}
          </div>

          {boiska.length > 0 && (
            <p className="ml-auto hidden items-center gap-2 rounded-full border border-flame/35 bg-flame/10 px-4 py-2 text-[14px] font-semibold text-glow sm:flex">
              <FireBallIcon className="h-4 w-4" /> {statystyki.podpaleniaZebrane}
              <span className="text-[12px] font-normal uppercase tracking-[0.12em] text-muted">
                {plural(statystyki.podpaleniaZebrane, ["podpalenie", "podpalenia", "podpaleń"])}
              </span>
            </p>
          )}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kafelki.map(([label, wartosc]) => (
            <div key={label} className="kafel p-4">
              <p className="flame-text pb-1 text-[30px] font-bold leading-none tabular-nums">
                {wartosc}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
            </div>
          ))}
        </div>
      </header>

      <Odznaczenia statystyki={statystyki} />

      <section className="mt-12">
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
    </main>
  );
}
