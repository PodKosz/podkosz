import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor, listContributors } from "@/lib/repo";
import { nickZeSlugu, statystykiGracza } from "@/lib/profil";
import { CourtCard } from "@/components/CourtCard";
import { Odznaczenia } from "@/components/Odznaczenia";
import { czyAutorAnonimowy, SITE_NAME, plural, slugifyPlace } from "@/lib/site";
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
    <main className="mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <Link
        href="/ranking"
        className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> ranking graczy
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-5">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full flame-gradient text-[26px] font-bold text-black">
          {statystyki.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={statystyki.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            nick.slice(0, 1).toUpperCase()
          )}
        </span>

        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Profil gracza</p>
          <h1 className="mt-1 truncate text-[clamp(28px,5vw,48px)] font-semibold tracking-[-0.02em]">
            @{nick}
          </h1>
          {statystyki.dolaczyl && (
            <p className="mt-1 text-[13px] text-muted">
              w PodKoszu od{" "}
              {new Date(statystyki.dolaczyl).toLocaleDateString("pl-PL", {
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kafelki.map(([label, wartosc]) => (
          <div key={label} className="glass rounded-[20px] p-4">
            <p className="flame-text pb-1 text-[30px] font-bold leading-none tabular-nums">
              {wartosc}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
          </div>
        ))}
      </section>

      <Odznaczenia statystyki={statystyki} />

      <section className="mt-12">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">
          Dodane boiska
          {boiska.length > 0 && (
            <span className="ml-2 text-glow">
              <FireBallIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {statystyki.podpaleniaZebrane}
            </span>
          )}
        </h2>

        {boiska.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boiska.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        ) : (
          <div className="glass mt-4 rounded-[24px] p-8 text-center">
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
