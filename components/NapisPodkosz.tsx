import Image from "next/image";
import { ZNAK_SLOWNY } from "@/lib/znak";

/**
 * Napis PODKOSZ - znak słowny narysowany od zera (kształty w `lib/znak.ts`), a nie tekst
 * pisany czcionką. Bez hooków, więc działa i na serwerze (zasłona, dokumenty), i w komponentach
 * klienta (`Brand`).
 *
 * „POD” bierze kolor tekstu (`currentColor`), więc w motywie ciemnym jest jasne, w jasnym
 * ciemne. „KOSZ” to płomień z barw motywu - ten sam porządek przystanków co w znaku.
 *
 * `uid` musi być unikalny na stronie: gradient to odwołanie `url(#…)`, a dwa napisy z tym samym
 * id sięgałyby po definicję pierwszego.
 *
 * `etykieta` - gdy napis stoi sam (zasłona), czytnik ekranu dostaje nazwę. Bez niej napis jest
 * ozdobą, bo nazwę podaje otaczający link (`Brand`).
 */
export function NapisPodkosz({
  uid,
  wysokosc,
  etykieta,
  className,
  style,
}: {
  uid: string;
  /** wysokość liter w pikselach; bez niej rozmiar ustalają klasy (`className`) */
  wysokosc?: number;
  etykieta?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { szerokosc, wysokosc: h, koszOd, pod, kosz } = ZNAK_SLOWNY;
  const gradient = `napis-g-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${szerokosc} ${h}`}
      className={className}
      style={wysokosc ? { height: wysokosc, width: (wysokosc * szerokosc) / h, ...style } : style}
      {...(etykieta ? { role: "img", "aria-label": etykieta } : { "aria-hidden": true })}
    >
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={koszOd} y1={0} x2={szerokosc} y2={h}>
          <stop offset="0" style={{ stopColor: "var(--color-glow-soft)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-flame)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--color-ember)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-ember-deep)" }} />
        </linearGradient>
      </defs>
      <path d={pod} fill="currentColor" />
      <path d={kosz} fill={`url(#${gradient})`} />
    </svg>
  );
}

/**
 * Napis z podpisem partnera: pod literami „Powered by” i logo Coconaut. Od 22.10.2026 napis
 * nigdzie nie stoi bez tego wiersza - ani w nawigacji, ani na mapie, zasłonie czy w dokumentach.
 *
 * Wszystkie wymiary są w `em`, a 1em to wysokość liter, więc całość skaluje jedna klasa `text-[…]`
 * (w `className` albo odziedziczona). Proporcje z wersji zatwierdzonej na mapie przy literach
 * 20,5 px: podpis 7,5 px, logo 10 px, odstęp 7 px, wiersz 6 px pod napisem.
 *
 * Wiersz ma szerokość napisu (`self-stretch`), a logo jest dosunięte do prawej - kończy się
 * dokładnie na prawej krawędzi Z. Plik logo jest przycięty do krawędzi liter i zmniejszony
 * (`coconaut-logo-web.png`, 3 kB); `unoptimized`, bo optymalizator z next.config obsługuje
 * zdjęcia z Supabase i dla plików z `public` nie umie podać szerokości.
 */
export function NapisZPartnerem({
  uid,
  etykieta,
  className = "",
}: {
  uid: string;
  etykieta?: string;
  className?: string;
}) {
  return (
    <span className={`flex flex-col items-start ${className}`}>
      <NapisPodkosz uid={uid} etykieta={etykieta} className="h-[1em] w-auto" />
      <span className="mt-[0.293em] flex items-center justify-end gap-[0.341em] self-stretch">
        <span className="text-[0.366em] font-semibold uppercase leading-none tracking-[0.2em]">
          Powered by
        </span>
        <Image
          src="/partnerzy/coconaut-logo-web.png"
          alt="Coconaut"
          width={330}
          height={64}
          unoptimized
          className="h-[0.488em] w-auto"
        />
      </span>
    </span>
  );
}
