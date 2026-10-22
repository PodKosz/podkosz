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
