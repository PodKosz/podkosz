import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCourtsForPlace, listPlaces } from "@/lib/repo";
import { PlaceListing } from "@/components/PlaceListing";
import { SITE_NAME } from "@/lib/site";

/** Podstrony miejscowości odświeżamy raz na godzinę - treść zmienia się z nowymi boiskami. */
export const revalidate = 3600;

/*
  Miejscowości, które są w bazie w chwili budowania, powstają od razu i leżą w cache; nowe
  dorobią się strony przy pierwszym wejściu i też zostaną zapamiętane.
*/
export async function generateStaticParams() {
  const { cities } = await listPlaces();
  return cities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await listCourtsForPlace("city", slug);
  if (!found) return { title: `Boiska do koszykówki - ${SITE_NAME}` };

  const { place, courts } = found;
  const title = `Boiska do koszykówki - ${place.name}`;
  const description = `${place.name}: ${courts.length} ${
    courts.length === 1 ? "boisko" : "boisk"
  } do koszykówki ze zdjęciami, nawierzchnią, liczbą koszy i godzinami dostępności.`;

  return {
    title,
    description,
    alternates: { canonical: `/miasto/${slug}` },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: SITE_NAME,
      title,
      description,
      url: `/miasto/${slug}`,
      images: courts.map((c) => c.photos.find((p) => p.url)?.url).filter(Boolean).slice(0, 1) as
        | string[]
        | undefined,
    },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await listCourtsForPlace("city", slug);
  if (!found) notFound();

  const { cities } = await listPlaces();
  const siblings = cities
    .filter((c) => c.slug !== slug && c.voivodeship === found.place.voivodeship)
    .slice(0, 24);

  return (
    <PlaceListing place={found.place} courts={found.courts} kind="city" siblings={siblings} />
  );
}
