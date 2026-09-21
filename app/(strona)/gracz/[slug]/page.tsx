import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boiskaPoId, getAuthor, listContributors } from "@/lib/repo";
import { historiaGracza, nickZeSlugu, statystykiGracza, ulubioneGracza } from "@/lib/profil";
import { CourtCard } from "@/components/CourtCard";
import { Odznaczenia } from "@/components/Odznaczenia";
import { PilkaOdznaczen } from "@/components/PilkaOdznaczen";
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
 * Układ jest wyśrodkowany i czytany z góry na dół: piłka odznaczeń, nick, liczby, dodane
 * boiska, ulubione i miejsca ostatnich gier.
 *
 * Pierwsze, co widać, to piłka: dwadzieścia sześć odznaczeń jednym obrazkiem, bez czytania
 * choćby jednej liczby. Dopiero pod nią stoi ta sama treść słowami. Wcześniej pełna siatka
 * była wyłącznie na własnym koncie, bo lista „czego jeszcze nie mam" jest zadaniem do
 * odhaczenia, a nie wizytówką - ale skoro piłka i tak pokazuje wszystkie, także te
 * nierozpalone, to jej brak nic już nie chronił, a odbierał dostęp do szczegółu każdemu,
 * kto nie ma kursora.
 */
export default async function GraczPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nick = await nickProfilu(slug);
  if (!nick) notFound();

  const [autor, statystyki, ulubioneId, historia] = await Promise.all([
    getAuthor(slug),
    statystykiGracza(nick),
    ulubioneGracza(nick),
    historiaGracza(nick),
  ]);

  const boiska = autor?.courts ?? [];

  /*
    Nazwy i zdjęcia dobieramy DOKŁADNIE dla tych boisk, które profil pokaże - a jest ich
    najwyżej dwanaście ulubionych i dwanaście odwiedzin (limity w `migration-profil-publiczny.sql`).
    Wcześniej po to samo pobierana była cała lista boisk w Polsce razem ze zdjęciami.
  */
  const poId = await boiskaPoId([...ulubioneId, ...historia.map((w) => w.courtId)]);
  const ulubione = ulubioneId.map((id) => poId.get(id)).filter((c) => c !== undefined);
  const wizyty = historia
    .map((w) => ({ day: w.day, court: poId.get(w.courtId) }))
    .filter((w) => w.court !== undefined);

  /*
    `overflow-x-clip` na `main` niżej jest naprawą, nie ozdobą. Dymki przy stemplach
    wyróżnień mają `left-1/2` i stałą szerokość, więc ten z ostatniej kolumny wystaje poza
    okno - przy 768 px o 35 px - i dokłada całej stronie poziome przewijanie. Sekcja
    odznaczeń stała wcześniej wyłącznie na `/konto`, za logowaniem, więc nikt tego nie
    widział; na publicznym profilu zobaczy każdy z telefonem.

    `clip`, nie `hidden`: `hidden` na jednej osi zamienia drugą w `auto` i zabiłoby
    przyklejanie się nagłówków. `clip` zostawia oś pionową nietkniętą.
  */
  const kafelki: [string, number][] = [
    ["Boiska w bazie", statystyki.boiska],
    ["Zebrane podpalenia", statystyki.podpaleniaZebrane],
    ["Miejscowości", statystyki.miasta],
    ["Godziny na boisku", statystyki.godziny],
  ];

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl overflow-x-clip px-6 pb-24 pt-28">
      <TloPilki uid="gracz" />

      <Link
        href="/ranking"
        className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> ranking graczy
      </Link>

      {/* ---------- wizytówka ---------- */}
      <header className="mt-10 flex flex-col items-center text-center">
        <PilkaOdznaczen statystyki={statystyki} nick={nick} avatar={statystyki.avatar} />

        {/*
          Nazwa siedzi TUŻ POD PIŁKĄ - to jedna para, nie dwie osobne linijki. Bez małpy:
          pod piłką stoi imię, a nie identyfikator, i nic tu nie trzeba odróżniać od adresu.

          Liczba znaków idzie do arkusza, bo stopień pisma musi zależeć od DŁUGOŚCI NICKU,
          a nie tylko od szerokości okna. Sam `clamp` na `vw` dobrany pod „Basket" wyrzuciłby
          piętnastoznakowy nick poza kolumnę na każdym ekranie.
        */}
        <h1 className="nick-gracza pb-1" style={{ ["--znaki" as string]: nick.length }}>
          {nick}
        </h1>

        <p className="text-[13px] text-muted">
          {statystyki.dolaczyl
            ? `w PodKoszu od ${dataOpisowa(statystyki.dolaczyl)}`
            : "autor boisk w bazie"}
        </p>
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
        Ta sama treść, którą niesie piłka, tylko słowami: stopnie, liczniki, ile brakuje do
        następnego progu i wyróżnienia. Piłka mówi „jak wysoko", lista mówi „ile dokładnie" -
        i jako jedyna działa bez kursora oraz w czytniku ekranu.
      */}
      <Odznaczenia statystyki={statystyki} />

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
