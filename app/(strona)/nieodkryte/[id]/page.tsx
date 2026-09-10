import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { punktOsm } from "@/lib/punkty-osm";
import { ZglosBrakBoiska } from "@/components/ZglosBrakBoiska";
import { ArrowLeftIcon, PinIcon } from "@/components/icons";

/**
 * Boisko nieodkryte - miejsce, w którym według OpenStreetMap stoi kosz, a u nas go nie ma.
 *
 * ------------------------------------------------------------------ dlaczego bez indeksowania
 *
 * `robots: noindex`. Takich punktów jest siedem tysięcy osiemset i żaden nie ma treści: ani
 * zdjęcia, ani opisu, ani nawet nazwy - bo z OSM bierzemy wyłącznie współrzędne. Wpuszczenie
 * ich do wyszukiwarki dałoby serwisowi osiem tysięcy pustych podstron, a wyszukiwarki oceniają
 * witrynę całościowo: te strony ciągnęłyby w dół karty prawdziwych boisk, czyli jedyne, na
 * których nam zależy.
 *
 * Adres istnieje mimo to, i to jest cały sens tej strony zamiast okienka na mapie: da się go
 * wysłać („chodź, zgarniemy to w sobotę"), działa przycisk wstecz, da się go dodać do zakładek.
 *
 * ------------------------------------------------------------------ odkryte przekierowuje
 *
 * Kiedy ktoś doda boisko bliżej niż pięćdziesiąt metrów, punkt gaśnie (wyzwalacz w bazie),
 * a ten adres przestaje mieć sens. Zamiast pokazywać zaproszenie do czegoś, co już istnieje,
 * odsyłamy na kartę tego boiska - stary link prowadzi wtedy dokładnie tam, gdzie powinien.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Boisko nieodkryte - PodKosz",
  robots: { index: false, follow: false },
};

export default async function NieodkrytePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const punkt = await punktOsm(id);

  if (!punkt || punkt.ukryty) notFound();
  if (punkt.odkrytePrzez) redirect(`/boisko/${punkt.odkrytePrzez}`);

  const nawigacja = `https://www.google.com/maps/dir/?api=1&destination=${punkt.lat},${punkt.lng}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="glass inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted transition hover:text-ink sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px]"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> mapa
      </Link>

      <section className="glass relative mt-8 overflow-hidden rounded-[28px] px-6 py-9 sm:px-10 sm:py-12">
        {/*
          Szara pinezka w powiększeniu - ta sama, co na mapie, żeby od pierwszej sekundy było
          wiadomo, w co się kliknęło. Bez ognia i bez poświaty: one należą się boiskom, na
          których ktoś już był.
        */}
        <span
          aria-hidden
          className="punkt-osm-kula mx-auto grid h-16 w-16 place-items-center rounded-full"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9.2" />
            <path d="M12 2.8v18.4M2.8 12h18.4" />
            <path d="M5.4 5.4c3.9 3.9 3.9 9.3 0 13.2M18.6 5.4c-3.9 3.9-3.9 9.3 0 13.2" />
          </svg>
        </span>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.18em] text-faint">
          Boisko nieodkryte
        </p>

        <h1 className="mt-3 text-center text-[clamp(26px,4.5vw,40px)] font-semibold leading-tight tracking-[-0.02em]">
          Przyjdź tu i dodaj to boisko
        </h1>

        <p className="mx-auto mt-5 max-w-md text-center text-[15px] leading-relaxed text-muted">
          W tym miejscu ma stać kosz, ale nikt go jeszcze nie dodał do PodKosza. Boisko dopisuje
          się <b className="text-ink">stojąc na nim</b> - telefon przypina pinezkę z GPS, a ty
          robisz sześć zdjęć. Zajmuje to trzy minuty i od tej chwili to boisko jest na mapie
          dla wszystkich, z twoim podpisem.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={nawigacja}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black transition hover:brightness-110"
          >
            Prowadź w to miejsce
          </a>
          <Link
            href="/dodaj"
            className="glass rounded-2xl px-6 py-3.5 text-[14px] font-medium transition hover:bg-white/10"
          >
            Jak dodać boisko
          </Link>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-[13px] tabular-nums text-faint">
          <PinIcon className="h-4 w-4 text-flame/70" />
          {punkt.lat.toFixed(5)}, {punkt.lng.toFixed(5)}
        </p>
      </section>

      <div className="mt-8 text-center">
        <ZglosBrakBoiska osmId={punkt.id} />
      </div>

      {/*
        Atrybucja. Nie grzeczność, tylko warunek licencji ODbL, na której udostępniona jest
        baza OpenStreetMap - a współrzędne tego punktu są z niej. Stoi na tej stronie, bo to
        jedyne miejsce w serwisie, gdzie punkt z OSM jest treścią, a nie tłem.
      */}
      <p className="mx-auto mt-10 max-w-md text-center text-[12px] leading-relaxed text-faint">
        Położenie tego miejsca pochodzi z{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 transition hover:text-muted"
        >
          OpenStreetMap
        </a>{" "}
        i jest udostępnione na licencji ODbL. PodKosz nie przejmuje stamtąd żadnych innych
        informacji o boisku - te dopisują ludzie, którzy tam byli.
      </p>
    </main>
  );
}
