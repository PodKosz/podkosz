"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { photoUrl } from "./supabase/config";
import { usunZdjecia, wgrajZdjecie } from "./zdjecia";
import { slugify } from "./slug";
import { PHOTO_KIND_LABEL, type PhotoKind } from "./types";

/**
 * Poprawki zdjęć: ktoś inny przynosi ładniejszy kadr do cudzego boiska.
 *
 * ------------------------------------------------------------------ po co
 *
 * Boisko dodane w styczniu ma styczniowe zdjęcia: szaro, mokro, liście w kałuży. W maju
 * to samo boisko wygląda inaczej i lepiej, tylko autor wpisu nie wraca tam z aparatem po
 * pół roku. Do tej pory jedyną osobą, która mogła to zmienić, był administrator.
 *
 * Boisko ZOSTAJE przypisane osobie, która je zgłosiła - to się nie zmienia i nie ma się
 * zmieniać. Zmienia się jedno zdjęcie, a nie autorstwo wpisu. Kto przyniósł który kadr,
 * zapisuje `court_photos.author_id`.
 *
 * ------------------------------------------------------------------ dlaczego wiersz powstaje przed plikiem
 *
 * Kolejność wygląda na odwróconą i jest odwrócona celowo. Przy zgłoszeniu boiska najpierw
 * lecą pliki, bo katalog otwiera samo zgłoszenie. Tutaj Worker pyta bazy `poprawka_otwarta`
 * ZANIM cokolwiek zapisze (patrz `worker/zdjecia.js`) - a żeby miała o czym odpowiadać,
 * wiersz musi już stać. Stąd identyfikator robimy sami (`crypto.randomUUID`), a nie
 * bierzemy go z bazy: ścieżka pliku zawiera ten identyfikator, więc musi być znana
 * w chwili zapisu wiersza.
 *
 * Cena tej kolejności: gdy wgrywanie padnie, zostaje wiersz bez pliku. Dlatego po
 * nieudanej wysyłce kasujemy go z powrotem - `photo_swaps_delete_wlasne` na to pozwala.
 */

/* ------------------------------------------------------------------ */
/*  Strona zgłaszającego                                               */
/* ------------------------------------------------------------------ */

export interface NowaPoprawka {
  courtId: string;
  kind: PhotoKind;
  /** kadr prosto z aparatu, jako `data:` - zamieniamy na plik dopiero przy wysyłce */
  dataUrl: string;
  /** ile metrów od boiska stał telefon; do oceny w panelu, nie do blokowania */
  odlegloscM: number;
}

/**
 * Zakłada poprawkę i wgrywa do niej zdjęcie.
 *
 * Rzuca błędem z gotowym zdaniem po polsku - wyzwalacze w bazie piszą swoje komunikaty
 * same (limit dobowy, druga poprawka tego samego kadru), więc nie tłumaczymy ich tutaj
 * drugi raz. Wołający pokazuje to, co dostanie.
 */
export async function zlozPoprawke({ courtId, kind, dataUrl, odlegloscM }: NowaPoprawka) {
  const supabase = await supabaseBrowser();
  if (!supabase) throw new Error("Poprawki zdjęć wymagają podpiętej bazy.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Poprawkę zdjęcia może wysłać tylko osoba z kontem.");

  const id = crypto.randomUUID();
  const sciezka = `poprawki/${id}/${slugify(kind)}.jpg`;

  const { error } = await supabase.from("photo_swaps").insert({
    id,
    court_id: courtId,
    kind,
    storage_path: sciezka,
    author_id: user.id,
    gps_odleglosc_m: Math.round(odlegloscM),
  });
  if (error) throw new Error(error.message);

  try {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    await wgrajZdjecie(sciezka, blob);
  } catch (e) {
    /* wiersz bez pliku jest gorszy niż brak wiersza - patrz nota na górze */
    await supabase.from("photo_swaps").delete().eq("id", id);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/*  Widok administratora                                               */
/* ------------------------------------------------------------------ */

export interface Poprawka {
  id: string;
  courtId: string;
  slug: string;
  nazwa: string;
  miasto: string;
  kind: PhotoKind;
  /** nazwa kadru, ta sama co w galerii */
  kadr: string;
  /** zdjęcie B - proponowane */
  nowe: string;
  /** ścieżka zdjęcia B w kubełku - do skasowania przy odrzuceniu */
  sciezkaNowego: string;
  /** zdjęcie A - to, które wisi teraz. `null`, gdy tego kadru jeszcze nie było. */
  obecne: string | null;
  autor: string;
  autorSlug: string | null;
  gpsM: number | null;
  kiedy: string;
}

interface SurowaPoprawka {
  id: string;
  court_id: string;
  kind: PhotoKind;
  storage_path: string;
  gps_odleglosc_m: number | null;
  created_at: string;
  courts: { slug: string; name: string; city: string } | null;
  profiles: { display_name: string | null; slug: string | null } | null;
}

/**
 * Otwarte poprawki razem ze zdjęciem, które mają zastąpić.
 *
 * Zdjęcie A idzie OSOBNYM zapytaniem, a nie zagnieżdżeniem. PostgREST potrafi dociągnąć
 * `court_photos` przy boisku, ale nie umie ograniczyć takiego zagnieżdżenia do jednego
 * kadru - wróciłaby cała galeria każdego boiska, czyli kilkanaście razy więcej danych po
 * to, żeby wybrać z niej jeden wiersz w przeglądarce. Jedno dodatkowe zapytanie po
 * identyfikatorach boisk, które faktycznie mają otwartą poprawkę, jest tańsze.
 */
export function usePoprawki() {
  const [lista, setLista] = useState<Poprawka[]>([]);
  const [wczytuje, setWczytuje] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);

  const pobierz = useCallback(async () => {
    const supabase = await supabaseBrowser();
    if (!supabase) {
      setWczytuje(false);
      return;
    }

    const res = await supabase
      .from("photo_swaps")
      .select(
        "id, court_id, kind, storage_path, gps_odleglosc_m, created_at," +
          " courts(slug, name, city)," +
          " profiles!photo_swaps_author_id_fkey(display_name, slug)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (res.error) {
      setBlad(res.error.message);
      setWczytuje(false);
      return;
    }

    const wiersze = (res.data ?? []) as unknown as SurowaPoprawka[];

    /* zdjęcia A - tylko dla boisk, których dotyczy choć jedna otwarta poprawka */
    const boiska = [...new Set(wiersze.map((w) => w.court_id))];
    const obecne = new Map<string, string>();
    if (boiska.length) {
      const { data } = await supabase
        .from("court_photos")
        .select("court_id, kind, storage_path")
        .in("court_id", boiska);
      for (const p of (data ?? []) as { court_id: string; kind: string; storage_path: string }[]) {
        obecne.set(`${p.court_id}|${p.kind}`, p.storage_path);
      }
    }

    setBlad(null);
    setLista(
      wiersze.map((w) => {
        const stara = obecne.get(`${w.court_id}|${w.kind}`);
        return {
          id: w.id,
          courtId: w.court_id,
          slug: w.courts?.slug ?? "",
          nazwa: w.courts?.name ?? "(usunięte boisko)",
          miasto: w.courts?.city ?? "",
          kind: w.kind,
          kadr: PHOTO_KIND_LABEL[w.kind] ?? w.kind,
          nowe: photoUrl(w.storage_path),
          sciezkaNowego: w.storage_path,
          obecne: stara ? photoUrl(stara) : null,
          autor: w.profiles?.display_name ?? "użytkownik bez nicku",
          autorSlug: w.profiles?.slug ?? null,
          gpsM: w.gps_odleglosc_m,
          kiedy: w.created_at,
        };
      })
    );
    setWczytuje(false);
  }, []);

  /*
    Wywołanie idzie przez funkcję asynchroniczną, a nie wprost w ciele efektu. To nie jest
    ozdoba składniowa: `setState` wywołany synchronicznie w efekcie robi kaskadę renderów
    i React Compiler odrzuca taki zapis. Ta sama sztuczka co w `lib/galeria.ts`.
  */
  useEffect(() => {
    void (async () => {
      await pobierz();
    })();
  }, [pobierz]);

  /** Znika z listy od razu - czekanie na ponowne pobranie wyglądałoby jak zawieszenie. */
  const zdejmij = (id: string) => setLista((l) => l.filter((p) => p.id !== id));

  /**
   * Przyjmuje poprawkę: podmiana zdjęcia i zamknięcie zgłoszenia w JEDNEJ operacji bazy
   * (`przyjmij_poprawke`), bo muszą się udać albo nie udać razem - inaczej awaria między
   * jednym a drugim zostawiłaby otwarte zgłoszenie przy już podmienionym kadrze.
   *
   * Baza oddaje ścieżkę zdjęcia, które właśnie przestało być używane. Kasujemy je tutaj,
   * bo baza nie ma jak sięgnąć do R2. Niepowodzenie kasowania nie cofa przyjęcia -
   * zostaje wtedy jeden osierocony plik, a nie niespójny wpis.
   */
  const przyjmij = useCallback(async (p: Poprawka) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    const { data, error } = await supabase.rpc("przyjmij_poprawke", { sub: p.id });
    if (error) {
      setBlad(error.message);
      return;
    }

    const stara = data as string | null;
    if (stara) await usunZdjecia([stara]).catch(() => 0);

    setBlad(null);
    zdejmij(p.id);
  }, []);

  /**
   * Odrzuca poprawkę i kasuje przyniesiony plik.
   *
   * Kasowanie jest tu częścią odrzucenia, nie dodatkiem: bez niego R2 zbierałby wszystkie
   * kadry, które kiedykolwiek komuś nie podeszły, a nikt nigdy by do nich nie wrócił.
   * Sam wiersz zostaje ze statusem `rejected` - autor ma prawo zobaczyć, co się stało
   * z jego zgłoszeniem.
   */
  const odrzuc = useCallback(async (p: Poprawka) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("photo_swaps")
      .update({
        status: "rejected",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      })
      .eq("id", p.id);

    if (error) {
      setBlad(error.message);
      return;
    }

    await usunZdjecia([p.sciezkaNowego]).catch(() => 0);

    setBlad(null);
    zdejmij(p.id);
  }, []);

  return { lista, wczytuje, blad, przyjmij, odrzuc, odswiez: pobierz };
}
