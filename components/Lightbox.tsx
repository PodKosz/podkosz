"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LightboxItem {
  url?: string;
  caption?: string;
}

/**
 * Ile pikseli trzeba przeciągnąć palcem, żeby zmienić zdjęcie. Mniej - i zwykłe drgnięcie
 * przy dotknięciu przerzucałoby kadr; więcej - i trzeba by przeciągać przez pół ekranu.
 */
const PROG_PRZESUNIECIA = 56;

/**
 * Powiększenie zdjęcia: cały kadr, nic nie obcięte (object-contain), strzałki, Escape
 * i - na telefonie - przesuwanie palcem. Używa tego galeria boiska i podgląd zdjęć
 * w kolejce zgłoszeń.
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

  /*
    Przesuwanie palcem. Zdjęcie jedzie za palcem na bieżąco - bez tego gest nie dawałby
    żadnej odpowiedzi aż do puszczenia i nie byłoby wiadomo, czy w ogóle działa. Po puszczeniu
    za progiem przechodzi do sąsiedniego kadru, przed progiem wraca na miejsce.

    Kierunek rozstrzygamy przy pierwszym wyraźnym ruchu: jeśli palec idzie bardziej w pionie
    niż w poziomie, to nie jest przewijanie zdjęć i nic nie przesuwamy.
  */
  const start = useRef<{ x: number; y: number; poziomo: boolean | null } | null>(null);
  const [przesuniecie, setPrzesuniecie] = useState(0);
  const wielo = items.length > 1;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!wielo || e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, poziomo: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (s.poziomo === null && Math.hypot(dx, dy) > 8) s.poziomo = Math.abs(dx) > Math.abs(dy);
    if (s.poziomo) setPrzesuniecie(dx);
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (s?.poziomo && Math.abs(przesuniecie) > PROG_PRZESUNIECIA) step(przesuniecie < 0 ? 1 : -1);
    setPrzesuniecie(0);
  };

  const current = items[index];
  if (!current) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 backdrop-blur-xl sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="relative flex max-h-[82vh] w-full max-w-6xl flex-1 touch-pan-y items-center justify-center"
      >
        {current.url ? (
          /*
            Zdjęcie w opakowaniu dopasowanym do NIEGO, a nie do całego pola - dzięki temu
            „X" stoi w rogu samego kadru. W rogu pola lądowałby przy pionowym zdjęciu daleko
            obok, w pustej czerni.
          */
          <div
            className="relative max-h-full max-w-full"
            style={{
              transform: przesuniecie ? `translateX(${przesuniecie}px)` : undefined,
              transition: przesuniecie ? "none" : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.url}
              src={current.url}
              alt={current.caption ?? ""}
              draggable={false}
              className="block max-h-[82vh] w-auto max-w-full select-none rounded-[20px] object-contain"
            />
            <button
              onClick={onClose}
              aria-label="Zamknij zdjęcie"
              className="glass absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-ink/85 transition hover:text-ink active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-muted">Brak zdjęcia.</p>
        )}

        {wielo && (
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
        {/* na telefonie zamyka „X" na zdjęciu - tu zostaje tylko podpowiedź klawisza */}
        <button
          onClick={onClose}
          className="hidden shrink-0 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink sm:inline"
        >
          zamknij (esc)
        </button>
      </div>
    </div>
  );
}
