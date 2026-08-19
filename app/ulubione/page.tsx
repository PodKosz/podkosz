import type { Metadata } from "next";
import Link from "next/link";
import { listFavoriteCourts } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { CourtPhoto } from "@/components/CourtPhoto";
import { FireBallIcon, PinIcon } from "@/components/icons";
import { TYPE_LABEL } from "@/lib/types";

export const metadata: Metadata = {
  title: "Ulubione boiska - PodKosz",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

export default async function FavoritesPage() {
  const user = await getSessionUser();
  const courts = user ? await listFavoriteCourts(user.id) : [];

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Twoja lista</p>
      <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
        Ulubione boiska
      </h1>

      {!user && (
        <p className="glass mt-8 rounded-[24px] p-8 text-center text-[15px] text-muted">
          Zaloguj się, żeby zapisywać boiska na własną listę.
        </p>
      )}

      {user && !courts.length && (
        <div className="glass mt-8 rounded-[24px] p-10 text-center">
          <p className="text-[15px] text-muted">
            Nic tu jeszcze nie ma. Otwórz kartę dowolnego boiska i kliknij „Do ulubionych”.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black"
          >
            Przeglądaj mapę
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((c) => (
          <Link
            key={c.id}
            href={`/boisko/${c.slug}`}
            className="glass overflow-hidden rounded-[22px] transition hover:brightness-110"
          >
            <div className="aspect-[16/10] overflow-hidden">
              <CourtPhoto photo={c.photos[0]} seed={c.seed} />
            </div>
            <div className="flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                <span className="flex items-center gap-1 text-[13px] text-muted">
                  <PinIcon className="h-3.5 w-3.5" /> {c.city} · {TYPE_LABEL[c.type]}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[14px] font-semibold text-glow">
                <FireBallIcon className="h-4 w-4" /> {c.likes}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
