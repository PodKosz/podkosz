"use client";

import { useState } from "react";
import { zglosBrakBoiska } from "@/lib/punkty-osm";
import { useBramka } from "./BramkaLogowania";

/**
 * „Tu nie ma boiska" - zgłoszenie punktu-widma.
 *
 * W OpenStreetMap boisko jest, w rzeczywistości zostało zlikwidowane, zabudowane albo
 * zamknięte za bramą szkoły. Bez tego przycisku mapa zapełniłaby się checkpointami, których
 * nikt nigdy nie zaliczy - a to psuje całą zabawę mocniej niż brak paru punktów.
 *
 * Wymaga konta i to nie z ostrożności: bez niego jedna osoba wygasiłaby dowolny punkt tyloma
 * zgłoszeniami, ile ma cierpliwości. Punkt nie znika też sam po iluś zgłoszeniach - decyzję
 * podejmuje człowiek w panelu, bo skasowanego checkpointu nie ma jak odtworzyć.
 */
export function ZglosBrakBoiska({ osmId }: { osmId: string }) {
  const [stan, setStan] = useState<"gotowy" | "wysyla" | "wyslane">("gotowy");
  const [blad, setBlad] = useState<string | null>(null);
  const { wymagaj } = useBramka();

  if (stan === "wyslane") {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        Dzięki - zajrzymy tam. Jeśli boiska faktycznie nie ma, punkt zniknie z mapy.
      </p>
    );
  }

  const wyslij = async () => {
    if (!(await wymagaj("zgłosić, że tu nie ma boiska"))) return;
    setStan("wysyla");
    setBlad(null);
    try {
      await zglosBrakBoiska(osmId);
      setStan("wyslane");
    } catch (e) {
      setBlad((e as Error).message);
      setStan("gotowy");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void wyslij()}
        disabled={stan === "wysyla"}
        className="text-[13px] text-faint underline underline-offset-4 transition hover:text-ink disabled:opacity-60"
      >
        {stan === "wysyla" ? "Wysyłam..." : "Tu nie ma boiska"}
      </button>
      {blad && <p className="mt-2 text-[13px] text-flame">{blad}</p>}
    </div>
  );
}
