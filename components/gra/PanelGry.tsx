"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";
import { slugifyPlace } from "@/lib/site";
import type { IdMiejsca, MiejsceGry } from "@/lib/minigra";
import { RzutDoKosza } from "./RzutDoKosza";

/**
 * Plansza gry razem z tablicą wyników.
 *
 * Ranking przychodzi z serwera gotowy, żeby był widoczny od razu, a po każdej zakończonej
 * serii odświeża się w tle - inaczej gracz musiałby przeładować stronę, żeby zobaczyć
 * własny wynik. Rekord zalogowanego czytamy osobno, bo tabela wyników jest zamknięta
 * i własny wiersz każdy widzi tylko sam.
 */
export interface WpisRankingu {
  nick: string;
  avatar: string | null;
  seria: number;
}

export function PanelGry({
  miejsce,
  ranking,
}: {
  miejsce: MiejsceGry;
  ranking: WpisRankingu[];
}) {
  const [lista, setLista] = useState(ranking);
  const [rekord, setRekord] = useState(0);
  const sesja = useSesja();
  const mojNick = sesja?.user?.name ?? null;

  /*
    Własny rekord czytamy raz, przy wejściu - i tylko dla zalogowanego. Tabela wyników jest
    zamknięta politykami, więc pytanie o nią bez sesji kończy się odmową i błędem w konsoli;
    nie ma po co go wywoływać.
  */
  useEffect(() => {
    if (!sesja?.user) return;
    let aktualne = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase
        .from("minigra_wyniki")
        .select("seria")
        .eq("miejsce", miejsce.id)
        .maybeSingle();
      if (aktualne && data?.seria) setRekord(data.seria);
    })();

    return () => {
      aktualne = false;
    };
  }, [miejsce.id, sesja?.user]);

  const odswiez = useCallback(
    async (wynik: number) => {
      setRekord((r) => Math.max(r, wynik));

      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase.rpc("minigra_ranking", {
        p_miejsce: miejsce.id,
        p_ile: 20,
      });
      if (Array.isArray(data)) setLista(data as WpisRankingu[]);
    },
    [miejsce.id]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <RzutDoKosza miejsce={miejsce.id as IdMiejsca} rekord={rekord} onWynik={(w) => void odswiez(w)} />

      <aside className="szklo-pro rounded-[28px] p-6">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">
          Najdłuższe serie
        </h2>
        <p className="mt-1 text-[12px] text-faint">{miejsce.nazwa}</p>

        {lista.length === 0 ? (
          <p className="mt-5 text-[13px] text-muted">
            Nikt tu jeszcze nie trafił. Pierwszy wynik jest do wzięcia.
          </p>
        ) : (
          <ol className="mt-5 space-y-1.5">
            {lista.map((w, i) => {
              const ja = mojNick !== null && w.nick === mojNick;
              return (
                <li
                  key={`${w.nick}-${i}`}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
                    ja ? "bg-white/[0.07]" : ""
                  }`}
                >
                  <span
                    className={`w-5 text-right text-[13px] tabular-nums ${
                      i < 3 ? "flame-text font-bold" : "text-faint"
                    }`}
                  >
                    {i + 1}
                  </span>

                  {w.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.avatar}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] text-muted">
                      {w.nick.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <Link
                    href={`/gracz/${slugifyPlace(w.nick)}`}
                    className="min-w-0 flex-1 truncate text-[13px] text-ink transition hover:text-flame"
                  >
                    {w.nick}
                  </Link>

                  <span className="text-[15px] font-semibold tabular-nums text-ink">
                    {w.seria}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-6 text-[12px] leading-relaxed text-faint">
          Liczy się najdłuższa seria trafień pod rząd. Jedno pudło i seria się kończy -
          rekord zostaje.
        </p>
      </aside>
    </div>
  );
}
