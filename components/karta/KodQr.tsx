import { encode } from "uqr";

/**
 * Kod QR „zeskanuj i zagraj" - prawdziwy kod, nie wzór w stylu QR (prototyp 09 miał wzór).
 *
 * Liczony na serwerze przy budowaniu karty: adres boiska się nie zmienia, więc przeglądarka
 * dostaje gotowy rysunek i ani bajta biblioteki. Korekcja błędów M (15%) - kod ma się dać
 * zeskanować z ekranu telefonu trzymanego przez kolegę, z odbiciem i pod kątem.
 *
 * Moduły rysujemy jedną ścieżką (po prostokącie na każdy ciemny moduł w wierszu, sklejając
 * sąsiadów), a nie setkami elementów `<rect>`.
 */
export function KodQr({ tekst, className = "" }: { tekst: string; className?: string }) {
  const { size, data } = encode(tekst, { ecc: "M", border: 0 });

  let d = "";
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (!data[y][x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && data[y][x]) x += 1;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Kod QR z adresem tej karty boiska"
      className={className}
    >
      <path d={d} fill="#0b0b0d" />
    </svg>
  );
}
