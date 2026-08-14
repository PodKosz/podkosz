"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

export type ReportReason =
  | "godziny"
  | "dane"
  | "nawierzchnia"
  | "zdjecia"
  | "nie-istnieje"
  | "inne";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "godziny", label: "Złe godziny dostępności" },
  { value: "dane", label: "Błędne dane (nazwa, miasto, kosze)" },
  { value: "nawierzchnia", label: "Zła nawierzchnia albo typ boiska" },
  { value: "zdjecia", label: "Zdjęcia nie pasują do boiska" },
  { value: "nie-istnieje", label: "Boiska już nie ma / jest zamknięte" },
  { value: "inne", label: "Coś innego" },
];

export const REASON_LABEL: Record<ReportReason, string> = REPORT_REASONS.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {} as Record<ReportReason, string>
);

/** Wysyła zgłoszenie błędu. Działa też dla gościa bez konta. */
export async function sendReport(courtId: string, reason: ReportReason, comment: string) {
  const supabase = supabaseBrowser();
  if (!supabase) throw new Error("Zgłaszanie błędów wymaga podpiętej bazy.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("reports").insert({
    court_id: courtId,
    reason,
    comment: comment.trim(),
    reporter_id: user?.id ?? null,
  });

  if (error) {
    // limit z wyzwalacza w bazie: jedno zgłoszenie na boisko z jednego IP na dobę
    if (/ostatniej doby/.test(error.message)) {
      throw new Error(
        "To boisko zgłosiłeś już w ciągu ostatniej doby. Zajmiemy się poprzednim zgłoszeniem."
      );
    }
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Widok administratora                                               */
/* ------------------------------------------------------------------ */

export interface ReportRow {
  id: string;
  reason: ReportReason;
  comment: string;
  created_at: string;
  status: "open" | "resolved";
  reporter_id: string | null;
}

export interface ReportedCourt {
  courtId: string;
  slug: string;
  name: string;
  city: string;
  openCount: number;
  newest: string;
  reports: ReportRow[];
}

interface RawReport extends ReportRow {
  court_id: string;
  courts: { slug: string; name: string; city: string } | null;
}

export function useReports() {
  const [courts, setCourts] = useState<ReportedCourt[]>([]);
  // bez bazy nie ma czego wczytywać — startujemy od razu w stanie gotowym
  const [loading, setLoading] = useState(() => !!supabaseBrowser());
  const [error, setError] = useState<string | null>(null);

  const group = (rows: RawReport[]): ReportedCourt[] => {
    const map = new Map<string, ReportedCourt>();
    for (const r of rows) {
      const entry = map.get(r.court_id) ?? {
        courtId: r.court_id,
        slug: r.courts?.slug ?? "",
        name: r.courts?.name ?? "(usunięte boisko)",
        city: r.courts?.city ?? "",
        openCount: 0,
        newest: r.created_at,
        reports: [],
      };
      entry.reports.push(r);
      entry.openCount += 1;
      if (r.created_at > entry.newest) entry.newest = r.created_at;
      map.set(r.court_id, entry);
    }
    return [...map.values()];
  };

  const fetchRows = useCallback(async () => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const res = await supabase
      .from("reports")
      .select("*, courts(slug, name, city)")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    setError(res.error ? res.error.message : null);
    setCourts(group((res.data ?? []) as unknown as RawReport[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    let alive = true;
    supabase
      .from("reports")
      .select("*, courts(slug, name, city)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .then((res: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        setError(res.error ? res.error.message : null);
        setCourts(group((res.data ?? []) as RawReport[]));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Zamyka pojedyncze zgłoszenie albo wszystkie dla danego boiska. */
  const resolve = useCallback(
    async (ids: string[]) => {
      const supabase = supabaseBrowser();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: err } = await supabase
        .from("reports")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
        })
        .in("id", ids);
      if (err) setError(err.message);
      await fetchRows();
    },
    [fetchRows]
  );

  return { courts, loading, error, reload: fetchRows, resolve };
}
