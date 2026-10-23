import type { Metadata } from "next";
import { avatarAutora, getCourtBySlug, listNearby, slugiBoisk } from "@/lib/repo";
import { SITE_NAME } from "@/lib/site";
import { fetchWeather } from "@/lib/pogoda";
import { CourtDetail } from "@/components/CourtDetail";
import { wydarzenieBoiska } from "@/lib/wydarzenia";
import { CourtStructuredData } from "@/components/StructuredData";
import { LocalCourtDetail } from "@/components/LocalCourtDetail";
import { adresBoiska } from "@/lib/adres-boiska";

/*
  Karta boiska nie zawiera już nic zależnego od użytkownika (podpalenia, ulubione i skrót
  administratora dociąga przeglądarka), więc może być zbudowana z góry i serwowana z cache.
  Pół godziny to kompromis z prognozą pogody, która i tak jest godzinowa; publikacja lub
  edycja boiska unieważnia znacznik i strona przebudowuje się od razu.
*/
export const revalidate = 1800;

export async function generateStaticParams() {
  const slugi = await slugiBoisk();
  return slugi.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) return { title: "Boisko - PodKosz" };

  const title = `${court.name}, ${court.city} - boisko do koszykówki`;
  const path = `/boisko/${court.slug}`;
  // zdjęcie tytułowe jako podgląd przy udostępnianiu; boiska bez zdjęć dostają logo serwisu
  const photo = court.photos.find((p) => p.url)?.url;

  return {
    title,
    description: court.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "pl_PL",
      siteName: SITE_NAME,
      title,
      description: court.description,
      url: path,
      images: [{ url: photo ?? "/icon.png", alt: `${court.name}, ${court.city}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: court.description,
      images: photo ? [photo] : undefined,
    },
  };
}

export default async function CourtPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);

  // Bez podpiętej bazy boiska zatwierdzone lokalnie żyją w localStorage.
  if (!court) return <LocalCourtDetail slug={slug} />;

  // pogodę pytamy tylko dla boisk odkrytych - pod dachem nie ma znaczenia
  const [nearby, weather, wydarzenie, avatar, adres] = await Promise.all([
    listNearby(court),
    court.type === "kryty" ? Promise.resolve([]) : fetchWeather(court.lat, court.lng),
    wydarzenieBoiska(court.id),
    avatarAutora(court.addedBy),
    adresBoiska(court.lat, court.lng),
  ]);

  // data i godzina w Polsce liczone na serwerze, żeby prognoza zaczynała się od właściwej (sv-SE daje „2026-10-23 21”)
  const teraz = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  })
    .format(new Date())
    .replace(" ", "T");

  return (
    <>
      <CourtStructuredData court={court} />
      <CourtDetail
        court={court}
        nearby={nearby}
        weather={weather}
        teraz={teraz}
        wydarzenie={wydarzenie}
        avatarAutora={avatar}
        adres={adres}
      />
    </>
  );
}
