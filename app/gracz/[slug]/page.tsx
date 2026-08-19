import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor } from "@/lib/repo";
import { CourtCard } from "@/components/CourtCard";
import { badgesFor, nextBadge } from "@/lib/odznaki";
import { SITE_NAME, plural } from "@/lib/site";
import { ArrowLeftIcon, FireBallIcon } from "@/components/icons";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) return { title: `Odkrywca - ${SITE_NAME}` };

  const title = `@${author.name} - boiska dodane do PodKosza`;
  const description = `${author.name} dodał ${author.courts.length} ${
    author.courts.length === 1 ? "boisko" : "boisk"
  } do bazy PodKosza. Zobacz, co znalazł.`;

  return {
    title,
    description,
    alternates: { canonical: `/gracz/${slug}` },
    openGraph: { type: "profile", locale: "pl_PL", siteName: SITE_NAME, title, description },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) notFound();

  const badges = badgesFor(author.courts.length, author.likes);
  const next = nextBadge(author.courts.length);
  const cities = [...new Set(author.courts.map((c) => c.city))];

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <Link
        href="/ranking"
        className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> ranking odkrywców
      </Link>

      <header className="mt-6">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Odkrywca</p>
        <h1 className="mt-2 text-[clamp(30px,5vw,52px)] font-semibold tracking-[-0.02em]">
          @{author.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[15px] text-muted">
          <span>
            <b className="text-ink">{author.courts.length}</b>{" "}
            {plural(author.courts.length, ["boisko", "boiska", "boisk"])} w bazie
          </span>
          <span className="flex items-center gap-1.5 text-glow">
            <FireBallIcon className="h-4 w-4" />
            <b>{author.likes}</b>{" "}
            {plural(author.likes, ["płonąca piłka", "płonące piłki", "płonących piłek"])}
          </span>
          <span>
            {cities.length}{" "}
            {plural(cities.length, ["miejscowość", "miejscowości", "miejscowości"])}
          </span>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Odznaki</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b.name}
              title={b.desc}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${
                b.earned
                  ? "border-transparent flame-gradient text-black"
                  : "border-hairline bg-white/4 text-faint"
              }`}
            >
              {b.name}
            </span>
          ))}
        </div>
        {next && (
          <p className="mt-3 text-[13px] text-muted">
            Do odznaki „{next.name}&rdquo; brakuje {next.brakuje}{" "}
            {plural(next.brakuje, ["boiska", "boisk", "boisk"])}.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Dodane boiska</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {author.courts.map((court) => (
            <CourtCard key={court.id} court={court} />
          ))}
        </div>
      </section>
    </main>
  );
}
