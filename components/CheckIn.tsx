"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** początek i koniec wybranego zakresu (włącznie); zapis dopiero przyciskiem */
  const [od, setOd] = useState<number | null>(null);
  const [doGodz, setDoGodz] = useState<number | null>(null);
  /** godzina pod kursorem - z niej rysujemy zakres, zanim ktoś go zatwierdzi */
  const [podKursorem, setPodKursorem] = useState<number | null>(null);
  /** bieżąca godzina, łapana przy otwarciu wyboru - dzisiejsze godziny sprzed niej gasną */
  const [teraz, setTeraz] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const { wymagaj } = useBramka();

  /*
    Stopień nagłówka „Zapisz się" = stopień wartości w sąsiednim kafelku. Kafelki wyliczają
    go w CSS z własnej szerokości, której ten panel nie zna, więc odczytujemy gotowy wynik
    i pilnujemy go przy zmianie rozmiaru okna. Styl ustawiamy wprost na elemencie - to
    czysta prezentacja, stan komponentu nie ma tu nic do rzeczy. Bez sąsiada (panel
    w innym miejscu) zostaje domyślne 40 px z klasy.
  */
  const naglowek = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const h = naglowek.current;
    // siatka kafelków to przodek z `--dl` w stylu; pierwsza wartość w niej to kafelek „Kosze"
    const wzor = h?.closest<HTMLElement>("[style*='--dl']")?.querySelector<HTMLElement>(".wartosc-plomien");
    if (!h || !wzor || wzor === h) return;
    const przepisz = () => {
      h.style.fontSize = getComputedStyle(wzor).fontSize;
    };
    przepisz();
    const obs = new ResizeObserver(przepisz);
    obs.observe(wzor.closest(".glass") ?? wzor);
    return () => obs.disconnect();
  }, []);

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

  /*
    Zmiana dnia zaczyna wybór godzin od nowa - zakres z soboty nie ma sensu w niedzielę.
    Kliknięcie dnia, który już jest wybrany, przy otwartych godzinach zamyka okienko:
    tak da się z wyboru wycofać tym samym gestem, którym się do niego weszło.
  */
  const wybierzDzien = (d: string) => {
    if (d === dzien) {
      if (picking) {
        setPicking(false);
        setOd(null);
        setDoGodz(null);
        setPodKursorem(null);
      }
      return;
    }
    setDzien(d);
    setOd(null);
    setDoGodz(null);
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
      setDoGodz(null);
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
    Wybór bez niespodzianek: pierwsze kliknięcie to początek, każde następne przesuwa koniec
    - można dokładać godziny po jednej (16, 17, 18, 19) albo od razu kliknąć ostatnią (16,
    potem 19), a środek zaznaczy się sam. Zapis dopiero przyciskiem pod siatką. Wcześniej
    drugie kliknięcie zapisywało od razu, więc na telefonie nie dało się iść godzina po
    godzinie - klik w 17 zamykał zakres na 16-17.

    Godzina wcześniejsza niż początek przestawia początek. Kliknięcie samego początku, gdy
    wybrana jest tylko ta jedna godzina, zdejmuje wybór; kliknięcie końca skraca zakres
    o jedną godzinę - tak da się cofnąć ostatnie dołożenie.
  */
  const klik = (h: number) => {
    setPodKursorem(null);
    if (od === null || h < od) {
      setOd(h);
      setDoGodz((d) => (d !== null && d >= h && wolnyZakres(h, d) ? d : h));
      return;
    }
    const koniec = doGodz ?? od;
    if (h === od && koniec === od) {
      setOd(null);
      setDoGodz(null);
      return;
    }
    if (h === koniec) {
      setDoGodz(Math.max(od, koniec - 1));
      return;
    }
    setDoGodz(h);
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
      nagłówek, pasek dni, stan wybranego dnia, a przycisk przyklejony do dolnej krawędzi,
      żeby równał się z dołem kafelków niezależnie od długości tekstu. Pasek dni (razem
      z tym, co pod nim) stoi na `my-auto`, czyli dokładnie w połowie między nagłówkiem
      a przyciskiem - wolne miejsce z wyższego rzędu dzieli się po równo nad i pod nim.
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
      {/*
        Nagłówek jak wartości w kafelkach obok - Anton w gradiencie i DOKŁADNIE ich rozmiar:
        kafelki liczą go od szerokości i najdłuższej wartości (patrz `Spec` w CourtDetail),
        więc zamiast zgadywać, przepisujemy wyliczony stopień z sąsiada.
      */}
      {/* dolny zapas pod ogonek „Ę" (gradient maluje się tylko w pudełku wiersza), ujemny margines oddaje część z powrotem, żeby pasek dni stał optycznie w połowie od podstawy liter do przycisku */}
      <h2 ref={naglowek} className="wartosc-plomien relative self-start text-[40px]" style={{ paddingBottom: "0.16em", marginBottom: "-0.08em" }}>
        Zapisz się
      </h2>

      <div className="my-auto py-2">
        {tydzien && (
          /*
            Pasek siedmiu dni. Liczba w rogu dnia to ilu ludzi się wtedy wybiera - widać od razu,
            na który dzień się umawiają, bez przeklikiwania wszystkich. Kropka pod datą znaczy
            „tu jesteś zapisany".
          */
          <div className="relative grid grid-cols-7 gap-1" role="tablist" aria-label="Dzień gry">
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
                  className={`relative flex min-w-0 flex-col items-center rounded-[13px] border pb-2 pt-1.5 transition ${
                    wybrany
                      ? "kafel-wybrany"
                      : "border-hairline bg-white/6 hover:border-flame/50"
                  }`}
                >
                  <span
                    className={`text-[8.5px] font-bold uppercase tracking-[0.06em] ${
                      wybrany ? "text-[#150800]/70" : "text-faint"
                    }`}
                  >
                    {o.dzis ? "Dziś" : o.krotko}
                  </span>
                  <span className="text-[17px] font-extrabold leading-[1.05] tabular-nums">{o.numer}</span>
                  {moj && (
                    <span
                      aria-hidden
                      className={`absolute bottom-[5px] h-1 w-1 rounded-full ${wybrany ? "bg-black/70" : "bg-glow"}`}
                    />
                  )}
                  {t.osoby > 0 && (
                    <span
                      aria-hidden
                      className={`absolute -right-1.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold tabular-nums ${
                        wybrany ? "bg-[#0c0908] text-glow ring-1 ring-black/40" : "kafel-wybrany"
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

        {/*
          Liczba osób i godziny pojawiają się dopiero, gdy ktoś się zapisał. Pusty stan nie
          potrzebuje zdania - nagłówek „Zapisz się" i przycisk mówią to samo krócej, a panel
          jest dzięki temu niski i kafelki obok zostają prawie kwadratowe.
        */}
        {osoby > 0 && (
          <>
            <p className="relative mt-3 flex items-start gap-2 text-[15px] font-extrabold leading-snug tracking-[-0.01em] 2xl:text-[16px]">
              <PlomykZapisow />
              <span>
                {`${osoby} ${plural(osoby, ["osoba idzie", "osoby idą", "osób idzie"])} ${opis.kiedy}`}
              </span>
            </p>
            {slots.length > 0 && (
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
            )}
          </>
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
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[24px] border border-hairline bg-deep p-3.5 rise"
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
                  : "Dokładaj kolejne godziny albo kliknij ostatnią - i zapisz."}
            </p>

            {/*
              Zaznaczony zakres świeci od początku do końca. Na komputerze kursor za końcem
              pokazuje jeszcze podgląd, dokąd zakres by sięgnął po kliknięciu. Godziny przed
              początkiem są wygaszone - kliknięta przestawia początek.
            */}
            <div className="grid grid-cols-4 gap-2" onPointerLeave={() => setPodKursorem(null)}>
              {HOURS.map((h) => {
                const wybrana = od === h;
                const powod = niedostepna(h);
                const wczesniej = przedPoczatkiem(h);
                const koniec = doGodz ?? od;
                const wZakresie =
                  od !== null &&
                  h > od &&
                  (h <= (koniec ?? od) || (podKursorem !== null && podKursorem > (koniec ?? od) && h <= podKursorem));
                return (
                  <button
                    key={h}
                    onClick={() => klik(h)}
                    onPointerEnter={() => setPodKursorem(powod || wczesniej ? null : h)}
                    onFocus={() => setPodKursorem(powod || wczesniej ? null : h)}
                    disabled={busy || powod !== null}
                    title={powod ?? (wczesniej ? "Zacznij od tej godziny" : undefined)}
                    className={`rounded-[13px] border py-2.5 text-[13px] font-bold tabular-nums transition ${
                      powod
                        ? `cursor-not-allowed border-hairline bg-white/[0.02] text-faint ${
                            h < teraz && opis.dzis ? "opacity-40" : "line-through"
                          }`
                        : wybrana
                          ? "kafel-wybrany"
                          : wczesniej
                            ? "border-hairline/50 bg-white/[0.02] text-faint opacity-45 hover:opacity-80"
                            : wZakresie
                              ? "border-flame/80 bg-flame/18 text-glow"
                              : "border-hairline bg-white/5 text-muted hover:border-flame/50 hover:text-glow"
                    }`}
                  >
                    {h}:00
                  </button>
                );
              })}
            </div>

            {od !== null && (
              <button
                onClick={() => void zapisz(od, doGodz ?? od)}
                disabled={busy}
                className="przycisk-plomien mt-3 w-full rounded-full py-3 text-[13px] font-extrabold disabled:opacity-60"
              >
                Zapisz {opisGodzin(Array.from({ length: (doGodz ?? od) - od + 1 }, (_, i) => od + i))}
              </button>
            )}
          </div>
        )}

        {hint && <p className="mt-2 text-[12px] leading-snug text-muted">{hint}</p>}
      </div>

      <div>
        {mine.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-extrabold text-glow">
              Idziesz {opis.kiedy} {opisGodzin(mine)}
            </p>
            <button
              onClick={() => void odwolaj()}
              disabled={busy}
              className="przycisk-plomien rounded-full px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-60"
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
              setDoGodz(null);
              setPodKursorem(null);
            }}
            className="przycisk-plomien w-full rounded-full px-4 py-3.5 text-[14px] font-extrabold"
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
