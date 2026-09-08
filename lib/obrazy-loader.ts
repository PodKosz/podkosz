import { adresMiniatury } from "./obrazy";

/**
 * Własny „loader" dla `next/image` - kieruje wszystkie zdjęcia boisk do skalowania
 * w Supabase, zamiast do optymalizatora Vercela.
 *
 * Powód jest w `lib/obrazy.ts`: optymalizator na Vercelu odpowiada `402 Payment Required`
 * po przekroczeniu limitu przekształceń w planie, a jedyny widoczny objaw to zdjęcia,
 * które „się nie ładują" - wybiórczo, bo te raz przetworzone leżą w pamięci brzegowej.
 * Jeden plik podmieniony tutaj naprawia to w CAŁYM serwisie: kadr w hero, galeria,
 * kafle boisk, awatary - wszystko, co idzie przez `next/image`.
 *
 * Pliki, których nie ma w naszym Supabase (grafiki z katalogu `public`, dane `data:`),
 * `adresMiniatury` oddaje bez zmian - są małe i nie ma czego skalować.
 */
export default function loaderObrazow({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  return adresMiniatury(src, width, quality ?? 60);
}
