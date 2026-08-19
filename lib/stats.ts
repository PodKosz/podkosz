"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

/** Wszystko, co pokazuje tabelka statystyk. Liczby liczy funkcja admin_overview() w bazie. */
export interface AdminOverview {
  courts: number;
  courts_approved: number;
  courts_funny: number;
  courts_shorts: number;
  photos: number;
  likes: number;
  favorites: number;
  users: number;
  users_recent: number;
  submissions_pending: number;
  submissions_total: number;
  reports_open: number;
  feedback_open: number;
  leads_new: number;
  leads_added: number;
  unique_ips: number;
  unique_ips_30d: number;
  visits_today: number;
  storage_bytes: number;
  storage_files: number;
  db_bytes: number;
}

/** Darmowy plan Supabase: 1 GB w Storage i 500 MB w bazie. */
export const STORAGE_LIMIT = 1024 * 1024 * 1024;
export const DB_LIMIT = 500 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function useAdminOverview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(() => !!supabaseBrowser());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;
    const res = await supabase.rpc("admin_overview");
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData(res.data as AdminOverview);
    }
    setLoading(false);
  }, []);

  // setState leci w callbacku obietnicy - synchroniczny setState w ciele efektu
  // jest w tym projekcie zgłaszany przez lintera.
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { data, loading, error, reload };
}

