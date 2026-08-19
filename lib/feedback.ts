"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { supabaseEnabled } from "./supabase/config";

export interface FeedbackRow {
  id: string;
  message: string;
  contact: string;
  status: "open" | "done";
  created_at: string;
  author_id: string | null;
}

/** Zapisuje opinię. Limit (1 na dobę z jednego IP) pilnuje wyzwalacz w bazie. */
export async function sendFeedback(message: string, contact: string) {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Wysyłanie opinii wymaga podpiętej bazy.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("feedback").insert({
    message: message.trim(),
    contact: contact.trim(),
    author_id: user?.id ?? null,
  });

  if (error) {
    if (/raz na dobę/.test(error.message)) {
      throw new Error("Opinię można wysłać raz na dobę - Twoją poprzednią już mamy. Dzięki!");
    }
    throw new Error(error.message);
  }

  // powiadomienie mailowe jest opcjonalne: bez klucza w środowisku po prostu go nie ma
  void fetch("/api/opinia-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message.trim(), contact: contact.trim() }),
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Widok administratora                                               */
/* ------------------------------------------------------------------ */

export function useFeedback() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;
    const res = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    setError(res.error ? res.error.message : null);
    setItems((res.data ?? []) as FeedbackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase || !alive) return;
      const res = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (!alive) return;
      setError(res.error ? res.error.message : null);
      setItems((res.data ?? []) as FeedbackRow[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const setStatus = useCallback(
    async (id: string, status: "open" | "done") => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { error: err } = await supabase
        .from("feedback")
        .update({ status, handled_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", id);
      if (err) setError(err.message);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { error: err } = await supabase.from("feedback").delete().eq("id", id);
      if (err) setError(err.message);
      await reload();
    },
    [reload]
  );

  return { items, loading, error, reload, setStatus, remove };
}
