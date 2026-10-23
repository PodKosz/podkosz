"use client";

import { useEffect, useRef, useState } from "react";
import { Access, MapCourt, Siatka, Surface } from "@/lib/types";
import { DEFAULT_FILTERS, Filters, KoszeFiltr, KtoGra } from "@/lib/filters";
import { plural } from "@/lib/site";
import { useLosowanie } from "./Losowanie";
import {
  BulbIcon,
  ChevronIcon,
  ClockIcon,
  DiceIcon,
  FlameIcon,
  HoopIcon,
  NetIcon,
  PeopleIcon,
  ResetIcon,
  SlidersIcon,
  SurfaceIcon,
} from "./icons";
import { Brand } from "./Brand";
import { Szukajka } from "./Szukajka";
import type { CelMapy } from "@/lib/miejsca";

/*
  Opcje filtrów w kolejności ważności dla kogoś, kto szuka, gdzie zagrać:
    1. kto gra dziś - jedyny filtr, który zmienia się w ciągu dnia, i najmocniejszy powód,
       żeby wyjść z domu;
    2. dostępność, oświetlenie, polubienia - czy da się zagrać teraz albo wieczorem
       i czy boisko jest lubiane;
    3. liczba koszy - czy zagramy na całe boisko;
    4. nawierzchnia i siatka - jakość, ważna, ale dopiero na końcu.

  Wypadły: typ boiska (krytych na razie nie ma), parkiet z nawierzchni (to nawierzchnia hal),
  województwo (miejsce wpisuje się w wyszukiwarkę) i suwak podpaleń (jest przełącznik
  „Polubione” - przy kilku polubieniach na boisko suwak i tak miał dwie, trzy pozycje).
  Filtry z adresu strony dalej działają; „Wyczyść” zdejmuje także te bez kontrolek.
*/
const KTO_GRA: [KtoGra, string][] = [
  ["", "Wszystkie"],
  ["gra", "Ktoś gra"],
  ["pusto", "Pusto"],
];

const DOSTEP: [Access | "", string][] = [
  ["", "Każda"],
  ["24h", "24/7"],
  ["godziny", "Godziny"],
  ["ograniczony", "Ograniczona"],
];

const KOSZE: [KoszeFiltr | "", string][] = [
  ["", "Dowolnie"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3+"],
];

const SIATKI: [Siatka | "", string][] = [
  ["", "Dowolna"],
  ["siatka", "Siatka"],
  ["lancuch", "Łańcuch"],
  ["brak", "Bez siatki"],
];

/** sześć pól, czyli równa siatka 3 × 2 - pierwsze zdejmuje wybór */
const NAWIERZCHNIE: [Surface | "", string][] = [
  ["", "Każda"],
  ["beton", "Beton"],
  ["asfalt", "Asfalt"],
  ["poliuretan", "Poliuretan"],
  ["plytki", "Płytki"],
  ["syntetyk", "Sztuczna trawa"],
];

/**
 * Ile grup filtrów odbiega od domyślnych - liczba przy „Filtry” na zwiniętym panelu. Liczy też
 * filtry z adresu strony, które nie mają już kontrolek (typ, województwo, tekst), bo działają.
 */
function ileCzynnych(f: Filters) {
  return [
    Object.values(f.types).some((t) => !t),
    f.surfaces.length > 0,
    Boolean(f.voivodeship),
    Boolean(f.access),
    f.onlyLit,
    f.minLikes > 0,
    f.siatki.length > 0,
    f.kosze.length > 0,
    Boolean(f.ktoGra),
    Boolean(f.q.trim()),
  ].filter(Boolean).length;
}

/** filtr wielokrotnego wyboru pokazany jako pojedynczy: zaznaczone, gdy wybrana jest dokładnie ta jedna wartość */
const jedna = <T,>(lista: T[], v: T | "") => (v === "" ? lista.length === 0 : lista.length === 1 && lista[0] === v);

export function Sidebar({
  filters,
  setFilters,
  results,
  policz,
  grajace,
  boiska,
  onBoisko,
  onMiejsce,
  onWyczyscCel,
  sheetOpen,
  setSheetOpen,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** wyniki filtrowania - panel potrzebuje samego licznika */
  results: MapCourt[];
  /** ile boisk przejdzie przez podane filtry - liczby przy opcjach „kto gra dziś” */
  policz: (f: Filters) => number;
  /** na ilu boiskach ktoś się dziś zapisał - do podpowiedzi pod „kto gra dziś” */
  grajace: number;
  /** wszystkie boiska - wyszukiwarka podpowiada z nich nazwy i liczy najbliższe */
  boiska: MapCourt[];
  onBoisko: (c: MapCourt) => void;
  onMiejsce: (cel: CelMapy) => void;
  onWyczyscCel: () => void;
  /*
    Stan arkusza na telefonie siedzi w Explorerze, bo dotyczy też mapy: przy otwarciu
    panelu trzeba schować wizytówkę boiska, żeby jedno nie nachodziło na drugie.
  */
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
}) {
  /** kostka na czas losowania boiska - `nakladka` doklejamy na końcu drzewa */
  const { losuj, nakladka } = useLosowanie();
  /** Na komputerze filtry są zwinięte pod paskiem wyszukiwania - mapa ma wtedy całe miejsce. */
  const [rozwiniete, setRozwiniete] = useState(false);
  const czynne = ileCzynnych(filters);

  /*
    Gest na telefonie: przeciągnięcie w górę wyciąga arkusz, w dół go schowa.
    Zamykamy tylko wtedy, gdy lista jest przewinięta na samą górę - inaczej
    zwykłe przewijanie wyników zamykałoby panel.

    Nasłuchy zakładamy ręcznie, a nie przez onTouch* Reacta: React rejestruje
    `touchmove` jako pasywny, więc z jego zdarzenia nie da się wywołać
    preventDefault. Bez tego przeglądarka obsługiwała gest po swojemu - na
    telefonie razem z arkuszem ruszała się mapa pod nim.
  */
  const sheetRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /*
    Arkusz ma zawsze pełną wysokość, a zwinięty jest zsunięty w dół transformacją -
    dzięki temu wysuwanie da się animować (przejście z `top: auto` na konkretną wartość
    przeglądarka potrafi tylko przeskoczyć). Wysokość widocznego paska mierzymy, bo
    zależy od tego, ile miejsca zajmuje wyszukiwarka i lista najbliższych boisk.
  */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripH, setStripH] = useState(150);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // aktualizujemy tylko przy zwiniętym arkuszu - wtedy pasek ma docelową wysokość
      if (!sheetOpen) setStripH(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetOpen]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    let start: { x: number; y: number; atTop: boolean; onList: boolean } | null = null;

    const scrollable = (node: EventTarget | null) => {
      const list = scrollRef.current;
      return !!list && node instanceof Node && list.contains(node);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const list = scrollRef.current;
      start = {
        x: t.clientX,
        y: t.clientY,
        atTop: (list?.scrollTop ?? 0) <= 2,
        onList: scrollable(e.target),
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!start || !e.cancelable) return;
      const t = e.touches[0];
      const dy = start.y - t.clientY;
      if (Math.abs(dy) < Math.abs(t.clientX - start.x)) return;

      const list = scrollRef.current;
      if (start.onList && list) {
        // wewnątrz listy przewijanie zostawiamy przeglądarce, blokujemy tylko odbijanie
        // na końcach - to ono przenosiło gest na mapę pod arkuszem
        const naDole = list.scrollHeight - list.scrollTop - list.clientHeight <= 1;
        if ((dy > 0 && naDole) || (dy < 0 && list.scrollTop <= 0)) e.preventDefault();
        return;
      }

      // uchwyt, wyszukiwarka, stopka: cały pionowy ruch jest nasz
      e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      const from = start;
      start = null;
      if (!from) return;
      const t = e.changedTouches[0];
      const dy = from.y - t.clientY;
      // ruch bardziej poziomy niż pionowy to nie jest ten gest
      if (Math.abs(dy) < 44 || Math.abs(t.clientX - from.x) > Math.abs(dy)) return;
      if (dy > 0) setSheetOpen(true);
      else if (from.atTop) setSheetOpen(false);
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd, { passive: true });
    sheet.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [setSheetOpen]);

  const patch = (p: Partial<Filters>) => setFilters({ ...filters, ...p });

  /* wybór w wyszukiwarce na telefonie zwija arkusz - inaczej zasłaniałby mapę, do której leci */
  const naBoisko = (c: MapCourt) => {
    setSheetOpen(false);
    onBoisko(c);
  };
  const naMiejsce = (cel: CelMapy) => {
    setSheetOpen(false);
    onMiejsce(cel);
  };

  const filtry = (licznik: boolean) => (
    <Filtry
      filters={filters}
      patch={patch}
      wyczysc={() => setFilters({ ...DEFAULT_FILTERS })}
      czynne={czynne > 0}
      ile={licznik ? results.length : null}
      policz={policz}
      grajace={grajace}
      losuj={() => losuj("/losowe")}
    />
  );

  return (
    <>
      {/* ---------- komputer: logo, wyszukiwarka i filtry jedno pod drugim ---------- */}
      <div className="pointer-events-none absolute left-5 top-5 bottom-5 z-30 hidden w-[386px] flex-col gap-3 lg:flex">
        {/* logo bez kafelka - leży wprost na mapie, cień trzyma czytelność */}
        <div
          className="pointer-events-auto shrink-0 pl-1"
          style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,.85))" }}
        >
          <Brand />
        </div>

        {/*
          Układ „Bez ramki” (22.10.2026, 10 propozycji w podglądzie): sam pasek wyszukiwania na
          mapie, pod nim po prawej napis „Filtry” bez tła, a filtry rozwijają się niżej jako osobna
          karta. Licznika boisk tu nie ma - liczba przy „Filtry” mówi tylko, ile filtrów działa.
          Zwinięte zostawiają mapie całe miejsce; rozwinięte przy niskim oknie przewijają się
          w środku karty. Podpowiedzi wyszukiwarki leżą nad kartą filtrów (z-index w CSS).
        */}
        <div className="pointer-events-auto flex min-h-0 shrink flex-col">
          <Szukajka boiska={boiska} onBoisko={onBoisko} onMiejsce={onMiejsce} onWyczysc={onWyczyscCel} />
          <button
            onClick={() => setRozwiniete((v) => !v)}
            aria-expanded={rozwiniete}
            aria-controls="filtry-mapy"
            className="filtry-przelacznik"
          >
            <SlidersIcon className="h-4 w-4" aria-hidden />
            Filtry
            {czynne > 0 && <i>{czynne}</i>}
            <ChevronIcon className={`h-4 w-4 transition-transform duration-300 ${rozwiniete ? "rotate-180" : ""}`} />
          </button>
          {rozwiniete && (
            <div id="filtry-mapy" className="panel-filtrow filtry-rozwiniete flex min-h-0 flex-col">
              <div className="scroll-thin min-h-0 overflow-y-auto px-[18px] pb-[18px] pt-4">{filtry(false)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- telefon: arkusz wysuwany od dołu ---------- */}
      {/* przygaszenie mapy pod arkuszem - dotknięcie zamyka panel */}
      <div
        onClick={() => setSheetOpen(false)}
        className={`fixed inset-0 z-[25] bg-void/55 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          sheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={sheetRef}
        style={{
          touchAction: "none",
          transform: sheetOpen ? "translateY(0)" : `translateY(calc(100% - ${stripH}px))`,
          transition: "transform 460ms cubic-bezier(.32,.72,0,1)",
          willChange: "transform",
        }}
        // od górnej krawędzi zwiniętego arkusza mapa na telefonie liczy dolny margines kadru
        data-kadr="dol"
        // rozwinięty arkusz zaczyna się tuż pod paskiem nawigacji - na telefonie pasek ma dwa
        // rzędy (logo, pod nim menu), od `sm` jeden (TopNav)
        className="panel-filtrow pointer-events-auto fixed inset-x-0 bottom-0 top-[120px] z-30 flex flex-col rounded-t-[22px] sm:top-[96px] lg:hidden"
      >
        <div ref={stripRef}>
          <button
            onClick={() => setSheetOpen(!sheetOpen)}
            className="flex min-h-5 w-full flex-col items-center justify-center gap-1.5 pb-1 pt-2"
            aria-label={sheetOpen ? "Zwiń panel" : "Rozwiń panel"}
          >
            <span className="h-1 w-10 rounded-full bg-[rgb(var(--rgb-szyba)/0.25)]" />
            {sheetOpen && (
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-faint">
                <ChevronIcon className="h-3.5 w-3.5" /> zwiń, pokaż mapę
              </span>
            )}
          </button>

          <div className="px-4 pt-0.5">
            {/* wejście w pole rozwija arkusz - podpowiedzi potrzebują miejsca nad klawiaturą */}
            <Szukajka
              boiska={boiska}
              onBoisko={naBoisko}
              onMiejsce={naMiejsce}
              onWyczysc={onWyczyscCel}
              onFocus={() => setSheetOpen(true)}
            />
          </div>

          {/*
            Zwinięty pasek w jednym wierszu: licznik po lewej, „filtry" po prawej. Wcześniej były
            to dwie linie jedna pod drugą plus przycisk losowania obok, a cały pasek zajmował
            piątą część ekranu telefonu. Losowanie jest na dole rozwiniętego panelu.
          */}
          {!sheetOpen && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex w-full items-center justify-between gap-3 px-5 pt-2.5"
              style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))" }}
            >
              <span className="text-[13px] text-muted">
                <b className="text-[15px] font-semibold tabular-nums text-ink">{results.length}</b>{" "}
                {plural(results.length, ["boisko", "boiska", "boisk"])} na mapie
              </span>
              <span className="flex items-center gap-1 text-[12px] uppercase tracking-[0.12em] text-ink">
                filtry
                <ChevronIcon className="h-4 w-4 rotate-180" />
              </span>
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          style={{ touchAction: "pan-y" }}
          className={`scroll-thin mt-3 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 ${
            sheetOpen ? "block" : "hidden"
          }`}
        >
          {filtry(true)}
        </div>
      </aside>

      {nakladka}
    </>
  );
}

/**
 * Jedna sekcja filtrów: ikona z nagłówkiem i treść.
 *
 * `kolejnosc` to miejsce w kaskadzie wjazdu - CSS bierze z niej opóźnienie animacji, więc
 * sekcje pojawiają się jedna po drugiej, a nie wszystkie naraz.
 */
function Sekcja({
  tytul,
  Ikona,
  kolejnosc,
  children,
}: {
  tytul: string;
  Ikona: typeof ClockIcon;
  kolejnosc: number;
  children: React.ReactNode;
}) {
  return (
    <section className="sekcja-filtra" style={{ "--i": kolejnosc } as React.CSSProperties}>
      <h2>
        <Ikona className="h-3.5 w-3.5" aria-hidden />
        {tytul}
      </h2>
      {children}
    </section>
  );
}

/** Wybór jednej opcji: równe segmenty na całą szerokość panelu. */
function Wybor<T extends string>({
  opcje,
  wybrane,
  ustaw,
  liczby,
  etykieta,
}: {
  opcje: [T, string][];
  wybrane: (v: T) => boolean;
  ustaw: (v: T) => void;
  /** liczba boisk przy każdej opcji - tylko tam, gdzie mówi coś ważnego */
  liczby?: (v: T) => number;
  etykieta: string;
}) {
  return (
    <div className="wybor" role="group" aria-label={etykieta}>
      {opcje.map(([v, label]) => (
        <button key={v || "wszystko"} onClick={() => ustaw(v)} aria-pressed={wybrane(v)} className="wybor-opcja">
          {label}
          {liczby ? <span className="wybor-liczba">{liczby(v)}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Filtry mapy - ta sama treść na komputerze i w arkuszu na telefonie.
 *
 * Wszystkie widoczne od razu, bez zwijania: stan filtrów czyta się z jednego spojrzenia.
 */
function Filtry({
  filters,
  patch,
  wyczysc,
  czynne,
  ile,
  policz,
  grajace,
  losuj,
}: {
  filters: Filters;
  patch: (p: Partial<Filters>) => void;
  wyczysc: () => void;
  /** czy cokolwiek odbiega od stanu domyślnego - od tego zależy przycisk czyszczenia */
  czynne: boolean;
  /** licznik nad filtrami - na telefonie; na komputerze stoi w wierszu „Filtry” pod wyszukiwarką */
  ile: number | null;
  policz: (f: Filters) => number;
  grajace: number;
  losuj: () => void;
}) {
  const podpalone = filters.minLikes > 0;

  return (
    <div className="filtry">
      {ile !== null && (
        <div className="filtry-naglowek">
          <span>
            <b>{ile}</b> {plural(ile, ["boisko", "boiska", "boisk"])} na mapie
          </span>
        </div>
      )}

      <Sekcja tytul="Kto gra dziś" Ikona={PeopleIcon} kolejnosc={0}>
        <Wybor
          etykieta="Kto gra dziś"
          opcje={KTO_GRA}
          wybrane={(v) => filters.ktoGra === v}
          ustaw={(v) => patch({ ktoGra: v })}
          liczby={(v) => policz({ ...filters, ktoGra: v })}
        />
        {grajace === 0 && <p className="filtry-uwaga">na dziś nikt się jeszcze nie zapisał przez „Idę zagrać”</p>}
      </Sekcja>

      <Sekcja tytul="Dostępność" Ikona={ClockIcon} kolejnosc={1}>
        <Wybor
          etykieta="Dostępność"
          opcje={DOSTEP}
          wybrane={(v) => filters.access === v}
          ustaw={(v) => patch({ access: v })}
        />
      </Sekcja>

      <div className="filtry-dwa sekcja-filtra" style={{ "--i": 2 } as React.CSSProperties}>
        <button
          onClick={() => patch({ onlyLit: !filters.onlyLit })}
          aria-pressed={filters.onlyLit}
          className="przelacznik-filtra"
        >
          <BulbIcon className="h-[18px] w-[18px]" aria-hidden />
          <span>Oświetlone</span>
          <span className="switch" data-on={filters.onlyLit} />
        </button>
        <button
          onClick={() => patch({ minLikes: podpalone ? 0 : 1 })}
          aria-pressed={podpalone}
          className="przelacznik-filtra"
          title="Boiska, które ktoś polubił"
        >
          <FlameIcon className="h-[18px] w-[18px]" aria-hidden />
          <span>Polubione</span>
          <span className="switch" data-on={podpalone} />
        </button>
      </div>

      <Sekcja tytul="Liczba koszy" Ikona={HoopIcon} kolejnosc={3}>
        <Wybor
          etykieta="Liczba koszy"
          opcje={KOSZE}
          wybrane={(v) => jedna(filters.kosze, v)}
          ustaw={(v) => patch({ kosze: v ? [v] : [] })}
        />
      </Sekcja>

      <Sekcja tytul="Nawierzchnia" Ikona={SurfaceIcon} kolejnosc={4}>
        <div className="kafle-filtra" role="group" aria-label="Nawierzchnia">
          {NAWIERZCHNIE.map(([s, label]) => (
            <button
              key={s || "kazda"}
              onClick={() =>
                patch({
                  surfaces: !s
                    ? []
                    : filters.surfaces.includes(s)
                      ? filters.surfaces.filter((x) => x !== s)
                      : [...filters.surfaces, s],
                })
              }
              aria-pressed={s ? filters.surfaces.includes(s) : filters.surfaces.length === 0}
              className="kafel-filtra"
            >
              {label}
            </button>
          ))}
        </div>
      </Sekcja>

      <Sekcja tytul="Siatka na koszach" Ikona={NetIcon} kolejnosc={5}>
        <Wybor
          etykieta="Siatka na koszach"
          opcje={SIATKI}
          wybrane={(v) => jedna(filters.siatki, v)}
          ustaw={(v) => patch({ siatki: v ? [v] : [] })}
        />
        {/* starsze boiska nie mają siatki w bazie - bez tej uwagi ich zniknięcie wyglądałoby na błąd */}
        {filters.siatki.length > 0 && (
          <p className="filtry-uwaga">boiska, przy których nikt nie podał siatki, są wtedy schowane</p>
        )}
      </Sekcja>

      {/*
        Przycisk losowania, nie odnośnik: najpierw kostka, potem karta boiska. Adres i tak
        liczy serwer - `useLosowanie` odpytuje tę samą trasę `/losowe`, tylko przez `fetch`.
      */}
      <div className="filtry-stopka sekcja-filtra" style={{ "--i": 6 } as React.CSSProperties}>
        <button onClick={losuj} className="przycisk-filtra" title="Wskocz na kartę losowego boiska">
          <DiceIcon className="h-4 w-4" aria-hidden />
          Wylosuj boisko
        </button>
        <button onClick={wyczysc} disabled={!czynne} className="przycisk-filtra">
          <ResetIcon className="h-4 w-4" aria-hidden />
          Wyczyść filtry
        </button>
      </div>
    </div>
  );
}
