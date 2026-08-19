"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ACCESS_LABEL,
  Access,
  Court,
  CourtType,
  SURFACE_LABEL,
  Surface,
  TYPE_LABEL,
  VOIVODESHIPS,
} from "@/lib/types";
import { Filters } from "@/lib/filters";
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
  results,
  counts,
  activeId,
  onHover,
  onSelect,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  results: Court[];
  counts: Record<CourtType, number>;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (c: Court) => void;
}) {
  const [openSurface, setOpenSurface] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  /** Na telefonie panel startuje zwinięty, żeby mapa miała cały ekran. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Na komputerze lista filtrów jest schowana pod napisem „filtry”. */
  const [panelOpen, setPanelOpen] = useState(false);

  /*
    Gest na telefonie: przeciągnięcie w górę wyciąga arkusz, w dół go schowa.
    Zamykamy tylko wtedy, gdy lista jest przewinięta na samą górę - inaczej
    zwykłe przewijanie wyników zamykałoby panel.
  */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const swipe = useRef<{ y: number; x: number; atTop: boolean } | null>(null);

  const onSheetTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipe.current = {
      y: t.clientY,
      x: t.clientX,
      atTop: (scrollRef.current?.scrollTop ?? 0) <= 2,
    };
  };

  const onSheetTouchEnd = (e: React.TouchEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dy = start.y - t.clientY;
    // ruch bardziej poziomy niż pionowy to nie jest ten gest
    if (Math.abs(dy) < 44 || Math.abs(t.clientX - start.x) > Math.abs(dy)) return;
    if (dy > 0) setSheetOpen(true);
    else if (start.atTop) setSheetOpen(false);
  };

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

          <Link
            href="/losowe"
            prefetch={false}
            className="glass-dim flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-flame"
            title="Wskocz na kartę losowego boiska"
          >
            <DiceIcon className="h-4 w-4" />
            losowe boisko
          </Link>
        </div>

        {panelOpen && (
          <div className="glass-dim pointer-events-auto min-h-0 flex-1 overflow-hidden rounded-[26px]">
            <div className="scroll-thin h-full overflow-y-auto px-5 py-5">
              <FiltersAndList
                filters={filters}
                patch={patch}
                toggleSurface={toggleSurface}
                counts={counts}
                results={results}
                activeId={activeId}
                onHover={onHover}
                onSelect={onSelect}
                openSurface={openSurface}
                setOpenSurface={setOpenSurface}
                openMore={openMore}
                setOpenMore={setOpenMore}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------- telefon: arkusz wysuwany od dołu ---------- */}
      <aside
        onTouchStart={onSheetTouchStart}
        onTouchEnd={onSheetTouchEnd}
        className={`glass-dim pointer-events-auto z-30 flex flex-col overflow-hidden
          fixed inset-x-0 bottom-0 rounded-t-[26px] transition-[top] duration-300 ease-out md:hidden
          ${sheetOpen ? "top-[68px]" : "top-auto"}`}
      >
        <button
          onClick={() => setSheetOpen((v) => !v)}
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
                filtry i lista
                <ChevronIcon className="h-4 w-4 rotate-180" />
              </span>
            </button>
            <Link
              href="/losowe"
              prefetch={false}
              className="flex shrink-0 items-center gap-2 rounded-full border border-hairline bg-white/5 px-3.5 py-2 text-[11px] uppercase tracking-[0.14em] text-muted"
            >
              <DiceIcon className="h-4 w-4" />
              losowe
            </Link>
          </div>
        )}

        <div
          ref={scrollRef}
          className={`scroll-thin mt-2 flex-1 overflow-y-auto px-4 pb-5 ${
            sheetOpen ? "block" : "hidden"
          }`}
        >
          <FiltersAndList
            filters={filters}
            patch={patch}
            toggleSurface={toggleSurface}
            counts={counts}
            results={results}
            activeId={activeId}
            onHover={onHover}
            onSelect={onSelect}
            openSurface={openSurface}
            setOpenSurface={setOpenSurface}
            openMore={openMore}
            setOpenMore={setOpenMore}
          />
        </div>
      </aside>
    </>
  );
}

function CourtCard({
  court,
  index,
  active,
  onHover,
  onSelect,
}: {
  court: Court;
  index: number;
  active: boolean;
  onHover: (id: string | null) => void;
  onSelect: (c: Court) => void;
}) {
  const Icon = TYPE_ICON[court.type];
  return (
    <button
      onMouseEnter={() => onHover(court.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(court)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
        active
          ? "border-flame/50 bg-gradient-to-r from-flame/18 to-transparent"
          : "border-hairline bg-white/4 hover:bg-white/7"
      }`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-hairline bg-black/30 text-flame">
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold uppercase tracking-wide">
            {index}. {court.name}
          </span>
          {court.funny && (
            <span
              title="Dziwne boisko"
              className="h-2 w-2 shrink-0 rounded-full lime-gradient"
            />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
          <PinIcon className="h-3.5 w-3.5" /> {court.city}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
          <BallIcon className="h-3.5 w-3.5" /> {TYPE_LABEL[court.type]}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 self-end text-[12px] font-semibold text-glow">
        <FireBallIcon className="h-3.5 w-3.5" />
        {court.likes}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-medium lowercase tracking-wide text-ink/90">{children}</h2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center text-[11px] uppercase tracking-[0.14em] text-faint">
      {children}
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <button onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className="flex-1 text-[14px]">{title}</span>
        {badge ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full flame-gradient px-1.5 text-[11px] font-bold text-black">
            {badge}
          </span>
        ) : null}
        <ChevronIcon
          className={`h-4 w-4 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Filtry i lista wyników - ta sama treść na komputerze i w arkuszu na telefonie. */
function FiltersAndList({
  filters,
  patch,
  toggleSurface,
  counts,
  results,
  activeId,
  onHover,
  onSelect,
  openSurface,
  setOpenSurface,
  openMore,
  setOpenMore,
}: {
  filters: Filters;
  patch: (p: Partial<Filters>) => void;
  toggleSurface: (s: Surface) => void;
  counts: Record<CourtType, number>;
  results: Court[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (c: Court) => void;
  openSurface: boolean;
  setOpenSurface: (fn: (v: boolean) => boolean) => void;
  openMore: boolean;
  setOpenMore: (fn: (v: boolean) => boolean) => void;
}) {
  return (
    <>
      <SectionLabel>typ boiska</SectionLabel>
      <div className="space-y-2">
        {(Object.keys(TYPE_LABEL) as CourtType[]).map((t) => {
          const Icon = TYPE_ICON[t];
          return (
            <button
              key={t}
              onClick={() => patch({ types: { ...filters.types, [t]: !filters.types[t] } })}
              className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-1 py-1.5 text-left transition hover:border-hairline hover:bg-white/4"
            >
              <Icon className="h-4 w-4 text-flame" />
              <span className="flex-1 text-[14px]">
                {TYPE_LABEL[t]} <span className="text-faint">[{counts[t]}]</span>
              </span>
              <span className="switch" data-on={filters.types[t]} />
            </button>
          );
        })}
      </div>

      <Collapsible
        title="Nawierzchnia"
        open={openSurface}
        onToggle={() => setOpenSurface((v) => !v)}
        badge={filters.surfaces.length || undefined}
      >
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => {
            const on = filters.surfaces.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSurface(s)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                  on
                    ? "border-transparent flame-gradient font-semibold text-black"
                    : "border-hairline bg-white/5 text-muted hover:text-ink"
                }`}
              >
                {SURFACE_LABEL[s]}
              </button>
            );
          })}
        </div>
      </Collapsible>

      <Collapsible
        title="Więcej filtrów"
        open={openMore}
        onToggle={() => setOpenMore((v) => !v)}
        badge={
          (filters.voivodeship ? 1 : 0) +
            (filters.minLikes > 0 ? 1 : 0) +
            (filters.access ? 1 : 0) +
            (filters.onlyLit ? 1 : 0) || undefined
        }
      >
        <div className="space-y-4 pt-1">
          <div>
            <FieldLabel>Województwo</FieldLabel>
            <div className="field px-3 py-2">
              <select
                value={filters.voivodeship}
                onChange={(e) => patch({ voivodeship: e.target.value })}
                className="w-full bg-transparent text-[13px] outline-none"
              >
                <option value="">wszystkie</option>
                {VOIVODESHIPS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>
              Minimum lajków
              <span className="ml-auto flex items-center gap-1 font-semibold text-ink">
                <FireBallIcon className="h-3.5 w-3.5" />
                {filters.minLikes}
              </span>
            </FieldLabel>
            <input
              type="range"
              min={0}
              max={400}
              step={10}
              value={filters.minLikes}
              onChange={(e) => patch({ minLikes: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <FieldLabel>Dostępność</FieldLabel>
            <div className="flex gap-1 rounded-2xl border border-hairline bg-white/5 p-1">
              {ACCESS_TABS.map(([k, label]) => (
                <button
                  key={k || "all"}
                  onClick={() => patch({ access: k })}
                  title={k ? ACCESS_LABEL[k] : "Każda dostępność"}
                  className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] transition ${
                    filters.access === k
                      ? "bg-white/12 font-semibold text-ink shadow"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => patch({ onlyLit: !filters.onlyLit })}
            className="flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-left"
          >
            <BulbIcon className="h-4 w-4 text-flame" />
            <span className="flex-1 text-[14px]">Tylko oświetlone</span>
            <span className="switch" data-on={filters.onlyLit} />
          </button>
        </div>
      </Collapsible>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-faint">
          {results.length} {results.length === 1 ? "boisko" : "boisk"}
        </span>
        <Link href="/ranking" className="text-[11px] uppercase tracking-[0.14em] text-flame hover:text-glow">
          ranking →
        </Link>
      </div>

      <div className="space-y-2.5">
        {results.map((c, i) => (
          <CourtCard
            key={c.id}
            court={c}
            index={i + 1}
            active={c.id === activeId}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
        {!results.length && (
          <p className="rounded-2xl border border-hairline bg-white/4 px-4 py-6 text-center text-[13px] text-muted">
            Brak boisk dla tych filtrów.
          </p>
        )}
      </div>
    </>
  );
}
