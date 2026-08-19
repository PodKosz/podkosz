/** Wyciąga identyfikator filmu z linku YouTube: Shorts, zwykły watch, youtu.be, embed. */
export function youtubeId(url: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;

  const patterns = [
    /youtube\.com\/shorts\/([\w-]{6,})/i,
    /youtube\.com\/embed\/([\w-]{6,})/i,
    /youtube\.com\/live\/([\w-]{6,})/i,
    /youtube\.com\/watch\?[^#]*\bv=([\w-]{6,})/i,
    /youtu\.be\/([\w-]{6,})/i,
  ];

  for (const re of patterns) {
    const hit = raw.match(re);
    if (hit) return hit[1];
  }

  // sam identyfikator wklejony do pola
  return /^[\w-]{9,14}$/.test(raw) ? raw : null;
}

/**
 * Miniatura w oryginalnych proporcjach (dla Shortsów pionowa) - `oardefault`.
 * Jeśli YouTube jej nie ma, komponent podmienia adres na klasyczne `hqdefault` 16:9.
 */
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
export const youtubeThumbFallback = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Adres do osadzenia - odtwarzanie startuje dopiero po kliknięciu play. */
export const youtubeEmbed = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
