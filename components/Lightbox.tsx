"use client";

import { useCallback, useEffect } from "react";

export interface LightboxItem {
  url?: string;
  caption?: string;
}

/**
 * Powiększenie zdjęcia: cały kadr, nic nie obcięte (object-contain), strzałki i Escape.
 * Używa tego galeria boiska i podgląd zdjęć w kolejce zgłoszeń.
 */
export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const step = useCallback(
    (d: number) => onIndex((index + d + items.length) % items.length),
    [index, items.length, onIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  const current = items[index];
  if (!current) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 backdrop-blur-xl sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[82vh] w-full max-w-6xl flex-1 items-center justify-center"
      >
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.caption ?? ""}
            className="max-h-[82vh] w-auto max-w-full rounded-[20px] object-contain"
          />
        ) : (
          <p className="text-[14px] text-muted">Brak zdjęcia.</p>
        )}

        {items.length > 1 && (
          <>
            <button
              onClick={() => step(-1)}
              aria-label="Poprzednie zdjęcie"
              className="glass absolute left-2 grid h-11 w-11 place-items-center rounded-full text-[18px] text-ink/80 transition hover:text-ink sm:-left-14"
            >
              ‹
            </button>
            <button
              onClick={() => step(1)}
              aria-label="Następne zdjęcie"
              className="glass absolute right-2 grid h-11 w-11 place-items-center rounded-full text-[18px] text-ink/80 transition hover:text-ink sm:-right-14"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-dim flex w-full max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-2.5 text-[13px]"
      >
        <span className="truncate text-muted">{current.caption}</span>
        <span className="shrink-0 tabular-nums text-faint">
          {index + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
        >
          zamknij (esc)
        </button>
      </div>
    </div>
  );
}
