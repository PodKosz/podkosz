"use client";

import { adresMiniatury, zapasowyAdres, zestawMiniatur } from "@/lib/obrazy";

/**
 * Plakat wydarzenia jako tło boxu.
 *
 * Osobny plik, i to kliencki, z jednego powodu: `onError`. Box wydarzenia jest budowany
 * na serwerze i nie może przekazać w dół funkcji, a bez `onError` nie da się sięgnąć po
 * surowy plik, gdyby przeskalowany adres kiedyś odmówił. Puste, czarne pole na karcie
 * boiska wygląda jak zepsuta strona - cięższe zdjęcie jest lepsze od żadnego.
 *
 * Skalowanie robi Supabase (dlaczego - patrz `lib/obrazy.ts`), a przez `srcSet` telefon
 * bierze wariant pod swój ekran, nie plik przygotowany pod duży monitor.
 */
export function PlakatTla({
  plakat,
  nazwa,
  szerokosci,
  bazowa,
  sizes,
  className,
}: {
  plakat: string;
  nazwa: string;
  szerokosci: number[];
  bazowa: number;
  sizes: string;
  className: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={adresMiniatury(plakat, bazowa, 62)}
      srcSet={zestawMiniatur(plakat, szerokosci, 62)}
      sizes={sizes}
      onError={(e) => {
        const img = e.currentTarget;
        img.srcset = "";
        img.src = zapasowyAdres(img.src);
      }}
      alt={`Plakat wydarzenia: ${nazwa}`}
      className={className}
    />
  );
}
