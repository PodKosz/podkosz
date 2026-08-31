"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCESS_LABEL,
  Access,
  CourtType,
  MapCourt,
  SURFACE_LABEL,
  Surface,
  TYPE_LABEL,
  VOIVODESHIPS,
} from "@/lib/types";
import { DEFAULT_FILTERS, Filters } from "@/lib/filters";
import { useLosowanie } from "./Losowanie";
import {
  BallIcon,
  BulbIcon,
  ChevronIcon,
  CourtIcon,
  DiceIcon,
  FireBallIcon,
  HoopIcon,
  PinIcon,
  SearchIcon,
} from "./icons";
import { Brand } from "./Brand";

const ACCESS_TABS: [Access | "", string][] = [
  ["", "Każda"],
  ["24h", "24/7"],
  ["godziny", "Godziny"],
  ["ograniczony", "Ograniczony"],
];

const TYPE_ICON: Record<CourtType, typeof BallIcon> = {
  otwarty: BallIcon,
  kryty: CourtIcon,
  streetball: HoopIcon,
};

export function Sidebar({
  filters,
  setFilters,
  maksLajki,
  results,
  counts,
  sheetOpen,
  setSheetOpen,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** najwięcej podpaleń, jakie ma dziś jakiekolwiek boisko - górna granica suwaka */
  maksLajki: number;
  /** wyniki filtrowania - potrzebny sam licznik, listy panel już nie pokazuje */
  results: MapCourt[];
  counts: Record<CourtType, number>;
  /*
    Stan arkusza na telefonie siedzi w Explorerze, bo dotyczy też mapy: przy otwarciu
    panelu trzeba schować wizytówkę boiska, żeby jedno nie nachodziło na drugie.
  */
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
}) {
  /** Na komputerze panel filtrów jest schowany pod napisem „filtry”. */
  const [panelOpen, setPanelOpen] = useState(false);
  /** kostka na czas losowania boiska - `nakladka` doklejamy na końcu drzewa */
  const { losuj, nakladka } = useLosowanie();

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
    zależy od tego, ile miejsca zajmuje wyszukiwarka i wiersz z licznikiem.
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

  const toggleSurface = (s: Surface) =>
    patch({
      surfaces: filters.surfaces.includes(s)
        ? filters.surfaces.filter((x) => x !== s)
        : [...filters.surfaces, s],
    });

  return (
    <>
      {/* ---------- komputer: osobne pudełka jedno pod drugim ---------- */}
      <div className="pointer-events-none absolute left-5 top-5 bottom-5 z-30 hidden w-[386px] flex-col gap-3 md:flex">
        {/* logo bez kafelka - leży wprost na mapie, cień trzyma czytelność */}
        <div
          className="pointer-events-auto shrink-0 pl-1"
          style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,.85))" }}
        >
          <Brand />
        </div>

        <div className="glass-dim pointer-events-auto shrink-0 rounded-[26px] p-2.5">
          <div className="field flex items-center gap-2 py-1.5 pl-4 pr-1.5">
            <input
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Szukaj boiska w Polsce…"
              className="w-full bg-transparent py-2 text-[13px] uppercase tracking-wide outline-none placeholder:text-faint"
            />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full flame-gradient text-black">
              <SearchIcon className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="glass-dim flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-ink"
          >
            filtry
            <span className="text-faint normal-case tracking-normal">
              ({results.length})
            </span>
            <ChevronIcon
              className={`h-3.5 w-3.5 transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/*
            Przycisk, nie odnośnik: losowanie ma najpierw pokazać kostkę, a dopiero potem
            przejść na kartę boiska. Adres i tak liczy serwer - `useLosowanie` odpytuje
            tę samą trasę `/losowe`, tylko przez `fetch`.
          */}
          <button
            onClick={() => losuj("/losowe")}
            className="glass-dim flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-flame"
            title="Wskocz na kartę losowego boiska"
          >
            <DiceIcon className="h-4 w-4" />
            losowe boisko
          </button>
        </div>

        {panelOpen && (
          <div className="panel-filtrow pointer-events-auto min-h-0 flex-1 rounded-[26px]">
            <div className="scroll-thin h-full overflow-y-auto px-5 py-4">
              <Filtry
                filters={filters}
                patch={patch}
                maksLajki={maksLajki}
                toggleSurface={toggleSurface}
                counts={counts}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------- telefon: arkusz wysuwany od dołu ---------- */}
      {/* przygaszenie mapy pod arkuszem - dotknięcie zamyka panel */}
      <div
        onClick={() => setSheetOpen(false)}
        className={`fixed inset-0 z-[25] bg-void/55 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${
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
        className="panel-filtrow pointer-events-auto fixed inset-x-0 bottom-0 top-[68px] z-30 flex flex-col rounded-t-[26px] md:hidden"
      >
        <div ref={stripRef}>
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          className="flex w-full flex-col items-center gap-1.5 pb-1 pt-2.5"
          aria-label={sheetOpen ? "Zwiń panel" : "Rozwiń panel"}
        >
          <span className="h-1 w-10 rounded-full bg-white/25" />
          {sheetOpen && (
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-faint">
              <ChevronIcon className="h-3.5 w-3.5" /> zwiń, pokaż mapę
            </span>
          )}
        </button>

        <div className="px-4 pt-1">
          <div className="field flex items-center gap-2 py-1.5 pl-4 pr-1.5">
            <input
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Szukaj boiska w Polsce…"
              className="w-full bg-transparent py-2 text-[13px] uppercase tracking-wide outline-none placeholder:text-faint"
            />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full flame-gradient text-black">
              <SearchIcon className="h-4 w-4" />
            </span>
          </div>
        </div>

        {!sheetOpen && (
          <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-3">
            <button onClick={() => setSheetOpen(true)} className="text-left">
              <span className="text-[13px] font-semibold">
                {results.length} {results.length === 1 ? "boisko" : "boisk"} na mapie
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] text-flame">
                filtry
                <ChevronIcon className="h-4 w-4 rotate-180" />
              </span>
            </button>
            {/* wersja na telefon - to samo losowanie z kostką co na dużym ekranie */}
            <button
              onClick={() => losuj("/losowe")}
              className="flex shrink-0 items-center gap-2 rounded-full border border-hairline bg-white/5 px-3.5 py-2 text-[11px] uppercase tracking-[0.14em] text-muted"
            >
              <DiceIcon className="h-4 w-4" />
              losowe
            </button>
          </div>
        )}
        </div>

        <div
          ref={scrollRef}
          style={{ touchAction: "pan-y" }}
          className={`scroll-thin mt-2 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 ${
            sheetOpen ? "block" : "hidden"
          }`}
        >
          <Filtry
            filters={filters}
            patch={patch}
            maksLajki={maksLajki}
            toggleSurface={toggleSurface}
            counts={counts}
          />
        </div>
      </aside>

      {nakladka}
    </>
  );
}

/**
 * Jedna sekcja filtrów: nagłówek, opcjonalna wartość po prawej, treść.
 *
 * `kolejnosc` to miejsce w kaskadzie wjazdu - CSS bierze z niej opóźnienie animacji, więc
 * sekcje pojawiają się jedna po drugiej, a nie wszystkie naraz.
 */
function Sekcja({
  tytul,
  prawo,
  kolejnosc,
  children,
}: {
  tytul: string;
  prawo?: React.ReactNode;
  kolejnosc: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="sekcja-filtra py-5 first:pt-1"
      style={{ "--i": kolejnosc } as React.CSSProperties}
    >
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-faint">{tytul}</h2>
        {prawo ? <span className="ml-auto">{prawo}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Filtry mapy - ta sama treść na komputerze i w arkuszu na telefonie.
 *
 * Panel jest teraz wyłącznie filtrami. Wcześniej pod nimi jechała jeszcze numerowana lista
 * wszystkich wyników i to ona zajmowała większość wysokości: filtry były wąskim paskiem na
 * górze, a dwie z nich („Nawierzchnia" i „Więcej filtrów") siedziały schowane w zwijanych
 * pudełkach, bo inaczej nie miały gdzie się zmieścić. Do województwa czy oświetlenia trzeba
 * było dojechać dwoma kliknięciami.
 *
 * Teraz każdy filtr ma własną sekcję i wszystkie są widoczne od razu, bez zwijania. Nie ma
 * czego rozwijać, bo nie ma z czym konkurować o miejsce - a stan filtrów czyta się z jednego
 * spojrzenia, zamiast pamiętać, co jest pod którym pudełkiem.
 */
function Filtry({
  filters,
  patch,
  maksLajki,
  toggleSurface,
  counts,
}: {
  filters: Filters;
  patch: (p: Partial<Filters>) => void;
  maksLajki: number;
  toggleSurface: (s: Surface) => void;
  counts: Record<CourtType, number>;
}) {
  /* czy cokolwiek odbiega od stanu domyślnego - od tego zależy, czy pokazujemy czyszczenie */
  const czynne =
    (Object.keys(filters.types) as CourtType[]).some((t) => !filters.types[t]) ||
    filters.surfaces.length > 0 ||
    Boolean(filters.voivodeship) ||
    Boolean(filters.access) ||
    filters.onlyLit ||
    filters.minLikes > 0;

  const prog = Math.min(filters.minLikes, maksLajki);

  return (
    <div>
      <Sekcja tytul="typ boiska" kolejnosc={0}>
        <div className="space-y-1">
          {(Object.keys(TYPE_LABEL) as CourtType[]).map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button
                key={t}
                onClick={() => patch({ types: { ...filters.types, [t]: !filters.types[t] } })}
                className="wiersz-filtra flex w-full items-center gap-3 px-1.5 py-2 text-left"
              >
                <Icon className="h-4 w-4 shrink-0 text-flame" />
                <span className="flex-1 text-[14px]">
                  {TYPE_LABEL[t]} <span className="text-faint">[{counts[t]}]</span>
                </span>
                <span className="switch" data-on={filters.types[t]} />
              </button>
            );
          })}
        </div>
      </Sekcja>

      <Sekcja
        tytul="nawierzchnia"
        kolejnosc={1}
        prawo={
          filters.surfaces.length ? (
            <span className="text-[11px] uppercase tracking-[0.12em] text-flame">
              {filters.surfaces.length} z {Object.keys(SURFACE_LABEL).length}
            </span>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleSurface(s)}
              data-on={filters.surfaces.includes(s)}
              className="pastylka rounded-full px-3.5 py-2 text-[12px] text-muted"
            >
              {SURFACE_LABEL[s]}
            </button>
          ))}
        </div>
      </Sekcja>

      <Sekcja tytul="województwo" kolejnosc={2}>
        <div className="field flex items-center gap-2.5 px-3.5 py-2.5">
          <PinIcon className="h-3.5 w-3.5 shrink-0 text-flame" />
          <select
            value={filters.voivodeship}
            onChange={(e) => patch({ voivodeship: e.target.value })}
            className="w-full bg-transparent text-[13px] outline-none"
          >
            <option value="">wszystkie województwa</option>
            {VOIVODESHIPS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        {/* podświetlenie regionu na mapie robi już samo wybranie - stąd ta podpowiedź */}
        {filters.voivodeship ? (
          <p className="mt-2 px-1 text-[11px] text-faint">
            region świeci na mapie, dopóki nie odsuniesz kamery
          </p>
        ) : null}
      </Sekcja>

      <Sekcja tytul="dostępność" kolejnosc={3}>
        <div className="segmenty flex gap-1 p-1">
          {ACCESS_TABS.map(([k, label]) => (
            <button
              key={k || "all"}
              onClick={() => patch({ access: k })}
              data-on={filters.access === k}
              title={k ? ACCESS_LABEL[k] : "Każda dostępność"}
              className="segment flex-1 px-2 py-2 text-[11px] text-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </Sekcja>

      <Sekcja tytul="oświetlenie" kolejnosc={4}>
        <button
          onClick={() => patch({ onlyLit: !filters.onlyLit })}
          className="wiersz-filtra flex w-full items-center gap-3 px-1.5 py-2 text-left"
        >
          <BulbIcon className="h-4 w-4 shrink-0 text-flame" />
          <span className="flex-1 text-[14px]">Tylko oświetlone</span>
          <span className="switch" data-on={filters.onlyLit} />
        </button>
      </Sekcja>

      {/*
        Suwak podpaleń pokazujemy tylko wtedy, gdy jest co filtrować, i w zakresie wyliczonym
        z danych. Przy sztywnym maksimum 400 wystarczyło go ruszyć, żeby zniknęły wszystkie
        boiska - bo tylu podpaleń nie ma jeszcze żadne.

        Uchwyt chodzi płynnie, choć filtr działa na liczbach całkowitych. Krok równy jedności
        przy maksimum dwa dawał trzy pozycje i uchwyt przeskakiwał przez pół paska; teraz
        sunie setnymi, a próg odczytujemy w górę. Liczba w nagłówku pokazuje próg, który
        naprawdę obowiązuje, więc nic się nie rozjeżdża.
      */}
      {maksLajki > 0 && (
        <Sekcja
          tytul="podpalenia"
          kolejnosc={5}
          prawo={
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-glow">
              <FireBallIcon className="h-3.5 w-3.5" />
              od {Math.ceil(filters.minLikes)}
            </span>
          }
        >
          <input
            type="range"
            min={0}
            max={maksLajki}
            step={maksLajki / 100}
            value={prog}
            onChange={(e) => patch({ minLikes: Number(e.target.value) })}
            /* przebyta część toru świeci - CSS bierze procent z tej zmiennej */
            style={{ "--wypelnienie": `${(prog / maksLajki) * 100}%` } as React.CSSProperties}
            className="suwak-podpalen w-full"
            aria-label="Minimum podpaleń"
          />
          <p className="mt-2 text-[11px] text-faint">
            najwięcej podpaleń ma teraz jedno boisko: {maksLajki}
          </p>
        </Sekcja>
      )}

      {czynne && (
        <div
          className="sekcja-filtra pt-5"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          {/*
            Czyszczenie zostawia wpisaną frazę. Przycisk mówi o filtrach, a szukajka stoi
            osobno, nad panelem - wytarcie razem z nią wyglądałoby na zjedzenie tekstu,
            którego nikt nie kazał ruszać.
          */}
          <button
            onClick={() => patch({ ...DEFAULT_FILTERS, q: filters.q })}
            className="wyczysc-filtry flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[11px] uppercase tracking-[0.16em] text-flame"
          >
            wyczyść filtry
          </button>
        </div>
      )}
    </div>
  );
}
