"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Court } from "@/lib/types";
import { toApprovedCourts, useSubmissions } from "@/lib/submissions";
import { supabaseEnabled } from "@/lib/supabase/config";
import { DEFAULT_FILTERS, Filters, applyFilters, countByType } from "@/lib/filters";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";

export function Explorer({ courts }: { courts: Court[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Tryb testowy: boiska zaakceptowane w panelu admina siedzą w localStorage.
  // Po podpięciu bazy wszystko przychodzi już z serwera.
  const submissions = useSubmissions();
  const all = useMemo(
    () => (supabaseEnabled ? courts : [...toApprovedCourts(submissions), ...courts]),
    [submissions, courts]
  );
  const results = useMemo(() => applyFilters(all, filters), [all, filters]);
  const counts = useMemo(() => countByType(all), [all]);

  const onSelect = useCallback(
    (c: Court) => router.push(`/boisko/${c.slug}`),
    [router]
  );

  const onHoverFromList = useCallback((id: string | null) => {
    setActiveId(id);
    if (id) setFocusId(id);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        courts={results}
        activeId={activeId}
        focusId={focusId}
        highlightVoivodeship={filters.voivodeship}
        onHoverCourt={setActiveId}
        onSelectCourt={onSelect}
      />
      <Sidebar
        filters={filters}
        setFilters={setFilters}
        results={results}
        counts={counts}
        activeId={activeId}
        onHover={onHoverFromList}
        onSelect={onSelect}
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 hidden text-center text-[11px] tracking-wide text-faint md:block">
        © 2026 PODKOSZ.PL
      </p>
    </main>
  );
}
