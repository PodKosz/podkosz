import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { listCourtsForPlace, listPlaces } from "@/lib/repo";
import { PlaceListing } from "@/components/PlaceListing";
import { SITE_NAME, linkNaMape, slugifyPlace } from "@/lib/site";
import { VOIVODESHIPS } from "@/lib/types";

export const revalidate = 3600;

/*
  Wypisujemy wszystkie województwa z góry, żeby ich podstrony powstały przy budowaniu i leciały
  z cache. Bez tego Next renderował je przy każdym wejściu - a to są strony pod wyszukiwarki,
  czyli dokładnie te, które muszą odpowiadać natychmiast.
*/
export function generateStaticParams() {
  return VOIVODESHIPS.map((name) => ({ slug: slugifyPlace(name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await listCourtsForPlace("voivodeship", slug);
  if (!found) return { title: `Boiska do koszykówki - ${SITE_NAME}` };

  const { place, courts } = found;
  const title = `Boiska do koszykówki - województwo ${place.name}`;
  const description = `Województwo ${place.name}: ${courts.length} ${
    courts.length === 1 ? "boisko" : "boisk"
  } do koszykówki na mapie, ze zdjęciami i pełnym opisem nawierzchni oraz koszy.`;

  return {
    title,
    description,
    alternates: { canonical: `/wojewodztwo/${slug}` },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: SITE_NAME,
      title,
      description,
      url: `/wojewodztwo/${slug}`,
    },
  };
}

export default async function VoivodeshipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await listCourtsForPlace("voivodeship", slug);

  /*
    Województwo bez ani jednego boiska nie ma czego wypisać, ale nie jest błędem - adres
    jest w mapie strony i ktoś może w niego wejść wprost, więc pusty region nie może kończyć
    się czterysta czwórką. Odsyłamy na mapę z tym jednym województwem: kamera dolatuje do
    regionu, obrys się zapala, a pusta lista mówi wprost, że nikt jeszcze nic tu nie dodał.

    Bez `m=` w adresie, celowo. Gotowa pozycja kamery ustawiłaby kadr skokiem, a wtedy
    dolotu nie ma - jest podmiana widoku. Mapa startuje więc na Polsce i sama dojeżdża.
  */
  if (!found) {
    const nazwa = VOIVODESHIPS.find((v) => slugifyPlace(v) === slug);
    if (!nazwa) notFound();
    redirect(linkNaMape(nazwa));
  }

  const { voivodeships } = await listPlaces();
  const siblings = voivodeships.filter((v) => v.slug !== slug);

  return (
    <PlaceListing
      place={found.place}
      courts={found.courts}
      kind="voivodeship"
      siblings={siblings}
    />
  );
}
