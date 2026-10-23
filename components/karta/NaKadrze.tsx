"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Arkusz } from "./Arkusz";

/**
 * Plakietka „Coconaut Choice" na zdjęciu tytułowym karty boiska.
 *
 * Notatka Basketa przy wyróżnieniu (dawniej osobna sekcja pod kafelkami) otwiera się
 * z plakietki - na kadrze zostaje znak wyróżnienia, a jego treść jest o jedno dotknięcie.
 */
export function PlakietkaCoconaut({ notatka }: { notatka?: string }) {
  const [otwarta, setOtwarta] = useState(false);
  const zamknij = useCallback(() => setOtwarta(false), []);

  const tresc = (
    <>
      <Image
        src="/partnerzy/coconaut-logo-web.png"
        alt="Coconaut"
        width={330}
        height={64}
        unoptimized
        className="h-[10px] w-auto"
      />
      <span>Choice</span>
    </>
  );

  if (!notatka) {
    return <span className="kb-coconaut">{tresc}</span>;
  }

  return (
    <>
      <button type="button" onClick={() => setOtwarta(true)} className="kb-coconaut" aria-haspopup="dialog">
        {tresc}
      </button>
      {otwarta && (
        <Arkusz tytul="Coconaut Choice" onZamknij={zamknij}>
          <div className="kb-coconaut-notatka mt-3">
            <Image
              src="/partnerzy/coconaut-logo.png"
              alt="Coconaut"
              width={1054}
              height={211}
              className="h-[18px] w-auto"
            />
            <blockquote className="mt-4 text-[20px] font-semibold leading-[1.35] tracking-[-0.012em] text-ink">
              „{notatka}”
            </blockquote>
            <p className="mt-3 text-[13.5px] text-muted">- Basket, twórca PodKosza</p>
          </div>
        </Arkusz>
      )}
    </>
  );
}
