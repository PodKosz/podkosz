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

  /**
   * Usuwa konto na dobre - razem z wpisem w auth.users.
   *
   * Blokada zostawia konto na miejscu, więc do przetestowania ścieżki dołączania „na
   * świeżo" się nie nadaje: to samo konto Google wraca z tym samym identyfikatorem i tym
   * samym profilem. Zanim baza skasuje konto, robi jego zdjęcie i trzyma je 180 dni -
   * całą tę robotę wykonuje funkcja `usun_konto`, bo tabela auth jest poza zasięgiem
   * Data API.
   */
  const usun = useCallback(async (id: string): Promise<string | null> => {
    const supabase = await supabaseBrowser();
    if (!supabase) return BLAD_BAZY;

    const { error: blad } = await supabase.rpc("usun_konto", { in_user: id });
    if (blad) return blad.message;

    setItems((lista) => lista.filter((u) => u.id !== id));
    return null;
  }, []);

  return { items, loading, error, zablokuj, odblokuj, usun, odswiez };
}

/* ------------------------------------------------------------------ */
/*  Archiwum usuniętych kont                                           */
/* ------------------------------------------------------------------ */

export interface UsunieteKonto {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  usuniete_at: string;
  wygasa_at: string;
  oczekuje: boolean;
  przywrocone_at: string | null;
  dane: {
    boiska?: { id: string; slug: string; name: string; likes: number }[];
    polubienia?: string[];
    ulubione?: string[];
    checkinow?: number;
    statystyki?: Record<string, unknown> | null;
  };
}

/**
 * Zdjęcia skasowanych kont. Żyją 180 dni, potem znikają bezpowrotnie.
 *
 * Przywracanie nie odtwarza wpisu w auth.users - tamtej tożsamości nie da się uczciwie
 * sfabrykować. Liczy się adres: dane doczepiają się do konta o tym samym mailu, od razu
 * albo przy najbliższym logowaniu.
 */
export function useUsunieteKonta() {
  const [items, setItems] = useState<UsunieteKonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* czysty odczyt - stan ustawiamy dopiero w wywołującym, już po await */
  const pobierz = useCallback(async (): Promise<{
    items: UsunieteKonto[];
    error: string | null;
  }> => {
    const supabase = await supabaseBrowser();
    if (!supabase) return { items: [], error: BLAD_BAZY };

    const { data, error: blad } = await supabase.rpc("lista_usunietych_kont");
    if (blad) return { items: [], error: blad.message };
    return { items: (data ?? []) as UsunieteKonto[], error: null };
  }, []);

  const odswiez = useCallback(async () => {
    const wynik = await pobierz();
    setItems(wynik.items);
    setError(wynik.error);
    setLoading(false);
  }, [pobierz]);

  useEffect(() => {
    let aktualne = true;
    void (async () => {
      const wynik = await pobierz();
      if (!aktualne) return;
      setItems(wynik.items);
      setError(wynik.error);
      setLoading(false);
    })();
    return () => {
      aktualne = false;
    };
  }, [pobierz]);

  /** Zwraca komunikat od bazy (co dokładnie się stało) albo rzuca błędem w polu `blad`. */
  const przywroc = useCallback(
    async (id: string): Promise<{ wiadomosc?: string; blad?: string }> => {
      const supabase = await supabaseBrowser();
      if (!supabase) return { blad: BLAD_BAZY };

      const { data, error: blad } = await supabase.rpc("przywroc_konto", { in_user: id });
      if (blad) return { blad: blad.message };
      await odswiez();
      return { wiadomosc: typeof data === "string" ? data : "Przywrócono." };
    },
    [odswiez]
  );

  return { items, loading, error, przywroc, odswiez };
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

/* ------------------------------------------------------------------ */
/*  Blokady adresów IP                                                 */
/* ------------------------------------------------------------------ */

export interface BanIP {
  ip: string;
  reason: string | null;
  banned_until: string;
  created_at: string;
}

/**
 * Blokady IP działają obok blokad kont: zgłoszenia, opinie i raporty można wysłać bez
 * logowania, więc czasem trzeba odciąć samo źródło. Zablokowany adres nie wchodzi nawet
 * na stronę - odsiewa go middleware, jeszcze przed jakimkolwiek zapisem.
 */
export function useBanyIP() {
  const [items, setItems] = useState<BanIP[]>([]);

  const wczytaj = useCallback(async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    const { data } = await supabase
      .from("ip_bans")
      .select("ip, reason, banned_until, created_at")
      .order("banned_until", { ascending: false });

    setItems((data ?? []) as BanIP[]);
  }, []);

  useEffect(() => {
    let aktualne = true;
    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase || !aktualne) return;

      const { data } = await supabase
        .from("ip_bans")
        .select("ip, reason, banned_until, created_at")
        .order("banned_until", { ascending: false });

      if (aktualne) setItems((data ?? []) as BanIP[]);
    })();
    return () => {
      aktualne = false;
    };
  }, []);

  /** Blokuje adres na podaną liczbę dni. Zwraca komunikat błędu albo null. */
  const zablokuj = useCallback(
    async (ip: string, dni: number, powod: string): Promise<string | null> => {
      const adres = ip.trim();
      /* prosty sanity check - IPv4 albo IPv6 w zapisie z dwukropkami */
      if (!/^[0-9.]{7,15}$/.test(adres) && !/^[0-9a-fA-F:]{3,45}$/.test(adres)) {
        return "To nie wygląda na adres IP.";
      }
      if (!Number.isFinite(dni) || dni < 1 || dni > 3650) {
        return "Liczba dni musi być z przedziału 1-3650.";
      }

      const supabase = await supabaseBrowser();
      if (!supabase) return BLAD_BAZY;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const doKiedy = new Date(Date.now() + dni * 24 * 3600 * 1000).toISOString();

      const { error } = await supabase.from("ip_bans").upsert({
        ip: adres,
        reason: powod.trim() || null,
        banned_until: doKiedy,
        created_by: user?.id ?? null,
      });

      if (error) return error.message;

      await wczytaj();
      return null;
    },
    [wczytaj]
  );

  const usun = useCallback(async (ip: string) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    await supabase.from("ip_bans").delete().eq("ip", ip);
    setItems((lista) => lista.filter((b) => b.ip !== ip));
  }, []);

  return { items, zablokuj, usun, odswiez: wczytaj };
}
