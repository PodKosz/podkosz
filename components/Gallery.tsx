"use client";

import { useState } from "react";
import { Court } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { Lightbox } from "./Lightbox";

export function Gallery({ court }: { court: Court }) {
  const [open, setOpen] = useState<number | null>(null);

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
        <Lightbox
          items={court.photos.map((p) => ({ url: p.url, caption: p.caption }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
