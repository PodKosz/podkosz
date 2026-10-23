"use client";

import { useRef, type ReactNode } from "react";
import type { CourtPhotoRef } from "@/lib/types";
import { CourtPhoto } from "../CourtPhoto";
import { useGaleria } from "./KartaKontekst";
import { IkStrzalka } from "./ikony";

/**
 * Zdjęcia boiska jako pas przewijany w bok (prototyp 01): pionowe kadry z podpisem pod
 * spodem, dotknięcie otwiera podgląd na pełnym ekranie. Film z boiska stoi na końcu pasa.
 * Na komputerze dochodzą strzałki - myszką pas w bok się nie przewija.
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
  const pas = useRef<HTMLDivElement>(null);
  const przewin = (kierunek: 1 | -1) =>
    pas.current?.scrollBy({ left: kierunek * pas.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="kb-sekcja" aria-labelledby="zdjecia-tytul">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="zdjecia-tytul" className="kb-tytul">
          Zdjęcia <span className="text-faint">{zdjecia.length}</span>
        </h2>
        <div className="kb-strzalki">
          <button type="button" onClick={() => przewin(-1)} aria-label="Poprzednie zdjęcia" className="kb-kolko">
            <IkStrzalka className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={() => przewin(1)} aria-label="Następne zdjęcia" className="kb-kolko">
            <IkStrzalka className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={pas} className="kb-pas mt-3">
        {zdjecia.map((z, i) => (
          <figure key={`${z.kind}-${i}`} className="kb-pas-kadr">
            <button
              type="button"
              onClick={() => otworz(i)}
              aria-label={`Powiększ: ${z.caption}`}
              className="kb-pas-zdjecie relative block aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-[var(--k-karta)]"
            >
              <CourtPhoto photo={z} seed={seed + i * 3} sizes="(min-width: 1024px) 240px, 210px" />
            </button>
            <figcaption className="mt-2 truncate px-0.5 text-[12.5px] text-muted">{z.caption}</figcaption>
          </figure>
        ))}
        {film && (
          <figure className="kb-pas-kadr kb-pas-kadr-film">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-[var(--k-karta)]">{film}</div>
            <figcaption className="mt-2 px-0.5 text-[12.5px] text-muted">Film z boiska</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
