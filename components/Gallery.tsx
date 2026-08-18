"use client";

import { useState } from "react";
import { Court, CourtPhotoRef, PhotoKind } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { Lightbox } from "./Lightbox";

/**
 * Galeria układana pod konkretne kadry, a nie w równą siatkę:
 * tytułowe całe boisko dostaje szeroki kadr, kosze stoją pionowo po bokach,
 * a detale (obręcz i nawierzchnia) siedzą między nimi w środku — układ jest
 * symetryczny względem osi. Na komputerze film z boiska wchodzi w prawą kolumnę
 * i wyśrodkowuje się do wysokości zdjęć, na telefonie ląduje pod nimi.
 */
export function Gallery({ court, video }: { court: Court; video?: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);

  const photos = court.photos;
  const indexOfKind = (kind: PhotoKind) => photos.findIndex((p) => p.kind === kind);

  const heroIndex = indexOfKind("narożnik") >= 0 ? indexOfKind("narożnik") : 0;
  const hoopA = indexOfKind("kosz-a");
  const hoopB = indexOfKind("kosz-b");
  const rim = indexOfKind("detal-kosza");
  const surface = indexOfKind("nawierzchnia");
  const wide = indexOfKind("ogólne-2");

  const used = new Set([heroIndex, hoopA, hoopB, rim, surface, wide].filter((i) => i >= 0));
  const restIndexes = photos.map((_, i) => i).filter((i) => !used.has(i));

  const middle = [rim, surface].filter((i) => i >= 0);
  const portraits = [hoopA, hoopB].filter((i) => i >= 0);

  /**
   * Zdjęcie leży w warstwie absolutnej — inaczej jego naturalna wysokość rozpycha
   * kafelek i cały wiersz mozaiki (kafelki w środku nie mają własnych proporcji).
   */
  const tile = (index: number, ratio: string, extraClass = "") =>
    index < 0 || !photos[index] ? null : (
      <button
        key={index}
        onClick={() => setOpen(index)}
        className={`group relative overflow-hidden rounded-[20px] border border-hairline transition hover:border-flame/50 ${ratio} ${extraClass}`}
      >
        <span className="absolute inset-0">
          <CourtPhoto photo={photos[index]} seed={court.seed + index * 3} />
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-ink/85 sm:text-[11px]">
          {photos[index].caption}
        </span>
      </button>
    );

  const mosaic = (
    <div className="space-y-3">
      {/* kadr tytułowy — najszerszy, żeby od razu było widać całą płytę */}
      {tile(heroIndex, "aspect-[16/9] w-full")}

      {/* kosze pionowo po bokach, detale w środku */}
      {(portraits.length > 0 || middle.length > 0) && (
        <div
          className={`grid gap-3 ${
            portraits.length === 2
              ? "sm:grid-cols-[1fr_1.15fr_1fr]"
              : portraits.length === 1
                ? "sm:grid-cols-[1fr_1.3fr]"
                : "sm:grid-cols-1"
          }`}
        >
          {portraits[0] !== undefined && tile(portraits[0], "aspect-[3/4] h-full w-full")}

          {middle.length > 0 && (
            <div className={`grid gap-3 ${middle.length === 2 ? "grid-rows-2" : "grid-rows-1"}`}>
              {middle.map((i) =>
                tile(
                  i,
                  // na telefonie kolumny nie ma, więc wiersza nie wyznacza pionowy kadr
                  // i kafelek musi mieć własne proporcje — inaczej zapada się do zera
                  portraits.length
                    ? "aspect-[16/9] w-full sm:aspect-auto sm:h-full"
                    : "aspect-[16/9] w-full"
                )
              )}
            </div>
          )}

          {portraits[1] !== undefined && tile(portraits[1], "aspect-[3/4] h-full w-full")}
        </div>
      )}

      {/* całość z drugiej strony i ujęcia dodatkowe */}
      {(wide >= 0 || restIndexes.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {wide >= 0 &&
            tile(
              wide,
              "aspect-[16/9] w-full",
              // bez ujęć dodatkowych szeroki kadr bierze cały wiersz, żeby nie zostawiać dziury
              restIndexes.length ? "col-span-2" : "col-span-2 sm:col-span-3"
            )}
          {restIndexes.map((i) => tile(i, "aspect-[4/3] w-full"))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {video ? (
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          {mosaic}
          <div className="lg:self-center">
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-faint lg:text-center">
              Film z boiska
            </p>
            <div>{video}</div>
          </div>
        </div>
      ) : (
        mosaic
      )}

      {open !== null && (
        <Lightbox
          items={photos.map((p: CourtPhotoRef) => ({ url: p.url, caption: p.caption }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
