import type { Metadata } from "next";
import { getCourtBySlug, getUserReactions, listNearby } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { CourtDetail } from "@/components/CourtDetail";
import { LocalCourtDetail } from "@/components/LocalCourtDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) return { title: "Boisko — PodKosz" };
  return {
    title: `${court.name}, ${court.city} — boisko do koszykówki`,
    description: court.description,
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

  const [nearby, user] = await Promise.all([listNearby(court), getSessionUser()]);
  const { likes, favorites } = await getUserReactions(user?.id ?? null);

  return (
    <CourtDetail
      court={court}
      nearby={nearby}
      liked={likes.has(court.id)}
      favorite={favorites.has(court.id)}
      signedIn={!!user}
      isAdmin={!!user?.isAdmin}
      random={query.losowe === "1" ? { onlyFunny: query.dziwne === "1" } : undefined}
    />
  );
}
