"use client";

import { useSyncExternalStore } from "react";
import { Access, Court, CourtType, PHOTO_KIND_LABEL, PhotoKind, Surface } from "./types";
import { slugify } from "./slug";
import { orderPhotos } from "./photos";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface SubmissionPhoto {
  kind: PhotoKind;
  /** dataURL z aparatu (tryb testowy) albo publiczny adres ze Storage */
  url: string;
  /** ścieżka w buckecie - potrzebna do usunięcia pliku */
  path?: string;
  /** identyfikator wiersza w submission_photos */
  id?: string;
}

export interface Submission {
  id: string;
  createdAt: string;
  status: SubmissionStatus;
  rejectReason?: string;
  /** rekomendacja twórcy nadana przy akceptacji */
  basketApproved?: boolean;
  /** 2-3 zdania od twórcy, trafiają na kartę boiska */
  basketNote?: string;
  author: { mode: "guest" | "account"; name?: string; email?: string };
  photos: SubmissionPhoto[];
  lat: number;
  lng: number;
  accuracy?: number;
  /** odległość pinezki od odczytu GPS w metrach - ślad obecności, patrz lib/obecnosc.ts */
  gpsOdleglosc?: number;
  name: string;
  city: string;
  voivodeship: string;
  type: CourtType;
  surface: Surface;
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Access;
  hours: string;
  notes: string;
}

const KEY = "pkm.submissions";
const EMPTY: Submission[] = [];

export const REJECT_REASONS = [
  "Zdjęcia zbyt słabej jakości (rozmyte / ciemne)",
  "Kadry niezgodne z instrukcją",
  "To nie jest boisko do koszykówki",
  "Boisko już jest w bazie",
  "Nieodpowiednie treści na zdjęciach",
  "Lokalizacja nie zgadza się ze zdjęciami",
] as const;

/* ---------- prosty store na localStorage (do czasu podpięcia bazy) ---------- */

let rawCache: string | null = null;
let parsedCache: Submission[] = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Zwraca stabilną referencję, dopóki zawartość localStorage się nie zmieni. */
export function loadSubmissions(): Submission[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY) ?? "[]";
  if (raw !== rawCache) {
    rawCache = raw;
    try {
      parsedCache = JSON.parse(raw) as Submission[];
    } catch {
      parsedCache = EMPTY;
    }
  }
  return parsedCache;
}

export function saveSubmissions(list: Submission[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  emit();
}

export function addSubmission(s: Submission) {
  saveSubmissions([s, ...loadSubmissions()]);
}

export function updateSubmission(id: string, patch: Partial<Submission>) {
  saveSubmissions(loadSubmissions().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function removeSubmission(id: string) {
  saveSubmissions(loadSubmissions().filter((s) => s.id !== id));
}

/** Hook z synchronizacją - bez setState w efekcie, bezpieczny przy SSR. */
export function useSubmissions(): Submission[] {
  return useSyncExternalStore(subscribe, loadSubmissions, () => EMPTY);
}

/** true dopiero po hydracji - zapobiega mignięciu treści zależnej od localStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export function newId() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- mapowanie na model boiska ---------- */

export function submissionToCourt(s: Submission): Court {
  return {
    id: s.id,
    slug: `${slugify(s.city)}-${slugify(s.name)}`,
    name: s.name,
    city: s.city,
    voivodeship: s.voivodeship,
    lat: s.lat,
    lng: s.lng,
    type: s.type,
    surface: s.surface,
    hoops: s.hoops,
    lit: s.lit,
    fenced: s.fenced,
    access: s.access,
    hours: s.hours,
    likes: 0,
    basketApproved: !!s.basketApproved,
    basketNote: s.basketNote ?? "",
    addedBy: s.author.name || (s.author.mode === "guest" ? "gość" : "użytkownik"),
    addedAt: s.createdAt.slice(0, 10),
    description: s.notes || "Boisko dodane przez społeczność.",
    photos: orderPhotos(s.photos).map((p) => ({
      kind: p.kind,
      url: p.url,
      caption: PHOTO_KIND_LABEL[p.kind] ?? p.kind,
    })),
    seed: Math.abs([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 97,
  };
}

/** Boiska zatwierdzone lokalnie (do czasu podpięcia bazy). */
export function toApprovedCourts(list: Submission[]): Court[] {
  return list.filter((s) => s.status === "approved").map(submissionToCourt);
}
