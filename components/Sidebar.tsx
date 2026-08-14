"use client";

import { useState } from "react";
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

  const patch = (p: Partial<Filters>) => setFilters({ ...filters, ...p });

  const toggleSurface = (s: Surface) =>
    patch({
      surfaces: filters.surfaces.includes(s)
        ? filters.surfaces.filter((x) => x !== s)
        : [...filters.surfaces, s],
    });

  return (
    <aside className="glass-dim pointer-events-auto absolute left-5 top-5 bottom-5 z-30 flex w-[386px] flex-col overflow-hidden rounded-[28px]">
      <div className="px-6 pb-4 pt-6">
        <Brand />
      </div>

      {/* Szukajka */}
      <div className="px-5">
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

      <div className="scroll-thin mt-4 flex-1 overflow-y-auto px-5 pb-5">
        {/* Typ boiska */}
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
                  {TYPE_LABEL[t]}{" "}
                  <span className="text-faint">[{counts[t]}]</span>
                </span>
                <span className="switch" data-on={filters.types[t]} />
              </button>
            );
          })}
        </div>

        {/* Nawierzchnia */}
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

        {/* Pozostałe filtry */}
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

        {/* Wyniki */}
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
      </div>
    </aside>
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
        <span className="block truncate text-[13px] font-semibold uppercase tracking-wide">
          {index}. {court.name}
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
