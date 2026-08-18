"use client";

import { useState } from "react";
import { Court, CourtPhotoRef, PhotoKind } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { Lightbox } from "./Lightbox";

/**
 * Galeria układana pod konkretne kadry, a nie w równą siatkę: tytułowe całe boisko dostaje
 * szeroki panel, kosze stoją pionowo po bokach, a detale (obręcz i nawierzchnia) siedzą
 * między nimi — wiersz jest symetryczny względem osi. Film z boiska jest jednym z kafelków:
 * na dużym ekranie stoi pionowo w tym samym wierszu co kosze, na telefonie ląduje na końcu.
 * Dolne rzędy dzielimy tak, żeby każdy był pełny — nigdy nie zostaje puste miejsce.
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
  const rest = photos.map((_, i) => i).filter((i) => !used.has(i));

  const middle = [rim, surface].filter((i) => i >= 0);
  const portraits = [hoopA, hoopB].filter((i) => i >= 0);

  /**
   * Zdjęcie leży w warstwie absolutnej — inaczej jego naturalna wysokość rozpycha
   * kafelek i cały wiersz mozaiki.
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

  /* Dolne kadry dzielimy na rzędy po maksymalnie trzy, ale równo — 3, 3, 2 zamiast
     3, 3, 1 — żeby żaden rząd nie kończył się pustym miejscem. */
  const bottom = [wide, ...rest].filter((i) => i >= 0);
  const rowCount = Math.max(1, Math.ceil(bottom.length / 3));
  const rows: number[][] = Array.from({ length: rowCount }, () => []);
  bottom.forEach((index, i) => rows[i % rowCount].push(index));

  const ROW_COLS: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
  };
  const ROW_RATIO: Record<number, string> = {
    1: "aspect-[16/9] w-full",
    2: "aspect-[3/2] w-full",
    3: "aspect-[4/3] w-full",
  };

  /** Kolumny wiersza z koszami — film dokłada czwartą, węższą kolumnę na dużym ekranie. */
  const middleGrid =
    portraits.length === 2
      ? video
        ? "sm:grid-cols-[1fr_1.15fr_1fr] lg:grid-cols-[1fr_1.1fr_1fr_0.78fr]"
        : "sm:grid-cols-[1fr_1.15fr_1fr]"
      : portraits.length === 1
        ? video
          ? "sm:grid-cols-[1fr_1.3fr] lg:grid-cols-[1fr_1.25fr_0.78fr]"
          : "sm:grid-cols-[1fr_1.3fr]"
        : video
          ? "sm:grid-cols-1 lg:grid-cols-[1fr_0.42fr]"
          : "sm:grid-cols-1";

  /** Film jako kafelek: w wierszu z koszami od `lg`, niżej osobno na węższych ekranach. */
  const videoTile = (variant: "row" | "bottom") =>
    !video ? null : (
      <div
        className={`relative overflow-hidden rounded-[20px] border border-hairline ${
          variant === "row"
            ? "hidden lg:block lg:h-full lg:w-full"
            : "mx-auto aspect-[9/16] w-full max-w-[320px] lg:hidden"
        }`}
      >
        {video}
      </div>
    );

  return (
    <>
      <div className="space-y-3">
        {/* kadr tytułowy — najszerszy, żeby od razu było widać całą płytę */}
        {tile(heroIndex, "aspect-[16/9] w-full")}

        {/* kosze pionowo po bokach, detale w środku, film z prawej */}
        {(portraits.length > 0 || middle.length > 0 || video) && (
          <div className={`grid gap-3 ${middleGrid}`}>
            {portraits[0] !== undefined && tile(portraits[0], "aspect-[3/4] h-full w-full")}

            {middle.length > 0 && (
              <div className={`grid gap-3 ${middle.length === 2 ? "grid-rows-2" : "grid-rows-1"}`}>
                {middle.map((i) =>
                  tile(
                    i,
                    // na telefonie kolumny nie ma, więc kafelek musi mieć własne proporcje
                    portraits.length
                      ? "aspect-[16/9] w-full sm:aspect-auto sm:h-full"
                      : "aspect-[16/9] w-full"
                  )
                )}
              </div>
            )}

            {portraits[1] !== undefined && tile(portraits[1], "aspect-[3/4] h-full w-full")}

            {videoTile("row")}
          </div>
        )}

        {/* pozostałe kadry — rzędy zawsze pełne */}
        {rows.map(
          (row, ri) =>
            row.length > 0 && (
              <div
                key={ri}
                className={`grid gap-3 ${ROW_COLS[row.length] ?? "grid-cols-2 sm:grid-cols-3"}`}
              >
                {row.map((i, k) =>
                  tile(
                    i,
                    ROW_RATIO[row.length] ?? "aspect-[4/3] w-full",
                    // trzeci kadr w rzędzie stoi na telefonie sam, więc bierze całą szerokość
                    row.length === 3 && k === 2 ? "col-span-2 sm:col-span-1" : ""
                  )
                )}
              </div>
            )
        )}

        {videoTile("bottom")}
      </div>

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
