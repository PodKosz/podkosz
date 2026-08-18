"use client";

import { useCallback, useEffect, useState } from "react";
import { PhotoKind } from "./types";
import { slugify } from "./slug";
import { photoUrl, supabaseEnabled } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";
import type { SubmissionRow } from "./supabase/types";
import {
  Submission,
  SubmissionStatus,
  addSubmission,
  loadSubmissions,
  newId,
  removeSubmission,
  saveSubmissions,
  updateSubmission,
  useSubmissions,
} from "./submissions";

/* ------------------------------------------------------------------ */
/*  Wysyłka zgłoszenia z kreatora                                      */
/* ------------------------------------------------------------------ */

export interface NewSubmission {
  photos: { kind: PhotoKind; dataUrl: string }[];
  lat: number;
  lng: number;
  accuracy?: number;
  name: string;
  city: string;
  voivodeship: string;
  type: Submission["type"];
  surface: Submission["surface"];
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Submission["access"];
  hours: string;
  notes: string;
  author: { mode: "guest" | "account"; name?: string; email?: string };
}

async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}

export async function submitCourt(input: NewSubmission): Promise<void> {
  const supabase = supabaseBrowser();

  if (!supabase) {
    addSubmission({
      id: newId(),
      createdAt: new Date().toISOString(),
      status: "pending",
      author: input.author,
      photos: input.photos.map((p) => ({ kind: p.kind, url: p.dataUrl })),
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy,
      name: input.name,
      city: input.city,
      voivodeship: input.voivodeship,
      type: input.type,
      surface: input.surface,
      hoops: input.hoops,
      lit: input.lit,
      fenced: input.fenced,
      access: input.access,
      hours: input.hours,
      notes: input.notes,
    });
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ID nadajemy z góry: gość nie ma prawa odczytać własnego wiersza po INSERT.
  const id = crypto.randomUUID();

  const { error } = await supabase.from("submissions").insert({
    id,
    status: "pending",
    author_id: user?.id ?? null,
    author_name: user ? undefined : input.author.name || null,
    author_email: user?.email ?? input.author.email ?? null,
    name: input.name,
    city: input.city,
    voivodeship: input.voivodeship,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    type: input.type,
    surface: input.surface,
    hoops: input.hoops,
    lit: input.lit,
    fenced: input.fenced,
    access: input.access,
    hours: input.hours,
    notes: input.notes,
  });
  if (error) {
    if (/limit zg/i.test(error.message)) {
      throw new Error(
        "Z tego urządzenia wysłano dziś już kilka boisk. Kolejne przyjmiemy jutro — " +
          "a jeśli masz ich więcej, napisz do nas przez „O nas”."
      );
    }
    throw new Error(`Nie udało się zapisać zgłoszenia: ${error.message}`);
  }

  const rows: { submission_id: string; kind: PhotoKind; storage_path: string; sort: number }[] = [];
  for (const [i, photo] of input.photos.entries()) {
    const path = `zgloszenia/${id}/${i + 1}-${slugify(photo.kind)}.jpg`;
    const blob = await dataUrlToBlob(photo.dataUrl);
    const up = await supabase.storage
      .from("court-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(`Nie udało się wgrać zdjęcia: ${up.error.message}`);
    rows.push({ submission_id: id, kind: photo.kind, storage_path: path, sort: i });
  }

  if (rows.length) {
    const { error: photoError } = await supabase.from("submission_photos").insert(rows);
    if (photoError) throw new Error(`Zdjęcia nie zostały podpięte: ${photoError.message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Kolejka moderacji                                                  */
/* ------------------------------------------------------------------ */

/**
 * Kasuje pliki z bucketa, ale pomija te, na które wskazuje już opublikowane boisko —
 * zgłoszenie i karta boiska współdzielą te same ścieżki po akceptacji.
 */
async function removeUnusedFiles(
  supabase: NonNullable<ReturnType<typeof supabaseBrowser>>,
  paths: string[]
) {
  if (!paths.length) return;

  const { data: used } = await supabase
    .from("court_photos")
    .select("storage_path")
    .in("storage_path", paths);

  const inUse = new Set(((used ?? []) as { storage_path: string }[]).map((r) => r.storage_path));
  const orphans = paths.filter((p) => !inUse.has(p));
  if (orphans.length) await supabase.storage.from("court-photos").remove(orphans);
}

function rowToSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    rejectReason: row.reject_reason ?? undefined,
    basketApproved: row.basket_approved,
    basketNote: row.basket_note ?? '',
    author: {
      mode: row.author_id ? "account" : "guest",
      name: row.author_name ?? undefined,
      email: row.author_email ?? undefined,
    },
    photos: [...(row.submission_photos ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        path: p.storage_path,
        url: photoUrl(p.storage_path),
      })),
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy ?? undefined,
    name: row.name,
    city: row.city,
    voivodeship: row.voivodeship,
    type: row.type,
    surface: row.surface,
    hoops: row.hoops,
    lit: row.lit,
    fenced: row.fenced,
    access: row.access,
    hours: row.hours,
    notes: row.notes,
  };
}

const FIELD_MAP: Record<string, string> = {
  rejectReason: "reject_reason",
  name: "name",
  city: "city",
  voivodeship: "voivodeship",
  lat: "lat",
  lng: "lng",
  type: "type",
  surface: "surface",
  hoops: "hoops",
  lit: "lit",
  fenced: "fenced",
  access: "access",
  hours: "hours",
  notes: "notes",
  basketApproved: "basket_approved",
  basketNote: "basket_note",
  status: "status",
};

export interface Queue {
  list: Submission[];
  loading: boolean;
  error: string | null;
  /** true = dane z Supabase, false = tryb testowy na localStorage */
  live: boolean;
  reload: () => void;
  patch: (id: string, patch: Partial<Submission>) => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removePhoto: (submission: Submission, index: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useQueue(): Queue {
  const local = useSubmissions();
  const [remote, setRemote] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    const res = await supabase
      .from("submissions")
      .select("*, submission_photos(id, kind, storage_path, sort)")
      .order("created_at", { ascending: false });
    setError(res.error ? res.error.message : null);
    setRemote(((res.data ?? []) as SubmissionRow[]).map(rowToSubmission));
    setLoading(false);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchList();
  }, [fetchList]);

  // Pierwsze pobranie kolejki. setState wyłącznie w callbacku obietnicy —
  // synchroniczny setState w ciele efektu jest w tym projekcie błędem lintera.
  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    let alive = true;

    supabase
      .from("submissions")
      .select("*, submission_photos(id, kind, storage_path, sort)")
      .order("created_at", { ascending: false })
      .then((res: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        setError(res.error ? res.error.message : null);
        setRemote(((res.data ?? []) as SubmissionRow[]).map(rowToSubmission));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const patch = useCallback(
    async (id: string, p: Partial<Submission>) => {
      const supabase = supabaseBrowser();
      if (!supabase) {
        updateSubmission(id, p);
        return;
      }
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(p)) {
        const column = FIELD_MAP[key];
        if (column) payload[column] = value;
      }
      if (!Object.keys(payload).length) return;
      const { error: err } = await supabase.from("submissions").update(payload).eq("id", id);
      if (err) setError(err.message);
      setRemote((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)));
    },
    []
  );

  const approve = useCallback(
    async (id: string) => {
      const supabase = supabaseBrowser();
      if (!supabase) {
        updateSubmission(id, { status: "approved" });
        return;
      }
      const { error: err } = await supabase.rpc("approve_submission", { sub_id: id });
      if (err) {
        setError(err.message);
        throw new Error(err.message);
      }
      await fetchList();
    },
    [fetchList]
  );

  const reject = useCallback(
    async (id: string, reason: string) => {
      await patch(id, { status: "rejected" as SubmissionStatus, rejectReason: reason });
    },
    [patch]
  );

  /** Trwałe usunięcie zgłoszenia zabiera ze sobą jego zdjęcia ze Storage. */
  const remove = useCallback(async (id: string) => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      removeSubmission(id);
      return;
    }

    const { data: photos } = await supabase
      .from("submission_photos")
      .select("storage_path")
      .eq("submission_id", id);

    try {
      await removeUnusedFiles(
        supabase,
        ((photos ?? []) as { storage_path: string }[]).map((p) => p.storage_path)
      );
    } catch (e) {
      setError(`Zdjęcia mogły zostać w Storage: ${(e as Error).message}`);
    }

    const { error: err } = await supabase.from("submissions").delete().eq("id", id);
    if (err) setError(err.message);
    setRemote((list) => list.filter((s) => s.id !== id));
  }, []);

  const removePhoto = useCallback(async (submission: Submission, index: number) => {
    const photo = submission.photos[index];
    const supabase = supabaseBrowser();
    if (!supabase) {
      updateSubmission(submission.id, {
        photos: submission.photos.filter((_, i) => i !== index),
      });
      return;
    }
    if (photo.id) await supabase.from("submission_photos").delete().eq("id", photo.id);
    if (photo.path) await removeUnusedFiles(supabase, [photo.path]);
    setRemote((list) =>
      list.map((s) =>
        s.id === submission.id
          ? { ...s, photos: s.photos.filter((_, i) => i !== index) }
          : s
      )
    );
  }, []);

  const clearAll = useCallback(async () => {
    if (!supabaseEnabled) saveSubmissions([]);
  }, []);

  return {
    list: supabaseEnabled ? remote : local,
    loading: supabaseEnabled ? loading : false,
    error,
    live: supabaseEnabled,
    reload,
    patch,
    approve,
    reject,
    remove,
    removePhoto,
    clearAll,
  };
}

/** Zgłoszenia widoczne dla użytkownika bez bazy (tryb testowy). */
export function localQueueSize() {
  return loadSubmissions().length;
}
