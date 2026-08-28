"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CheckinSlot,
  cancelToday,
  declareToday,
  fetchCheckins,
  fetchMyHours,
  fetchOsoby,
  opisGodzin,
} from "@/lib/checkins";
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
 *
 * Godziny wybiera się zakresem: pierwsze kliknięcie to początek, drugie koniec. Nikt nie
 * gra dokładnie jednej godziny, a bez zakresu tłum na boisku rozsypywał się po slotach -
 * trzy osoby grające razem od 18:00 do 21:00 wyglądały jak trzy osobne pojedynki.
 */
export function CheckIn({ courtId, signedIn }: { courtId: string; signedIn: boolean }) {
  const path = usePathname();
  const [slots, setSlots] = useState<CheckinSlot[]>([]);
  const [osoby, setOsoby] = useState(0);
  const [mine, setMine] = useState<number[]>([]);
  const [picking, setPicking] = useState(false);
  /** pierwsza kliknięta godzina - czekamy na drugą, żeby zamknąć zakres */
  const [od, setOd] = useState<number | null>(null);
  /** godzina pod kursorem - z niej rysujemy zakres, zanim ktoś go zatwierdzi */
  const [podKursorem, setPodKursorem] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const reload = () => {
    void fetchCheckins(courtId).then(setSlots);
    void fetchOsoby(courtId).then(setOsoby);
    if (signedIn) void fetchMyHours(courtId).then(setMine);
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
    fetchOsoby(courtId)
      .then((n) => {
        if (alive) setOsoby(n);
      })
      .catch(() => undefined);
    if (signedIn) {
      fetchMyHours(courtId)
        .then((hours) => {
          if (alive) setMine(hours);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [courtId, signedIn]);

  const zapisz = async (start: number, koniec = start) => {
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
      await declareToday(courtId, start, koniec);
      setPicking(false);
      setOd(null);
      setPodKursorem(null);
      reload();
    } catch (e) {
      setHint((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* pierwsze kliknięcie zaznacza początek, drugie zamyka zakres i zapisuje */
  const klik = (h: number) => {
    if (od === null) {
      setOd(h);
      return;
    }
    void zapisz(od, h);
  };

  const odwolaj = async () => {
    setBusy(true);
    try {
      await cancelToday(courtId);
      setMine([]);
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
    /*
      Panel stoi w jednym rzędzie z kafelkami parametrów boiska, więc jest wąski i wysoki.
      Gdy ktoś się dziś zapisał, panel się rozpala: ciepły gradient i płomień przy liczbie.
      Póki nikt nie idzie, zostaje zwykłym szkłem - inaczej ogień nic by nie znaczył.

      Uwaga: żadnego `overflow-hidden`. Lista godzin wysuwa się POD panelem (`top-full`),
      więc przycięcie zawartości do jego kształtu chowało ją w całości i nie dało się
      wybrać godziny. Zaokrąglenie poświaty załatwia `border-radius: inherit` na warstwie
      gradientu, bez ruszania tego, co wychodzi poza panel.
    */
    <section
      className={`glass relative flex h-full min-h-[150px] flex-col rounded-[20px] p-4 ${
        osoby > 0 ? "panel-goracy" : ""
      }`}
      style={osoby > 0 ? { ["--zar" as string]: Math.min(osoby, 6) } : undefined}
    >
      <h2 className="relative flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-faint 2xl:text-[11px]">
        <ClockIcon className="h-4 w-4 text-flame" /> Kto dziś gra
      </h2>

      <p className="relative mt-2 flex items-start gap-2 text-[15px] font-semibold leading-snug 2xl:text-[16px]">
        {osoby > 0 && <PlomykZapisow />}
        <span>
          {osoby === 0
            ? "Nikt się jeszcze nie zapisał"
            : `${osoby} ${plural(osoby, ["osoba idzie", "osoby idą", "osób idzie"])} dziś na to boisko`}
        </span>
      </p>

      {slots.length > 0 ? (
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
          Bądź pierwszy - napisz, od której do której grasz, i daj innym szansę dołączyć.
        </p>
      )}

      {picking && mine.length === 0 && (
        /*
          Siatka godzin jako nakładka nad treścią pod spodem, a nie element w środku panelu:
          wszystkie godziny widać naraz, a rząd z parametrami boiska nie zmienia wysokości
          po otwarciu wyboru (kafelki równają się do panelu, więc rosłyby razem z nim).
        */
        /* tło nieprzezroczyste, nie „glass": nakładka wisi nad galerią, a na jasnym zdjęciu
           półprzejrzysta szyba gubiła kontrast i dolne godziny stawały się nieczytelne */
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[20px] border border-hairline bg-deep p-3 rise"
          style={{ boxShadow: "0 24px 60px -12px rgba(0,0,0,.85)" }}
        >
          <p className="mb-2 text-[11px] leading-snug text-muted">
            {od === null
              ? "Kliknij godzinę, od której grasz."
              : podKursorem !== null && podKursorem !== od
                ? `${String(Math.min(od, podKursorem)).padStart(2, "0")}:00-${String(
                    Math.max(od, podKursorem) + 1
                  ).padStart(2, "0")}:00 - kliknij, żeby zapisać.`
                : `Od ${String(od).padStart(2, "0")}:00 - przesuń kursor i kliknij godzinę końca.`}
          </p>

          {/*
            Zakres podświetlamy tylko do godziny pod kursorem - wcześniej po pierwszym
            kliknięciu zapalały się wszystkie późniejsze, więc nie było widać, co właściwie
            się zapisze. Działa w obie strony: kliknięcie wcześniejszej godziny też domyka
            przedział (kolejność i tak porządkuje `declareToday`).
          */}
          <div className="grid grid-cols-4 gap-1.5" onPointerLeave={() => setPodKursorem(null)}>
            {HOURS.map((h) => {
              const wybrana = od === h;
              const wZakresie =
                od !== null &&
                podKursorem !== null &&
                h !== od &&
                h >= Math.min(od, podKursorem) &&
                h <= Math.max(od, podKursorem);
              return (
                <button
                  key={h}
                  onClick={() => klik(h)}
                  onPointerEnter={() => setPodKursorem(h)}
                  onFocus={() => setPodKursorem(h)}
                  disabled={busy}
                  className={`rounded-xl border py-2 text-[12px] font-semibold tabular-nums transition ${
                    wybrana
                      ? "border-transparent flame-gradient text-black"
                      : wZakresie
                        ? "border-flame/40 bg-flame/12 text-glow hover:border-flame/70"
                        : "border-hairline bg-white/6 hover:border-flame/50 hover:text-glow"
                  }`}
                >
                  {h}:00
                </button>
              );
            })}
          </div>

          {od !== null && (
            <button
              onClick={() => void zapisz(od)}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-hairline bg-white/6 py-2 text-[12px] font-medium text-muted transition hover:text-ink"
            >
              tylko ta jedna godzina
            </button>
          )}
        </div>
      )}

      {hint && <p className="mt-2 text-[12px] leading-snug text-muted">{hint}</p>}

      <div className="mt-auto pt-4">
        {mine.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-glow">Idziesz {opisGodzin(mine)}</p>
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
            onClick={() => {
              if (!signedIn) {
                void zapisz(18, 20);
                return;
              }
              setPicking((v) => !v);
              setOd(null);
              setPodKursorem(null);
            }}
            className="w-full rounded-2xl flame-gradient px-4 py-3 text-[13px] font-bold text-black transition hover:brightness-110"
          >
            {picking ? "wybierz godziny" : "Idę dziś zagrać"}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Płomyk przy liczbie zapisanych.
 *
 * Rysowany, nie wklejony jako gif: gif miałby własne tło i wypaloną rozdzielczość, a tu
 * potrzeba czegoś, co siedzi na szkle, skaluje się z tekstem i migocze płynnie. Dwa
 * języki w przeciwfazie wystarczą, żeby ogień wyglądał na żywy.
 */
function PlomykZapisow() {
  return (
    <span aria-hidden className="plomyk mt-[3px]">
      <span className="plomyk-jezyk" />
      <span className="plomyk-jezyk plomyk-jezyk-maly" />
    </span>
  );
}
