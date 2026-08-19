"use client";

import { useEffect, useState } from "react";
import { CourtPhotoRef, PHOTO_KIND_LABEL, PhotoKind } from "./types";
import { orderPhotos } from "./photos";
import { photoUrl } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";
import { COURTS } from "./data";

/**
 * Zdjęcia boiska dociągane na żądanie.
 *
 * Mapa i lista wyników dostają boiska bez zdjęć (`MapCourt`), bo przy kilku tysiącach
 * wpisów adresy zdjęć są największą częścią odpowiedzi. Wizytówka nad pinezką potrzebuje
 * trzech miniatur, więc pobiera je dopiero wtedy, gdy ktoś na tę pinezkę wejdzie -
 * i zapamiętuje wynik na czas życia karty w przeglądarce.
 */
const cache = new Map<string, CourtPhotoRef[]>();

export async function fetchCourtPhotos(courtId: string): Promise<CourtPhotoRef[]> {
  const gotowe = cache.get(courtId);
  if (gotowe) return gotowe;

  const supabase = supabaseBrowser();
  if (!supabase) {
    // tryb testowy: zdjęcia (a właściwie grafiki zastępcze) siedzą w danych demo
    const demo = COURTS.find((c) => c.id === courtId)?.photos ?? [];
    cache.set(courtId, demo);
    return demo;
  }

  const { data } = await supabase
    .from("court_photos")
    .select("kind, storage_path, sort")
    .eq("court_id", courtId)
    .order("sort");

  const photos = orderPhotos(
    ((data ?? []) as { kind: PhotoKind; storage_path: string; sort: number }[]).map((p) => ({
      kind: p.kind,
      url: photoUrl(p.storage_path),
      caption: PHOTO_KIND_LABEL[p.kind] ?? p.kind,
    }))
  );

  cache.set(courtId, photos);
  return photos;
}

/**
 * Hook dla wizytówki: zwraca zdjęcia, a do czasu ich pobrania pustą listę - komponent
 * pokazuje wtedy grafiki zastępcze, więc nic nie skacze na ekranie.
 */
export function useCourtPhotos(courtId: string, howMany = 3): CourtPhotoRef[] {
  const [loaded, setLoaded] = useState<{ id: string; photos: CourtPhotoRef[] } | null>(null);

  useEffect(() => {
    let aktualne = true;
    // setState wyłącznie w callbacku obietnicy: synchroniczny setState w ciele efektu
    // wywołuje kaskadę renderów (i jest odrzucany przez regułę React Compilera)
    fetchCourtPhotos(courtId)
      .then((photos) => {
        if (aktualne) setLoaded({ id: courtId, photos });
      })
      .catch(() => undefined);
    return () => {
      aktualne = false;
    };
  }, [courtId]);

  // przy zmianie pinezki bierzemy dane z pamięci od razu w renderze, bez czekania na efekt
  const photos = loaded?.id === courtId ? loaded.photos : cache.get(courtId) ?? [];
  return photos.slice(0, howMany);
}
