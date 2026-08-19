"use client";

import { useState } from "react";
import Link from "next/link";
import { Court, TYPE_LABEL } from "@/lib/types";
import { slugifyPlace } from "@/lib/site";
import { CourtPhoto } from "./CourtPhoto";
import { FireBallIcon, BasketApprovedBadge, PinIcon } from "./icons";

type Author = { name: string; courts: number; likes: number };

export function RankingTabs({ courts, authors }: { courts: Court[]; authors: Author[] }) {
  const [tab, setTab] = useState<"boiska" | "gracze">("boiska");

  return (
    <>
      <div className="mb-8 inline-flex gap-1 rounded-full border border-hairline bg-white/5 p-1">
        {(["boiska", "gracze"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.12em] transition ${
              tab === t ? "flame-gradient text-black" : "text-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "boiska" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {courts.slice(0, 3).map((c, i) => (
              <Link
                key={c.id}
                href={`/boisko/${c.slug}`}
                className={`glass group relative overflow-hidden rounded-[24px] transition hover:brightness-110 ${
                  i === 0 ? "sm:-mt-3 flame-ring" : ""
                }`}
              >
                <div className="relative aspect-[16/11] overflow-hidden">
                  <CourtPhoto
                    photo={c.photos[0]}
                    seed={c.seed}
                    sizes="(max-width: 640px) 100vw, 340px"
                  />
                  <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full flame-gradient text-[18px] font-bold text-black">
                    {i + 1}
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate text-[16px] font-semibold">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
                    <PinIcon className="h-3.5 w-3.5" /> {c.city}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[15px] font-bold text-glow">
                    <FireBallIcon className="h-4 w-4" /> {c.likes}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <ol className="space-y-2">
            {courts.slice(3).map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/boisko/${c.slug}`}
                  className="glass flex items-center gap-4 rounded-2xl p-3 transition hover:bg-white/8"
                >
                  <span className="w-8 shrink-0 text-center text-[15px] font-semibold text-faint">
                    {i + 4}
                  </span>
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl">
                    <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="96px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{c.name}</span>
                      {c.basketApproved && <BasketApprovedBadge />}
                    </span>
                    <span className="block truncate text-[13px] text-muted">
                      {c.city} · {TYPE_LABEL[c.type]}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-bold text-glow">
                    <FireBallIcon className="h-4 w-4" /> {c.likes}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <ol className="space-y-2">
          {authors.map((a, i) => (
            <li
              key={a.name}
              className="glass flex items-center gap-4 rounded-2xl px-4 py-3.5"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
                  i < 3 ? "flame-gradient text-black" : "border border-hairline bg-white/5 text-muted"
                }`}
              >
                {i + 1}
              </span>
              <Link href={`/gracz/${slugifyPlace(a.name)}`} className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold transition hover:text-flame">
                  @{a.name}
                </span>
                <span className="block text-[13px] text-muted">
                  {a.courts} {a.courts === 1 ? "boisko" : "boisk"} w bazie
                </span>
              </Link>
              <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-glow">
                <FireBallIcon className="h-4 w-4" /> {a.likes}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
