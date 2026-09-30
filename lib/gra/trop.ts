"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Minigra Trop - rozmowa z bazą.
 *
 * Wszystko, co zna odpowiedź, jest po stronie bazy (patrz `migration-minigra-trop.sql`):
 * przeglądarka dostaje tylko zdjęcia bieżącej rundy, wysyła strzał i w odpowiedzi poznaje
 * miejsce, odległość i punkty. Tu są wyłącznie cienkie opakowania na wywołania RPC.
 */

export interface ZdjecieTropu {
  sciezka: string;
  rodzaj: string;
}

export interface RundaTropu {
  gra: string;
  rund: number;
  runda: number;
  zdjecie: ZdjecieTropu | null;
  ile_zdjec: number;
}

export interface WynikRundy {
  runda: number;
  rund: number;
  punkty: number;
  bazowe: number;
  bonus: boolean;
  /** metry; null, gdy nie postawiono pinezki */
  odleglosc: number | null;
  spoznione: boolean;
  boisko: { nazwa: string; miasto: string; slug: string; lat: number; lng: number };
  suma: number;
  koniec: boolean;
  /** tylko na koniec gry i tylko z kontem */
  rekord: number | null;
  nowy_rekord: boolean;
  pozycja: number | null;
}

export interface WpisTropu {
  nick: string;
  avatar: string | null;
  wynik: number;
  gier: number;
}

async function rpc<T>(nazwa: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Brak połączenia z bazą.");
  const { data, error } = await supabase.rpc(nazwa, args);
  if (error) throw new Error(error.message || "Coś poszło nie tak.");
  return data as T;
}

export const startTropu = () => rpc<RundaTropu>("trop_start");
export const nastepnaRunda = (gra: string) => rpc<RundaTropu>("trop_nastepna", { p_gra: gra });
export const wiecejZdjec = (gra: string) => rpc<ZdjecieTropu[]>("trop_zdjecia", { p_gra: gra });
export const zgadnij = (gra: string, punkt: { lat: number; lng: number } | null) =>
  rpc<WynikRundy>("trop_zgadnij", { p_gra: gra, p_lat: punkt?.lat ?? null, p_lng: punkt?.lng ?? null });
export const rankingTropu = (ile = 20) => rpc<WpisTropu[]>("trop_ranking", { p_ile: ile });

/** „340 m", „1,2 km", „57 km" */
export function opisOdleglosci(m: number | null): string {
  if (m === null) return "bez strzału";
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 1000)} km`;
}
