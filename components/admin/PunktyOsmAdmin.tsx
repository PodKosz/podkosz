"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PinIcon } from "../icons";

/**
 * Punkty-widma: szare pinezki zgłoszone jako „tu nie ma boiska".
 *
 * W OpenStreetMap boisko jest, w rzeczywistości zostało zlikwidowane, zabudowane albo
 * zamknięte za bramą szkoły. Bez wygaszania takich punktów mapa zapełniłaby się
 * checkpointami, których nikt nigdy nie zaliczy - a to psuje zabawę mocniej niż brak
 * paru punktów.
 *
 * DECYZJĘ PODEJMUJE CZŁOWIEK, nie licznik. Automat gaszący punkt po trzech zgłoszeniach
 * dałby trzem kontom władzę nad każdym checkpointem w Polsce, a skasowanego punktu nie ma
 * jak odtworzyć: on nie bierze się z naszej bazy, tylko z pobrania OSM sprzed miesięcy.
 *
 * Stoi w zakładce zgłoszeń błędów, bo to ta sama praca: ktoś mówi, że z miejscem coś jest
 * nie tak, a ty jedziesz to sprawdzić albo znasz okolicę.
 */
interface Wiersz {
  osm_id: string;
  lat: number;
  lng: number;
  zgloszen: number;
  ukryty: boolean;
}

export function PunktyOsmAdmin() {
  const [lista, setLista] = useState<Wiersz[]>([]);
  const [stan, setStan] = useState<"wczytuje" | "gotowe" | "brak">("wczytuje");

  const wczytaj = useCallback(async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) return [] as Wiersz[];
    const { data, error } = await supabase.rpc("punkty_osm_zgloszone", { in_limit: 100 });
    /*
      Brak funkcji znaczy „migracja punktów nieodkrytych nie jest jeszcze puszczona".
      Nie jest to awaria panelu - sekcja po prostu się nie pokazuje.
    */
    if (error || !Array.isArray(data)) return null;
    return data as Wiersz[];
  }, []);

  useEffect(() => {
    let zywy = true;
    wczytaj()
      .then((w) => {
        if (!zywy) return;
        if (w === null) {
          setStan("brak");
          return;
        }
        setLista(w);
        setStan("gotowe");
      })
      .catch(() => {
        if (zywy) setStan("brak");
      });
    return () => {
      zywy = false;
    };
  }, [wczytaj]);

  const ustaw = async (osmId: string, ukryty: boolean) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;
    await supabase.rpc("ustaw_punkt_osm", { in_id: osmId, in_ukryty: ukryty });
    setLista((l) => l.map((w) => (w.osm_id === osmId ? { ...w, ukryty } : w)));
  };

  /* nic do roboty - sekcja milczy, zamiast zajmować pół ekranu pustą ramką */
  if (stan !== "gotowe" || !lista.length) return null;

  return (
    <section className="mt-12">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Nieodkryte boiska zgłoszone jako nieistniejące
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        Szare pinezki, przy których ktoś kliknął „tu nie ma boiska”. Wygaszony punkt znika
        z mapy i nikomu się już nie pokazuje; da się go przywrócić.
      </p>

      <div className="mt-5 space-y-2">
        {lista.map((w) => (
          <article
            key={w.osm_id}
            className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] px-5 py-4"
          >
            <span className="flex items-center gap-2 text-[14px] tabular-nums">
              <PinIcon className="h-4 w-4 text-flame/70" />
              {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
            </span>

            <span className="text-[13px] text-muted">
              zgłoszeń: <b className="text-ink">{w.zgloszen}</b>
            </span>

            {w.ukryty && (
              <span className="rounded-full border border-hairline bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-faint">
                wygaszony
              </span>
            )}

            <span className="ml-auto flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/maps/@${w.lat},${w.lng},19z`}
                target="_blank"
                rel="noreferrer"
                className="glass rounded-2xl px-4 py-2.5 text-[13px] font-medium"
              >
                Zobacz z góry
              </a>
              <button
                onClick={() => void ustaw(w.osm_id, !w.ukryty)}
                className={
                  w.ukryty
                    ? "glass rounded-2xl px-4 py-2.5 text-[13px] font-medium"
                    : "rounded-2xl flame-gradient px-4 py-2.5 text-[13px] font-bold text-black"
                }
              >
                {w.ukryty ? "Przywróć punkt" : "Wygaś punkt"}
              </button>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
