"use client";

import { useRef, useState, type ReactNode } from "react";
import type { CourtPhotoRef } from "@/lib/types";
import { CourtPhoto } from "../CourtPhoto";
import { useGaleria } from "./KartaKontekst";
import { IkStrzalka } from "./ikony";

/** Po przeciągnięciu o tyle pikseli górna karta odlatuje i pod spodem jest następna. */
const PROG = 80;

/**
 * Zdjęcia boiska jako talia (prototyp 04 z `podkosz-karty/zdjecia`): na wierzchu jedno
 * zdjęcie, pod nim dwa kolejne lekko przekrzywione. Górne odrzuca się palcem w bok,
 * strzałki pod spodem robią to samo, a dotknięcie otwiera podgląd na pełnym ekranie.
 * Na komputerze talia stoi na środku strony.
 *
 * Przeciąganie ustawia styl karty wprost, bez stanu Reacta - przy każdym ruchu palca
 * przerysowywanie całej talii dawałoby szarpanie.
 */
export function PasekZdjec({
  zdjecia,
  seed,
  film,
}: {
  zdjecia: CourtPhotoRef[];
  seed: number;
  film?: ReactNode;
}) {
  const otworz = useGaleria();
  const [gora, setGora] = useState(0);
  const karty = useRef<(HTMLDivElement | null)[]>([]);
  const ruch = useRef<{ x0: number; dx: number } | null>(null);
  const ile = zdjecia.length;

  const dalej = (kier: number) => setGora((g) => (g + kier + ile) % ile);

  const naDol = (e: React.PointerEvent<HTMLDivElement>) => {
    ruch.current = { x0: e.clientX, dx: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const naRuch = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = ruch.current;
    const k = karty.current[gora];
    if (!r || !k) return;
    r.dx = e.clientX - r.x0;
    k.style.transition = "none";
    k.style.transform = `translateX(${r.dx}px) rotate(${r.dx / 18}deg)`;
  };
  const naGore = () => {
    const r = ruch.current;
    const k = karty.current[gora];
    ruch.current = null;
    if (!r || !k) return;
    k.style.transition = "";
    if (Math.abs(r.dx) > PROG) {
      k.style.transform = `translateX(${r.dx > 0 ? 420 : -420}px) rotate(${r.dx > 0 ? 24 : -24}deg)`;
      k.style.opacity = "0";
      window.setTimeout(() => {
        k.style.transform = "";
        k.style.opacity = "";
        dalej(1);
      }, 260);
    } else {
      k.style.transform = "";
      /* krótkie dotknięcie bez przesunięcia - podgląd na pełnym ekranie */
      if (Math.abs(r.dx) < 6) otworz(gora);
    }
  };

  return (
    <section className="kb-sekcja" aria-labelledby="zdjecia-tytul">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="zdjecia-tytul" className="kb-tytul">
          Zdjęcia <span className="text-faint">{ile}</span>
        </h2>
        <button type="button" onClick={() => otworz(gora)} className="kb-link">
          Pełny ekran
          <IkStrzalka className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="kb-stos-uklad">
        <div
          className="kb-stos"
          onPointerDown={naDol}
          onPointerMove={naRuch}
          onPointerUp={naGore}
          onPointerCancel={naGore}
          role="group"
          aria-roledescription="talia zdjęć"
          aria-label={`Zdjęcie ${gora + 1} z ${ile}: ${zdjecia[gora]?.caption ?? ""}`}
        >
          {zdjecia.map((z, i) => {
            const poz = (i - gora + ile) % ile;
            return (
              <div
                key={`${z.kind}-${i}`}
                ref={(el) => {
                  karty.current[i] = el;
                }}
                className="kb-stos-karta"
                data-poz={poz <= 2 ? poz : "x"}
                aria-hidden={poz !== 0}
              >
                <CourtPhoto photo={z} seed={seed + i * 3} sizes="(min-width: 768px) 340px, 300px" />
                <span className="kb-stos-podpis">{z.caption}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[13px] text-muted">
          <button type="button" onClick={() => dalej(-1)} aria-label="Poprzednie zdjęcie" className="kb-kolko kb-kolko-hover">
            <IkStrzalka className="h-4 w-4 rotate-180" />
          </button>
          <span className="tabular-nums">
            {gora + 1} / {ile}
          </span>
          <button type="button" onClick={() => dalej(1)} aria-label="Następne zdjęcie" className="kb-kolko kb-kolko-hover">
            <IkStrzalka className="h-4 w-4" />
          </button>
        </div>

        {film && (
          <figure className="kb-stos-film">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-[var(--k-karta)]">{film}</div>
            <figcaption className="mt-2 text-center text-[12.5px] text-muted">Film z boiska</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
