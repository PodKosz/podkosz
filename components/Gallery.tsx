"use client";

import { useEffect, useState } from "react";
import { Court } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";

export function Gallery({ court }: { court: Court }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => ((i ?? 0) + 1) % court.photos.length);
      if (e.key === "ArrowLeft")
        setOpen((i) => ((i ?? 0) - 1 + court.photos.length) % court.photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, court.photos.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {court.photos.map((p, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline transition hover:border-flame/50"
          >
            <CourtPhoto photo={p} seed={court.seed + i * 3} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-left text-[11px] uppercase tracking-wider text-ink/85">
              {p.caption}
            </span>
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 backdrop-blur-xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-hairline"
          >
            <div className="aspect-[16/10]">
              <CourtPhoto photo={court.photos[open]} seed={court.seed + open * 3} />
            </div>
            <div className="glass-dim absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-3 text-[13px]">
              <span className="text-muted">{court.photos[open].caption}</span>
              <span className="text-faint">
                {open + 1} / {court.photos.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => setOpen(null)}
            className="glass rounded-full px-5 py-2 text-[12px] uppercase tracking-[0.14em] text-muted hover:text-ink"
          >
            zamknij (esc)
          </button>
        </div>
      )}
    </>
  );
}
