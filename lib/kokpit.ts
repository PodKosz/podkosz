"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

/**
 * Liczby na stronę tytułową panelu administratora.
 *
 * Wszystko przychodzi jednym wywołaniem `panel_glowny()`. Kilkanaście osobnych zapytań
 * przez PostgREST to kilkanaście podróży po sieci, a kokpit ma być tym, co widać od razu
 * po wejściu - nie czymś, co doładowuje się kafelek po kafelku.
 */
export interface OstatnieBoisko {
  slug: string;
  name: string;
  city: string;
  voivodeship: string;
  autor: string;
  kiedy: string;
  likes: number;
  zdjecie: string | null;
}

export interface OpiniaKokpit {
  id: string;
  message: string;
  ucieta: boolean;
  contact: string;
  status: string;
  created_at: string;
  autor: string;
}

export interface ZgloszenieKokpit {
  id: string;
  name: string;
  city: string;
  created_at: string;
  author_name: string | null;
}

export interface Kokpit {
  kolejka: number;
  kolejka_24h: number;
  bledy: number;
  opinie_nowe: number;
  kandydaci: number;
  boiska: number;
  boiska_heat: number;
  boiska_bez_zdjec: number;
  zdjecia: number;
  podpalenia: number;
  miast: number;
  wojewodztw: number;
  konta: number;
  konta_24h: number;
  zalogowani_24h: number;
  zablokowani: number;
  zapisy_na_otwarcie: number;
  online: number;
  goscie_dzis: number;
  goscie_wczoraj: number;
  odslony_dzis: number;
  checkiny_dzis: number;
  storage_bytes: number;
  db_bytes: number;
  ostatnie_boisko: OstatnieBoisko | null;
  opinie: OpiniaKokpit[];
  ostatnie_zgloszenia: ZgloszenieKokpit[];
}

const BLAD = "Kokpit wymaga podpiętej bazy.";

export function usePanelGlowny() {
  const [dane, setDane] = useState<Kokpit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
    Czysty odczyt: funkcja tylko oddaje wynik, a stan ustawia wywołujący - już po await.
    Synchroniczne ustawienie stanu w ciele efektu wywołuje kaskadę renderów.
  */
  const pobierz = useCallback(async (): Promise<{
    dane: Kokpit | null;
    error: string | null;
  }> => {
    const supabase = await supabaseBrowser();
    if (!supabase) return { dane: null, error: BLAD };

    const { data, error } = await supabase.rpc("panel_glowny");
    if (error) return { dane: null, error: error.message };
    return { dane: data as Kokpit, error: null };
  }, []);

  const odswiez = useCallback(async () => {
    const wynik = await pobierz();
    if (wynik.dane) setDane(wynik.dane);
    setError(wynik.error);
    setLoading(false);
  }, [pobierz]);

  useEffect(() => {
    let aktualne = true;

    const cykl = async () => {
      const wynik = await pobierz();
      if (!aktualne) return;
      if (wynik.dane) setDane(wynik.dane);
      setError(wynik.error);
      setLoading(false);
    };

    void cykl();
    /*
      Odświeżamy co pół minuty. Kokpit zostaje otwarty na drugim monitorze i ma pokazywać
      stan „teraz", a nie sprzed godziny - ale częściej nie ma sensu, bo licznik obecnych
      i tak zmienia się co dwie minuty.
    */
    const zegar = window.setInterval(() => void cykl(), 30_000);
    return () => {
      aktualne = false;
      window.clearInterval(zegar);
    };
  }, [pobierz]);

  return { dane, loading, error, odswiez };
}

