import type { Metadata } from "next";
import { getCourtBySlug, getUserReactions, listNearby } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/site";
import { fetchWeather } from "@/lib/pogoda";
import { CourtDetail } from "@/components/CourtDetail";
import { CourtStructuredData } from "@/components/StructuredData";
import { LocalCourtDetail } from "@/components/LocalCourtDetail";

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
      images: [{ url: photo ?? "/icon.svg", alt: `${court.name}, ${court.city}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: court.description,
      images: photo ? [photo] : undefined,
    },
  };
}

export default async function CourtPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const court = await getCourtBySlug(slug);

  // Bez podpiętej bazy boiska zatwierdzone lokalnie żyją w localStorage.
  if (!court) return <LocalCourtDetail slug={slug} />;

  // pogodę pytamy tylko dla boisk odkrytych - pod dachem nie ma znaczenia
  const [nearby, user, weather] = await Promise.all([
    listNearby(court),
    getSessionUser(),
    court.type === "kryty" ? Promise.resolve([]) : fetchWeather(court.lat, court.lng),
  ]);
  const { likes, favorites } = await getUserReactions(user?.id ?? null);

  // godzina w Polsce liczona na serwerze, żeby prognoza zaczynała się od właściwej
  const nowHour = Number(
    new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Warsaw",
    }).format(new Date())
  );

  return (
    <>
      <CourtStructuredData court={court} />
      <CourtDetail
        court={court}
        nearby={nearby}
        liked={likes.has(court.id)}
        favorite={favorites.has(court.id)}
        signedIn={!!user}
        isAdmin={!!user?.isAdmin}
        random={query.losowe === "1" ? { onlyFunny: query.dziwne === "1" } : undefined}
        weather={weather}
        nowHour={nowHour}
      />
    </>
  );
}
