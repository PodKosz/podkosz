"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { supabaseEnabled } from "./supabase/config";

/**
 * Lista beta testerów - adresy, które wchodzą na stronę przed premierą.
 *
 * Tabelę widzi wyłącznie administrator (pilnuje tego RLS), więc czytamy ją zwykłym klientem
 * z przeglądarki. Sprawdzenie „czy mnie wpuścić" robi osobna funkcja w bazie (`czy_wpuscic`),
 * żeby tester nie musiał widzieć całej listy.
 */
export interface BetaTester {
  email: string;
  note: string | null;
  created_at: string;
}

const BLAD_BAZY = "Lista beta testerów wymaga podpiętej bazy.";

/** Czysty odczyt - bez dotykania stanu Reacta, żeby dało się go wołać z efektu. */
async function pobierzListe(): Promise<{ items: BetaTester[]; error: string | null }> {
  if (!supabaseEnabled) return { items: [], error: BLAD_BAZY };

  const supabase = await supabaseBrowser();
  if (!supabase) return { items: [], error: BLAD_BAZY };

  const { data, error } = await supabase
    .from("beta_testers")
    .select("email, note, created_at")
    .order("created_at", { ascending: false });

  if (error) return { items: [], error: error.message };
  return { items: (data ?? []) as BetaTester[], error: null };
}

export function useBetaTesterzy() {
  const [items, setItems] = useState<BetaTester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const wynik = await pobierzListe();
      if (!aktualne) return;
      setItems(wynik.items);
      setError(wynik.error);
      setLoading(false);
    })();

    return () => {
      aktualne = false;
    };
  }, []);

  const odswiez = useCallback(async () => {
    const wynik = await pobierzListe();
    setItems(wynik.items);
    setError(wynik.error);
  }, []);

  /** Dodaje adres. Zwraca komunikat błędu albo null, gdy się udało. */
  const dodaj = useCallback(
    async (email: string, note: string): Promise<string | null> => {
      const adres = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adres)) return "To nie wygląda na adres e-mail.";

      const supabase = await supabaseBrowser();
      if (!supabase) return BLAD_BAZY;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: blad } = await supabase
        .from("beta_testers")
        .insert({ email: adres, note: note.trim() || null, added_by: user?.id ?? null });

      if (blad) {
        return /duplicate key/i.test(blad.message)
          ? "Ten adres już jest na liście."
          : blad.message;
      }

      await odswiez();
      return null;
    },
    [odswiez]
  );

  const usun = useCallback(async (email: string) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    await supabase.from("beta_testers").delete().eq("email", email);
    setItems((lista) => lista.filter((b) => b.email !== email));
  }, []);

  return { items, loading, error, dodaj, usun, odswiez };
}
