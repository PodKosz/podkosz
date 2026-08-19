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
    <section className="glass mt-12 overflow-hidden rounded-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] uppercase tracking-[0.18em] text-faint">
            <ClockIcon className="h-4 w-4 text-flame" /> Kto dziś gra
          </h2>
          <p className="mt-2 text-[20px] font-semibold leading-snug">
            {razem === 0
              ? "Nikt się jeszcze nie zapisał"
              : `${razem} ${plural(razem, ["osoba idzie", "osoby idą", "osób idzie"])} dziś na to boisko`}
          </p>
          {razem > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((s) => (
                <span
                  key={s.hour}
                  className="rounded-full border border-flame/40 bg-flame/12 px-3 py-1 text-[13px] font-semibold text-glow"
                >
                  {String(s.hour).padStart(2, "0")}:00 · {s.people}
                </span>
              ))}
            </div>
          )}
          {razem === 0 && (
            <p className="mt-1 text-[13px] text-muted">
              Bądź pierwszy - napisz, o której idziesz, i daj innym szansę dołączyć.
            </p>
          )}
        </div>

        <div className="shrink-0">
          {mine !== null ? (
            <div className="text-right">
              <p className="text-[14px] font-semibold text-glow">
                Idziesz o {String(mine).padStart(2, "0")}:00
              </p>
              <button
                onClick={() => void odwolaj()}
                disabled={busy}
                className="mt-1 text-[13px] text-faint transition hover:text-ember"
              >
                odwołaj
              </button>
            </div>
          ) : (
            <button
              onClick={() => (signedIn ? setPicking((v) => !v) : void zapisz(18))}
              className="rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black transition hover:brightness-110"
            >
              {picking ? "wybierz godzinę" : "Idę dziś zagrać"}
            </button>
          )}
        </div>
      </div>

      {picking && mine === null && (
        <div className="border-t border-hairline p-6 pt-5">
          <p className="text-[13px] text-muted">O której będziesz na miejscu?</p>
          <div className="scroll-thin mt-3 flex gap-2 overflow-x-auto pb-1">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => void zapisz(h)}
                disabled={busy}
                className="shrink-0 rounded-full border border-hairline bg-white/6 px-3.5 py-2 text-[13px] font-semibold transition hover:border-flame/50 hover:text-glow"
              >
                {String(h).padStart(2, "0")}:00
              </button>
            ))}
          </div>
        </div>
      )}

      {hint && <p className="border-t border-hairline px-6 py-3 text-[13px] text-muted">{hint}</p>}
    </section>
  );
}
