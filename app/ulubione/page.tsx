import type { Metadata } from "next";
import Link from "next/link";
import { listFavoriteCourts } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { CourtCard } from "@/components/CourtCard";

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
          <CourtCard key={c.id} court={c} />
        ))}
      </div>
    </main>
  );
}
