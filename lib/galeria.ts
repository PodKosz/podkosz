"use client";

import { useEffect, useState } from "react";
import { CourtPhotoRef, PHOTO_KIND_LABEL, PhotoKind } from "./types";
import { orderPhotos } from "./photos";
import { photoUrl } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";
import { COURTS } from "./data";

/**
 * Zdjęcia boisk dla wizytówki nad pinezką.
 *
 * Mapa i lista dostają boiska bez zdjęć (`MapCourt`), bo przy kilku tysiącach wpisów
 * adresy zdjęć byłyby największą częścią odpowiedzi. Żeby jednak wizytówka pojawiała się
 * NATYCHMIAST po najechaniu na pinezkę, tuż po wczytaniu mapy robimy jedno zapytanie
 * hurtowe po miniatury widocznych boisk i od razu rozgrzewamy same obrazki. Najechanie
 * kursorem nie czeka wtedy ani na bazę, ani na pobranie plików.
 */
const cache = new Map<string, CourtPhotoRef[]>();

/*
  Wizytówka pokazuje trzy kadry: pierwszy zajmuje dwie trzecie szerokości, dwa kolejne
  są małe. Stąd dwie szerokości miniatur - mniejsze pliki, a wygląd ten sam.

  Wartości muszą być z listy `imageSizes` w next.config, bo optymalizator odrzuca każdą
  inną szerokość (kosztowało mnie to jedno „w=160" i dwa puste kadry w wizytówce).
  Na ekranach o dużej gęstości bierzemy o stopień szersze pliki, żeby miniatury nie były
  miękkie - i tak liczą się w kilobajtach.
*/
function gestoscEkranu() {
  return typeof window !== "undefined" && window.devicePixelRatio > 1.5 ? 2 : 1;
}

/** Szerokość miniatury dla danego kadru w wizytówce (0 = duży kadr). */
export const thumbWidth = (index: number) => {
  const gesty = gestoscEkranu() === 2;
  if (index === 0) return gesty ? 480 : 320;
  return gesty ? 320 : 200;
};

/**
 * Adres miniatury przez optymalizator Next. Budujemy go sami (a nie przez next/image),
 * bo tylko wtedy wiemy z góry, co rozgrzać w pamięci przeglądarki - srcset zależy od
 * gęstości ekranu i przy rozgrzewaniu strzelalibyśmy w inny plik niż ten wyświetlany.
 */
export function thumbUrl(url: string, w: number = 320) {
  // jakość 55 musi być wymieniona w `images.qualities` w next.config - inaczej 400
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=55`;
}

/** Adresy już rozgrzane - żeby nie tworzyć drugi raz tego samego obrazka. */
const rozgrzane = new Set<string>();

function rozgrzej(url: string) {
  if (typeof window === "undefined" || rozgrzane.has(url)) return;
  rozgrzane.add(url);
  const img = new window.Image();
  img.decoding = "async";
  img.src = url;
}

/**
 * Pobiera miniatury dla wielu boisk jednym zapytaniem i rozgrzewa obrazki.
 * Wołane po wczytaniu mapy, w bezczynnym momencie.
 */
export async function prefetchCourtPhotos(courtIds: string[], howMany = 3) {
  const brakujace = courtIds.filter((id) => !cache.has(id));
  if (!brakujace.length) return;

  const supabase = await supabaseBrowser();
  if (!supabase) {
    for (const id of brakujace) {
      cache.set(id, COURTS.find((c) => c.id === id)?.photos ?? []);
    }
    return;
  }

  const { data } = await supabase
    .from("court_photos")
    .select("court_id, kind, storage_path, sort")
    .in("court_id", brakujace)
    .order("sort");

  const wiersze = (data ?? []) as {
    court_id: string;
    kind: PhotoKind;
    storage_path: string;
    sort: number;
  }[];

  const poBoisku = new Map<string, CourtPhotoRef[]>();
  for (const r of wiersze) {
    const lista = poBoisku.get(r.court_id) ?? [];
    lista.push({
      kind: r.kind,
      url: photoUrl(r.storage_path),
      caption: PHOTO_KIND_LABEL[r.kind] ?? r.kind,
    });
    poBoisku.set(r.court_id, lista);
  }

  for (const id of brakujace) {
    const photos = orderPhotos(poBoisku.get(id) ?? []);
    cache.set(id, photos);
    photos.slice(0, howMany).forEach((p, i) => {
      if (p.url) rozgrzej(thumbUrl(p.url, thumbWidth(i)));
    });
  }
}

export async function fetchCourtPhotos(courtId: string): Promise<CourtPhotoRef[]> {
  const gotowe = cache.get(courtId);
  if (gotowe) return gotowe;

  const supabase = await supabaseBrowser();
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
