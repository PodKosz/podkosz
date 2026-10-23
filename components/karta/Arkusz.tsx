"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IkZamknij } from "./ikony";

/**
 * Arkusz wysuwany od dołu ekranu (jak w iOS) - do opinii i notatki Coconaut Choice.
 *
 * Wyniesiony do `<body>` (jak `NadWszystkim`): treść strony leży w warstwie `z-10`, a pasek
 * nawigacji nad nią, więc arkusz osadzony w treści chowałby górę pod paskiem.
 */
export function Arkusz({
  tytul,
  onZamknij,
  children,
}: {
  tytul: string;
  onZamknij: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZamknij();
    };
    document.addEventListener("keydown", klawisz);
    /* strona pod arkuszem nie przewija się razem z nim */
    const poprzedni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", klawisz);
      document.body.style.overflow = poprzedni;
    };
  }, [onZamknij]);

  return createPortal(
    <div className="kb-arkusz-warstwa">
      <button type="button" aria-label="Zamknij" onClick={onZamknij} className="kb-arkusz-tlo" />
      <div role="dialog" aria-modal="true" aria-label={tytul} className="kb-arkusz">
        <span aria-hidden className="kb-arkusz-uchwyt" />
        <div className="flex items-center justify-between gap-3 pb-1">
          <h3 className="text-[16px] font-semibold">{tytul}</h3>
          <button type="button" onClick={onZamknij} aria-label="Zamknij" className="kb-kolko">
            <IkZamknij className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Element dopiero po hydracji - do warstw wyniesionych do `<body>`, które stoją od początku. */
export function usePoHydracji(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
