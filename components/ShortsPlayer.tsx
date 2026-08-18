"use client";

import { useState } from "react";
import {
  youtubeEmbed,
  youtubeId,
  youtubeThumb,
  youtubeThumbFallback,
} from "@/lib/youtube";
import { PlayIcon } from "./icons";

/**
 * Shorts z boiska. Wypełnia kafelek, w którym siedzi (ramkę i proporcje ustala galeria).
 * Domyślnie stoi miniatura z pomarańczowym trójkątem w szkle — film wczytuje się dopiero
 * po kliknięciu, więc nic nie startuje samo i nie zjada danych.
 */
export function ShortsPlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(false);
  const id = youtubeId(url);
  if (!id) return null;

  const thumb = fallback ? youtubeThumbFallback(id) : youtubeThumb(id);

  if (playing) {
    return (
      <iframe
        src={youtubeEmbed(id)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="group absolute inset-0"
      aria-label="Odtwórz film z boiska"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt={title}
        onError={() => setFallback(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

      {/* szklany krążek z pomarańczowym trójkątem — czysta krawędź, poświata pod spodem */}
      <span className="absolute left-1/2 top-1/2 grid h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center">
        <span
          className="absolute inset-[-24px] rounded-full opacity-80 blur-md transition group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.45) 0%, rgba(255,77,10,.12) 58%, transparent 74%)",
          }}
        />
        <span className="relative grid h-full w-full place-items-center rounded-full border border-white/30 bg-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,.8)] backdrop-blur-md transition duration-300 group-hover:scale-[1.06] group-hover:border-white/45 group-hover:bg-white/16">
          <PlayIcon className="ml-1.5 h-8 w-8 text-flame drop-shadow-[0_1px_6px_rgba(255,77,10,.55)]" />
        </span>
      </span>

      <span className="absolute inset-x-2.5 bottom-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-white/85 sm:text-[11px]">
        film z boiska · zagraj
      </span>
    </button>
  );
}
