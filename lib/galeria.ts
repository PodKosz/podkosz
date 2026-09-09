"use client";

import { useEffect, useState } from "react";
import { CourtPhotoRef, PHOTO_KIND_LABEL, PhotoKind } from "./types";
import { orderPhotos } from "./photos";
import { photoUrl } from "./supabase/config";
import { adresMiniatury } from "./obrazy";
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

/**
 * Szerokość miniatury dla danego kadru w wizytówce (0 = duży kadr).
 *
 * Tylko duży kadr dostaje szerszy plik na gęstych ekranach - dwa małe mają po ~105 px,
 * więc 200 px wystarcza im nawet przy podwójnej gęstości, a rozgrzewamy ich dwa razy
 * więcej niż dużych.
 */
export const thumbWidth = (index: number) => {
  if (index === 0) return gestoscEkranu() === 2 ? 480 : 320;
  return 200;
};

/**
 * Adres miniatury.
 *
 * Skalowanie robi Supabase (patrz `lib/obrazy.ts`), a nie optymalizator Vercela, który
 * po przekroczeniu limitu w planie odpowiada `402 Payment Required`. Adres składamy sami,
 * bo tylko wtedy wiadomo z góry, co rozgrzać w pamięci przeglądarki - a rozgrzewanie jest
 * po to, żeby wizytówka nad pinezką pojawiała się bez ani jednej klatki czekania.
 */
export function thumbUrl(url: string, w: number = 320) {
  return adresMiniatury(url, w, 55);
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
 * Ile boisk pytamy jednym zapytaniem.
 *
 * `.in("court_id", [...])` trafia do adresu URL, a identyfikator to 36 znaków. Przy
 * trzystu boiskach adres ma jedenaście kilobajtów - a Kong przed Supabase ma bufor
 * ośmiu, więc od pewnej liczby wpisów zapytanie wracało jako 414 i `catch` zamiatał to
 * pod dywan: rozgrzewanie po prostu przestawało działać i nikt się nie dowiadywał.
 * Pięćdziesiąt identyfikatorów to około dwóch kilobajtów, z zapasem na wszystko.
 */
const PACZKA = 50;

/**
 * Ilu boiskom rozgrzewamy SAME PLIKI zdjęć.
 *
 * To jest zupełnie inna liczba niż `PACZKA` i inaczej się o niej myśli. Pobranie adresów
 * jest tanie (kilka bajtów na boisko), ale rozgrzanie obrazka to prawdziwe pobranie
 * pliku. Zmierzone na zdjęciu z tego serwisu: duży kadr 480 px waży 48 kB, dwa małe po
 * 9 kB - czyli 66 kB na boisko.
 *
 * Do tej pory rozgrzewaliśmy trzy kadry KAŻDEGO boiska do trzystu wpisów. To 20 MB
 * pobrane przez każdego odwiedzającego z komputera, ZANIM najedzie na cokolwiek - a przy
 * trzystu odwiedzających 6 GB transferu ze Storage. Darmowy plan Supabase daje 5 GB na
 * miesiąc, Pro 250 GB; jedno udane wejście z mediów zjadałoby miesiąc w jeden dzień.
 *
 * Dwadzieścia cztery boiska (te najczęściej podpalane stoją na liście pierwsze) to
 * 1,2 MB - tyle, co jedno zdjęcie w tle. Pozostałe wizytówki mają już ADRESY, więc
 * przeglądarka zaczyna pobierać plik w chwili najechania: kadr pojawia się o ułamek
 * sekundy później, zamiast czekać wcześniej na wszystkie trzysta.
 */
const ROZGRZEWANYCH = 24;

/**
 * Pobiera miniatury dla wielu boisk i rozgrzewa obrazki tych pierwszych na liście.
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

  /*
    Paczkami, nie wszystko naraz - patrz `PACZKA`. Paczki lecą równolegle: to nadal
    kilka żądań zamiast jednego, ale krótkich i naraz, a nie jedno, które nie przechodzi.
  */
  const paczki: string[][] = [];
  for (let i = 0; i < brakujace.length; i += PACZKA) {
    paczki.push(brakujace.slice(i, i + PACZKA));
  }

  const odpowiedzi = await Promise.all(
    paczki.map((paczka) =>
      supabase
        .from("court_photos")
        .select("court_id, kind, storage_path, sort")
        .in("court_id", paczka)
        .order("sort")
    )
  );

  const wiersze = odpowiedzi.flatMap((r) => (r.data ?? [])) as {
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

  brakujace.forEach((id, miejsce) => {
    const photos = orderPhotos(poBoisku.get(id) ?? []);
    cache.set(id, photos);

    /* pliki rozgrzewamy tylko czołówce listy - patrz `ROZGRZEWANYCH` */
    if (miejsce >= ROZGRZEWANYCH) return;
    photos.slice(0, howMany).forEach((p, i) => {
      if (p.url) rozgrzej(thumbUrl(p.url, thumbWidth(i)));
    });
  });
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
