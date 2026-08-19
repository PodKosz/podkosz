"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckinSlot, cancelToday, declareToday, fetchCheckins, fetchMySlot } from "@/lib/checkins";
import { supabaseEnabled } from "@/lib/supabase/config";
import { signInWithGoogle } from "@/lib/auth";
import { plural } from "@/lib/site";
import { ClockIcon } from "./icons";

/** Godziny, w których realnie się gra - od rana do zamknięcia parków. */
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

/**
 * „Idę dziś zagrać" - deklaracje na dzisiejszy dzień.
 *
 * Odpowiada na pytanie, którego nie rozwiązuje żadna mapa: nie „gdzie jest boisko",
 * ale „gdzie ktoś dziś gra". Deklaracja żyje jeden dzień, więc informacja nigdy nie
 * jest stara. Wymaga konta - inaczej jedna osoba z telefonu zrobiłaby sztuczny tłum.
 */
export function CheckIn({ courtId, signedIn }: { courtId: string; signedIn: boolean }) {
  const path = usePathname();
  const [slots, setSlots] = useState<CheckinSlot[]>([]);
  const [mine, setMine] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const reload = () => {
    void fetchCheckins(courtId).then(setSlots);
    if (signedIn) void fetchMySlot(courtId).then(setMine);
  };

  useEffect(() => {
    let alive = true;
    // setState tylko w callbackach obietnic - synchroniczny setState w efekcie
    // wywołuje kaskadę renderów
    fetchCheckins(courtId)
      .then((list) => {
        if (alive) setSlots(list);
      })
      .catch(() => undefined);
    if (signedIn) {
      fetchMySlot(courtId)
        .then((hour) => {
          if (alive) setMine(hour);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [courtId, signedIn]);

  const razem = slots.reduce((sum, s) => sum + s.people, 0);

  const zapisz = async (hour: number) => {
    if (!signedIn) {
      if (supabaseEnabled) {
        signInWithGoogle(path).catch((e: Error) => setHint(e.message));
      } else {
        setHint("Deklaracje ruszą po podpięciu bazy.");
      }
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      await declareToday(courtId, hour);
      setPicking(false);
      reload();
    } catch (e) {
      setHint((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const odwolaj = async () => {
    setBusy(true);
    try {
      await cancelToday(courtId);
      setMine(null);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    /*
      Panel stoi w jednym rzędzie z kafelkami parametrów boiska, więc jest wąski i wysoki:
      nagłówek, stan na dziś, a przycisk przyklejony do dolnej krawędzi (mt-auto), żeby
      równał się z dołem kafelków niezależnie od długości tekstu.
    */
    <section className="glass flex min-h-[148px] flex-col overflow-hidden rounded-[20px] p-4">
      <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-faint 2xl:text-[11px]">
        <ClockIcon className="h-4 w-4 text-flame" /> Kto dziś gra
      </h2>

      <p className="mt-2 text-[15px] font-semibold leading-snug 2xl:text-[16px]">
        {razem === 0
          ? "Nikt się jeszcze nie zapisał"
          : `${razem} ${plural(razem, ["osoba idzie", "osoby idą", "osób idzie"])} dziś na to boisko`}
      </p>

      {razem > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <span
              key={s.hour}
              className="rounded-full border border-flame/40 bg-flame/12 px-2.5 py-0.5 text-[12px] font-semibold text-glow"
            >
              {String(s.hour).padStart(2, "0")}:00 · {s.people}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[12px] leading-snug text-muted">
          Bądź pierwszy - napisz, o której idziesz, i daj innym szansę dołączyć.
        </p>
      )}

      {picking && mine === null && (
        /* siatka, nie przewijalna lista: wszystkie godziny widać naraz, bez szukania suwakiem */
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {HOURS.map((h) => (
            <button
              key={h}
              onClick={() => void zapisz(h)}
              disabled={busy}
              className="rounded-xl border border-hairline bg-white/6 py-2 text-[12px] font-semibold tabular-nums transition hover:border-flame/50 hover:text-glow"
            >
              {h}:00
            </button>
          ))}
        </div>
      )}

      {hint && <p className="mt-2 text-[12px] leading-snug text-muted">{hint}</p>}

      <div className="mt-auto pt-4">
        {mine !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-glow">
              Idziesz o {String(mine).padStart(2, "0")}:00
            </p>
            <button
              onClick={() => void odwolaj()}
              disabled={busy}
              className="rounded-2xl flame-gradient px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              Odwołaj
            </button>
          </div>
        ) : (
          <button
            onClick={() => (signedIn ? setPicking((v) => !v) : void zapisz(18))}
            className="w-full rounded-2xl flame-gradient px-4 py-3 text-[13px] font-bold text-black transition hover:brightness-110"
          >
            {picking ? "wybierz godzinę" : "Idę dziś zagrać"}
          </button>
        )}
      </div>
    </section>
  );
}
