"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckinSlot,
  PanelDeklaracji,
  dzisiaj,
  fetchBlokada,
  fetchCheckins,
  fetchMyHours,
  fetchZajete,
  fetchOsoby,
  fetchPanel,
  odwolajDeklaracje,
  opisDnia,
  opisGodzin,
  zapiszDeklaracje,
} from "@/lib/checkins";
import { supabaseEnabled } from "@/lib/supabase/config";
import { useBramka } from "./BramkaLogowania";
import { plural } from "@/lib/site";
import { ClockIcon } from "./icons";

/** Godziny, w których realnie się gra - od rana do zamknięcia parków. */
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const PUSTY: Omit<PanelDeklaracji, "dzien" | "dzis"> = {
  slots: [],
  osoby: 0,
  moje: [],
  zajete: [],
  blokada: null,
  tydzien: null,
  mojeDni: [],
};

/**
 * „Kto gra" - deklaracje na dziś i sześć kolejnych dni.
 *
 * Odpowiada na pytanie, którego nie rozwiązuje żadna mapa: nie „gdzie jest boisko",
 * ale „gdzie ktoś zagra". Najpierw dzień z paska, potem godziny. Dawniej był tylko
 * dzisiejszy dzień, a o sobotnim meczu umawia się w środę - więc na sobotę dało się
 * zapisać dopiero w sobotę rano. Wymaga konta - inaczej jedna osoba z telefonu zrobiłaby
 * sztuczny tłum.
 *
 * Godziny wybiera się zakresem: pierwsze kliknięcie to początek, drugie koniec. Nikt nie
 * gra dokładnie jednej godziny, a bez zakresu tłum na boisku rozsypywał się po slotach -
 * trzy osoby grające razem od 18:00 do 21:00 wyglądały jak trzy osobne pojedynki.
 */
export function CheckIn({ courtId, signedIn }: { courtId: string; signedIn: boolean }) {
  /** wybrany dzień; zaczynamy od dziś według przeglądarki, panel poprawi to na dziś według bazy */
  const [dzien, setDzien] = useState(dzisiaj);
  const [panel, setPanel] = useState<PanelDeklaracji>(() => ({ ...PUSTY, dzien: dzisiaj(), dzis: dzisiaj() }));
  const [picking, setPicking] = useState(false);
  /** pierwsza kliknięta godzina - czekamy na drugą, żeby zamknąć zakres */
  const [od, setOd] = useState<number | null>(null);
  /** godzina pod kursorem - z niej rysujemy zakres, zanim ktoś go zatwierdzi */
  const [podKursorem, setPodKursorem] = useState<number | null>(null);
  /** bieżąca godzina, łapana przy otwarciu wyboru - dzisiejsze godziny sprzed niej gasną */
  const [teraz, setTeraz] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const { wymagaj } = useBramka();

  const { slots, osoby, moje: mine, zajete, blokada, tydzien, mojeDni, dzis } = panel;
  const opis = opisDnia(dzien, dzis);

  /*
    JEDNO ZAPYTANIE NA CAŁY PANEL - godziny, liczba osób, moje godziny, zajęte gdzie
    indziej, powód blokady i podgląd tygodnia (`fetchPanel`).

    Cztery stare wywołania zostają jako ścieżka zapasowa, gdyby panel w ogóle nie
    odpowiedział - dotyczą tylko dzisiejszego dnia, więc pasek dni wtedy się nie pokazuje.

    `pobierz` NICZEGO nie ustawia w stanie - oddaje dane, a przypisanie robi wołający.
    setState wywołany (choćby pośrednio) w ciele efektu wywołuje kaskadę renderów i linter
    tego pilnuje. Tak setState siedzi w `.then`, gdzie jego miejsce.
  */
  const pobierz = useCallback(async (): Promise<PanelDeklaracji> => {
    const p = await fetchPanel(courtId, dzien).catch(() => null);
    if (p) return p;

    const dzis = dzisiaj();
    const [slots, ilu] = await Promise.all([
      fetchCheckins(courtId).catch(() => [] as CheckinSlot[]),
      fetchOsoby(courtId).catch(() => 0),
    ]);
    if (!signedIn) return { ...PUSTY, dzien: dzis, dzis, slots, osoby: ilu };

    const [moje, zajete, powod] = await Promise.all([
      fetchMyHours(courtId).catch(() => [] as number[]),
      fetchZajete(courtId).catch(() => [] as number[]),
      fetchBlokada(courtId).catch(() => null),
    ]);
    return { ...PUSTY, dzien: dzis, dzis, slots, osoby: ilu, moje, zajete, blokada: powod };
  }, [courtId, dzien, signedIn]);

  const przypisz = useCallback((p: PanelDeklaracji) => {
    setPanel(p);
    /* baza bez tygodnia albo inny „dziś" niż w przeglądarce - trzymamy się dnia z odpowiedzi */
    if (p.dzien !== dzien) setDzien(p.dzien);
  }, [dzien]);

  const reload = () => {
    void pobierz().then(przypisz).catch(() => undefined);
  };

  useEffect(() => {
    let alive = true;
    pobierz()
      .then((p) => {
        if (alive) przypisz(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pobierz, przypisz]);

  /* zmiana dnia zaczyna wybór godzin od nowa - zakres z soboty nie ma sensu w niedzielę */
  const wybierzDzien = (d: string) => {
    if (d === dzien) return;
    setDzien(d);
    setOd(null);
    setPodKursorem(null);
    setHint(null);
  };

  const zapisz = async (start: number, koniec = start) => {
    if (!(await wymagaj(`zadeklarować, że zagrasz tu ${opis.kiedy}`))) return;
    if (!supabaseEnabled) {
      setHint("Deklaracje ruszą po podpięciu bazy.");
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      await zapiszDeklaracje(courtId, dzien, start, koniec, zajete);
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

  /*
    Zakres nie może PRZESKOCZYĆ godziny zajętej gdzie indziej. Sprawdzamy cały przedział,
    a nie tylko jego końce: wybór 14-20 przy zajętym 16 wyglądałby na dozwolony, bo ani
    14, ani 20 nie jest zajęte, a zapisałby trzy godziny w dwóch miejscach naraz.
  */
  const wolnyZakres = (a: number, b: number) =>
    !zajete.some((g) => g >= Math.min(a, b) && g <= Math.max(a, b));

  /** Czy tej godziny nie da się teraz kliknąć - i dlaczego, do podpowiedzi pod kursorem. */
  const niedostepna = (h: number): string | null => {
    /* dzisiejsza godzina, która już minęła; bieżąca zostaje - o 18:40 wciąż gra się „od 18" */
    if (opis.dzis && h < teraz) return "Ta godzina już minęła.";
    if (zajete.includes(h)) return "Jesteś już o tej godzinie na innym boisku.";
    /* godzina przed początkiem nie domyka zakresu, tylko go przestawia - więc to, co
       leży między nią a starym początkiem, nie ma tu znaczenia */
    if (od !== null && h > od && !wolnyZakres(od, h)) {
      return "Między tymi godzinami jesteś już na innym boisku.";
    }
    return null;
  };

  /* dziś po ostatniej godzinie siatki nie ma już czego wybrać */
  const zaPozno = opis.dzis && HOURS.every((h) => h < teraz);

  /* Po wyborze początku liczą się już tylko godziny PO nim - wcześniejsze gasną. */
  const przedPoczatkiem = (h: number) => od !== null && h < od;

  /*
    Pierwsze kliknięcie zaznacza początek, drugie zamyka zakres i zapisuje. Kliknięcie
    godziny wcześniejszej niż początek nie zapisuje niczego - przestawia początek.
  */
  const klik = (h: number) => {
    if (od === null || h < od) {
      setOd(h);
      setPodKursorem(null);
      return;
    }
    void zapisz(od, h);
  };

  const odwolaj = async () => {
    setBusy(true);
    try {
      await odwolajDeklaracje(courtId, dzien);
      setPanel((p) => ({ ...p, moje: [] }));
      reload();
    } finally {
      setBusy(false);
    }
  };

  const g2 = (h: number) => String(h).padStart(2, "0");

  return (
    /*
      Panel stoi w jednym rzędzie z kafelkami parametrów boiska, więc jest wąski i wysoki:
      nagłówek, pasek dni, stan wybranego dnia, a przycisk przyklejony do dolnej krawędzi
      (mt-auto), żeby równał się z dołem kafelków niezależnie od długości tekstu.
      Gdy ktoś się zapisał na wybrany dzień, panel się rozpala: ciepły gradient i płomień
      przy liczbie. Póki nikt nie idzie, zostaje zwykłym szkłem - inaczej ogień nic by nie
      znaczył.

      Uwaga: żadnego `overflow-hidden`. Lista godzin wysuwa się POD panelem (`top-full`),
      więc przycięcie zawartości do jego kształtu chowało ją w całości i nie dało się
      wybrać godziny.
    */
    <section
      className={`glass kafel-zywy relative flex h-full min-h-[150px] flex-col rounded-[20px] p-4 ${
        osoby > 0 ? "panel-goracy" : ""
      }`}
      style={osoby > 0 ? { ["--zar" as string]: Math.min(osoby, 6) } : undefined}
    >
      <h2 className="relative flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-faint 2xl:text-[11px]">
        <ClockIcon className="h-4 w-4 text-flame" /> Kto gra
      </h2>

      {tydzien && (
        /*
          Pasek siedmiu dni. Liczba w rogu dnia to ilu ludzi się wtedy wybiera - widać od razu,
          na który dzień się umawiają, bez przeklikiwania wszystkich. Kropka pod datą znaczy
          „tu jesteś zapisany".
        */
        <div className="relative mt-3 grid grid-cols-7 gap-1" role="tablist" aria-label="Dzień gry">
          {tydzien.map((t) => {
            const o = opisDnia(t.day, dzis);
            const wybrany = t.day === dzien;
            const moj = mojeDni.some((m) => m.day === t.day);
            return (
              <button
                key={t.day}
                role="tab"
                aria-selected={wybrany}
                aria-label={`${o.pelna}${t.osoby ? `, ${t.osoby} ${plural(t.osoby, ["osoba", "osoby", "osób"])}` : ""}${moj ? ", jesteś zapisany" : ""}`}
                onClick={() => wybierzDzien(t.day)}
                className={`relative flex min-w-0 flex-col items-center rounded-xl border pb-2 pt-1.5 transition ${
                  wybrany
                    ? "border-transparent flame-gradient text-black"
                    : "border-hairline bg-white/5 hover:border-flame/50"
                }`}
              >
                <span
                  className={`text-[9px] font-semibold uppercase tracking-[0.04em] ${
                    wybrany ? "text-black/70" : "text-faint"
                  }`}
                >
                  {o.dzis ? "Dziś" : o.krotko}
                </span>
                <span className="text-[14px] font-bold leading-tight tabular-nums">{o.numer}</span>
                {moj && (
                  <span
                    aria-hidden
                    className={`absolute bottom-[5px] h-1 w-1 rounded-full ${wybrany ? "bg-black/70" : "bg-glow"}`}
                  />
                )}
                {t.osoby > 0 && (
                  <span
                    aria-hidden
                    className={`absolute -right-1 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
                      wybrany ? "bg-black text-glow" : "flame-gradient text-black"
                    }`}
                  >
                    {t.osoby}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="relative mt-3 flex items-start gap-2 text-[15px] font-semibold leading-snug 2xl:text-[16px]">
        {osoby > 0 && <PlomykZapisow />}
        <span>
          {osoby === 0
            ? `Nikt się jeszcze nie zapisał ${opis.naKiedy}`
            : `${osoby} ${plural(osoby, ["osoba idzie", "osoby idą", "osób idzie"])} ${opis.kiedy} na to boisko`}
        </span>
      </p>

      {slots.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <span
              key={s.hour}
              className="rounded-full border border-flame/40 bg-flame/12 px-2.5 py-0.5 text-[12px] font-semibold text-glow"
            >
              {g2(s.hour)}:00 · {s.people}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[12px] leading-snug text-muted">
          Bądź pierwszy - napisz, kiedy grasz, i daj innym szansę dołączyć.
        </p>
      )}

      {picking && mine.length === 0 && !blokada && (
        /*
          Siatka godzin jako nakładka nad treścią pod spodem, a nie element w środku panelu:
          wszystkie godziny widać naraz, a rząd z parametrami boiska nie zmienia wysokości.
          Pasek dni zostaje nad nią widoczny, więc dzień da się zmienić w trakcie wyboru.
          Tło nieprzezroczyste, nie „glass": na jasnym zdjęciu półprzejrzysta szyba gubiła
          kontrast i dolne godziny stawały się nieczytelne.
        */
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[20px] border border-hairline bg-deep p-3 rise"
          style={{ boxShadow: "0 24px 60px -12px rgba(0,0,0,.85)" }}
        >
          <p className="text-[12px] font-semibold capitalize text-ink">{opis.pelna}</p>
          <p className="mb-2 mt-0.5 text-[11px] leading-snug text-muted">
            {zaPozno
              ? "Na dziś już za późno - wybierz inny dzień na pasku wyżej."
              : od === null
                ? zajete.length
                  ? "Kliknij godzinę, od której grasz. Przekreślone masz już zajęte na innym boisku."
                  : "Kliknij godzinę, od której grasz."
                : podKursorem !== null && podKursorem > od
                  ? `${g2(od)}:00-${g2(podKursorem + 1)}:00 - kliknij, żeby zapisać.`
                  : `Od ${g2(od)}:00 - kliknij godzinę końca.`}
          </p>

          {/*
            Zakres podświetlamy tylko do godziny pod kursorem, żeby było widać, co się zapisze.
            Godziny przed początkiem są wygaszone: koniec wybiera się tylko spośród późniejszych.
          */}
          <div className="grid grid-cols-4 gap-1.5" onPointerLeave={() => setPodKursorem(null)}>
            {HOURS.map((h) => {
              const wybrana = od === h;
              const powod = niedostepna(h);
              const wczesniej = przedPoczatkiem(h);
              const wZakresie = od !== null && podKursorem !== null && h > od && h <= podKursorem;
              return (
                <button
                  key={h}
                  onClick={() => klik(h)}
                  onPointerEnter={() => setPodKursorem(powod || wczesniej ? null : h)}
                  onFocus={() => setPodKursorem(powod || wczesniej ? null : h)}
                  disabled={busy || powod !== null}
                  title={powod ?? (wczesniej ? "Zacznij od tej godziny" : undefined)}
                  className={`rounded-xl border py-2 text-[12px] font-semibold tabular-nums transition ${
                    powod
                      ? `cursor-not-allowed border-hairline bg-white/[0.02] text-faint ${
                          h < teraz && opis.dzis ? "opacity-40" : "line-through"
                        }`
                      : wybrana
                        ? "border-transparent flame-gradient text-black"
                        : wczesniej
                          ? "border-hairline/50 bg-white/[0.02] text-faint opacity-45 hover:opacity-80"
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
            <p className="text-[14px] font-semibold text-glow">
              Idziesz {opis.kiedy} {opisGodzin(mine)}
            </p>
            <button
              onClick={() => void odwolaj()}
              disabled={busy}
              className="rounded-2xl flame-gradient px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              Odwołaj
            </button>
          </div>
        ) : blokada ? (
          /*
            Zamiast przycisku, który i tak odbije się od bazy - powód wprost. Deklaracja
            ma mówić, gdzie ktoś naprawdę będzie, więc jednego dnia wolno wskazać najwyżej
            dwa boiska i oba w jednym województwie.
          */
          <p className="rounded-2xl border border-hairline bg-white/5 px-4 py-3 text-[12px] leading-snug text-muted">
            {blokada}
          </p>
        ) : (
          <button
            onClick={() => {
              if (!signedIn) {
                void zapisz(18, 20);
                return;
              }
              setTeraz(new Date().getHours());
              setPicking((v) => !v);
              setOd(null);
              setPodKursorem(null);
            }}
            className="w-full rounded-2xl flame-gradient px-4 py-3 text-[13px] font-bold text-black transition hover:brightness-110"
          >
            {picking ? "wybierz godziny" : `Idę zagrać ${opis.kiedy}`}
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
