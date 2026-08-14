"use client";

import { useMemo } from "react";
import Link from "next/link";
import { toApprovedCourts, useHydrated, useSubmissions } from "@/lib/submissions";
import { CourtDetail } from "./CourtDetail";

/** Karta boiska zaakceptowanego lokalnie w panelu admina (dane w localStorage). */
export function LocalCourtDetail({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const submissions = useSubmissions();
  const court = useMemo(
    () => toApprovedCourts(submissions).find((c) => c.slug === slug),
    [submissions, slug]
  );

  if (!hydrated) return <div className="min-h-dvh" />;
  if (court) return <CourtDetail court={court} />;

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Nie ma takiego boiska</h1>
        <p className="mt-3 text-[15px] text-muted">
          Wpis mógł zostać usunięty albo adres jest błędny.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black"
        >
          Wróć na mapę
        </Link>
      </div>
    </main>
  );
}
