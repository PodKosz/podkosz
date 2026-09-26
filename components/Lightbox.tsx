"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
 *
 * Strzałki stoją POD zdjęciem, symetrycznie po obu stronach licznika - na każdym ekranie
 * w tym samym miejscu. Wcześniej wisiały po bokach i zabierały zdjęciu szerokość na stałe,
 * więc poziomy kadr był dużo mniejszy, niż pozwalał ekran. Podpisu kadru („Całe boisko
 * z narożnika") już nie ma - nazwę ujęcia widać po samym zdjęciu.
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
  if (!current || typeof document === "undefined") return null;

  /*
    PORTAL DO <body>. Podgląd otwiera się z wnętrza strony, a cała treść strony leży w warstwie
    `relative z-10` z układu - pod paskiem nawigacji, który ma `z-40`. Własne `z-50` niczego
    tu nie zmieniało: liczy się tylko wewnątrz tamtej warstwy. Wyniesiony do <body> podgląd
    stoi nad wszystkim.

    Kliknięcie w czerń wokół zdjęcia zamyka podgląd; zdjęcie i strzałki zatrzymują kliknięcie.
  */
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-3 backdrop-blur-xl sm:gap-5 sm:p-6"
    >
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="flex min-h-0 w-full touch-pan-y items-center justify-center"
      >
        {current.url ? (
          /*
            Zdjęcie w opakowaniu dopasowanym do NIEGO, a nie do całego pola - dzięki temu
            „X" stoi w rogu samego kadru. W rogu pola lądowałby przy pionowym zdjęciu daleko
            obok, w pustej czerni.
          */
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full"
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
              /*
                Wysokość = ekran minus marginesy i rząd strzałek; szerokość = cała dostępna.
                Na telefonie trochę niżej niż pełny ekran - pionowy kadr zostawia wtedy
                margines, a „X" w jego rogu jest zawsze w zasięgu kciuka.
              */
              className={`block w-auto max-w-full select-none rounded-[20px] object-contain ${
                wielo
                  ? "max-h-[min(74dvh,calc(100dvh-8rem))] sm:max-h-[calc(100dvh-8.5rem)]"
                  : "max-h-[min(80dvh,calc(100dvh-3rem))] sm:max-h-[calc(100dvh-3rem)]"
              }`}
            />
            {/*
              Przyciemnione kółko, nie szkło: jasne szkło z białym „X" znikało na niebie
              i na białych ścianach, a to jedyny widoczny sposób wyjścia poza Escape.
            */}
            <button
              onClick={onClose}
              aria-label="Zamknij zdjęcie"
              className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-[#fff] ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/70 active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-muted">Brak zdjęcia.</p>
        )}
      </div>

      {wielo && (
        <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-5">
          <StrzalkaPodgladu kierunek={-1} onClick={() => step(-1)} />
          <span className="min-w-[3.5rem] text-center text-[13px] font-semibold tabular-nums text-ink/70">
            {index + 1} / {items.length}
          </span>
          <StrzalkaPodgladu kierunek={1} onClick={() => step(1)} />
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * Strzałka podglądu: biały szewron w kółku z gradientem marki. Po najechaniu lekko rośnie
 * i jaśnieje, a poświata pod nią się rozlewa; po wciśnięciu przysiada. Szewron jest
 * narysowany, nie wpisany znakiem „‹" - znak z kroju pisma siedzi krzywo względem środka
 * kółka i ma grubość zależną od fontu.
 */
function StrzalkaPodgladu({ kierunek, onClick }: { kierunek: 1 | -1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={kierunek < 0 ? "Poprzednie zdjęcie" : "Następne zdjęcie"}
      className="strzalka-podgladu flame-gradient grid h-12 w-12 place-items-center rounded-full"
    >
      {/* biel na sztywno: `text-white` w jasnych motywach jest ciemne, a tu leży na kolorze */}
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={kierunek < 0 ? "M14.5 5.5L8 12l6.5 6.5" : "M9.5 5.5L16 12l-6.5 6.5"} />
      </svg>
    </button>
  );
}
