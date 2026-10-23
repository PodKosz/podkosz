"use client";

import type { ReactNode } from "react";
import type { CourtPhotoRef } from "@/lib/types";
import { CourtPhoto } from "../CourtPhoto";
import { useGaleria } from "./KartaKontekst";

/**
 * Zdjęcia boiska jako pas przewijany w bok (prototyp 01): pionowe kadry z podpisem pod
 * spodem, dotknięcie otwiera podgląd na pełnym ekranie. Film z boiska stoi na końcu pasa.
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

  return (
    <section className="kb-sekcja" aria-labelledby="zdjecia-tytul">
      <h2 id="zdjecia-tytul" className="kb-tytul px-1">
        Zdjęcia <span className="text-faint">{zdjecia.length}</span>
      </h2>
      <div className="kb-pas mt-3">
        {zdjecia.map((z, i) => (
          <figure key={`${z.kind}-${i}`} className="kb-pas-kadr">
            <button
              type="button"
              onClick={() => otworz(i)}
              aria-label={`Powiększ: ${z.caption}`}
              className="relative block aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-[var(--k-karta)]"
            >
              <CourtPhoto photo={z} seed={seed + i * 3} sizes="220px" />
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
