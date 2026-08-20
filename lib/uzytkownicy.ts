"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { supabaseEnabled } from "./supabase/config";

/**
 * Konta użytkowników w panelu administratora.
 *
 * Lista idzie funkcją `lista_uzytkownikow()`, bo adresy e-mail siedzą w schemacie `auth`,
 * do którego Data API nie zagląda; funkcja sama sprawdza, czy pyta administrator.
 * Blokada to dwie kolumny w `profiles` - polityka i wyzwalacz pilnują, żeby ustawił je
 * tylko administrator, a wszystkie zapisy zablokowanego konta odrzuca już baza.
 */
export interface Uzytkownik {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  banned_at: string | null;
  banned_reason: string | null;
  created_at: string;
  courts: number;
  likes: number;
}

const BLAD_BAZY = "Lista kont wymaga podpiętej bazy.";

async function pobierzLista(): Promise<{ items: Uzytkownik[]; error: string | null }> {
  if (!supabaseEnabled) return { items: [], error: BLAD_BAZY };

  const supabase = await supabaseBrowser();
  if (!supabase) return { items: [], error: BLAD_BAZY };

  const [konta, boiska] = await Promise.all([
    supabase.rpc("lista_uzytkownikow"),
    supabase.from("courts").select("added_by, added_by_name, likes_count"),
  ]);

  if (konta.error) return { items: [], error: konta.error.message };

  /*
    Boiska dopisane ręcznie z panelu mają w bazie tylko podpis autora, bez identyfikatora
    konta - a to wciąż te same wpisy tej samej osoby. Liczymy więc oba przypadki, tak samo
    jak robi to strona „Moje konto" i publiczny profil odkrywcy.
  */
  const wiersze = (boiska.data ?? []) as {
    added_by: string | null;
    added_by_name: string | null;
    likes_count: number;
  }[];

  const items = ((konta.data ?? []) as Uzytkownik[]).map((u) => {
    const moje = wiersze.filter(
      (c) => c.added_by === u.id || (u.display_name && c.added_by_name === u.display_name)
    );
    return {
      ...u,
      courts: moje.length,
      likes: moje.reduce((suma, c) => suma + (c.likes_count ?? 0), 0),
    };
  });

  return { items, error: null };
}

export function useUzytkownicy() {
  const [items, setItems] = useState<Uzytkownik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const wynik = await pobierzLista();
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
    const wynik = await pobierzLista();
    setItems(wynik.items);
    setError(wynik.error);
  }, []);

  /** Blokuje konto. Zwraca komunikat błędu albo null. */
  const zablokuj = useCallback(async (id: string, powod: string): Promise<string | null> => {
    const supabase = await supabaseBrowser();
    if (!supabase) return BLAD_BAZY;

    const { error: blad } = await supabase
      .from("profiles")
      .update({ banned_at: new Date().toISOString(), banned_reason: powod.trim() || null })
      .eq("id", id);

    if (blad) return blad.message;

    setItems((lista) =>
      lista.map((u) =>
        u.id === id
          ? { ...u, banned_at: new Date().toISOString(), banned_reason: powod.trim() || null }
          : u
      )
    );
    return null;
  }, []);

  const odblokuj = useCallback(async (id: string): Promise<string | null> => {
    const supabase = await supabaseBrowser();
    if (!supabase) return BLAD_BAZY;

    const { error: blad } = await supabase
      .from("profiles")
      .update({ banned_at: null, banned_reason: null })
      .eq("id", id);

    if (blad) return blad.message;

    setItems((lista) =>
      lista.map((u) => (u.id === id ? { ...u, banned_at: null, banned_reason: null } : u))
    );
    return null;
  }, []);

  return { items, loading, error, zablokuj, odblokuj, odswiez };
}

/* ------------------------------------------------------------------ */
/*  Zablokowane nicki                                                  */
/* ------------------------------------------------------------------ */

export interface ZablokowaneSlowo {
  word: string;
}

async function pobierzSlowa(): Promise<ZablokowaneSlowo[]> {
  const supabase = await supabaseBrowser();
  if (!supabase) return [];

  const { data } = await supabase.from("blocked_nicks").select("word").order("word");
  return (data ?? []) as ZablokowaneSlowo[];
}

export function useZablokowaneNicki() {
  const [items, setItems] = useState<ZablokowaneSlowo[]>([]);

  useEffect(() => {
    let aktualne = true;
    void (async () => {
      const lista = await pobierzSlowa();
      if (aktualne) setItems(lista);
    })();
    return () => {
      aktualne = false;
    };
  }, []);

  const dodaj = useCallback(async (slowo: string): Promise<string | null> => {
    const czyste = slowo.trim().toLowerCase();
    if (czyste.length < 2) return "Słowo musi mieć co najmniej 2 znaki.";

    const supabase = await supabaseBrowser();
    if (!supabase) return BLAD_BAZY;

    const { error } = await supabase.from("blocked_nicks").insert({ word: czyste });
    if (error) {
      return /duplicate key/i.test(error.message) ? "To słowo już jest na liście." : error.message;
    }

    setItems((lista) => [...lista, { word: czyste }].sort((a, b) => a.word.localeCompare(b.word)));
    return null;
  }, []);

  const usun = useCallback(async (slowo: string) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    await supabase.from("blocked_nicks").delete().eq("word", slowo);
    setItems((lista) => lista.filter((s) => s.word !== slowo));
  }, []);

  return { items, dodaj, usun };
}
