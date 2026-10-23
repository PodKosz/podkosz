"use client";

import { kafelkiPodkladu } from "@/lib/podklad";
import { useMotyw } from "@/lib/motyw";
import { IkProwadz } from "./ikony";

/** Przybliżenie mini mapki - widać ulice wokół boiska, ale nie całą dzielnicę. */
const ZOOM = 16;
/** Kafelki wokół środka: 3 w każdą stronę w poziomie (do 1800 px szerokości), 1 w pionie. */
const ZASIEG_X = 3;
const ZASIEG_Y = 1;
const KAFEL = 256;

/**
 * Mini mapka z boiskiem dokładnie na środku, osadzona wprost na stronie - krawędzie gasną
 * gradientem. Przy pinezce adres i „Prowadź" (nawigacja Google Maps).
 *
 * To nie jest MapLibre, tylko siatka zwykłych obrazków z kafelkami tego samego podkładu,
 * co mapa główna (`kafelkiPodkladu`). Mapka nic nie robi poza pokazaniem miejsca, więc
 * nie ma po co ściągać na kartę boiska całej biblioteki map i WebGL-a. Kafelki są ułożone
 * tak, że punkt boiska wypada w samym środku ramki przy każdej jej szerokości.
 */
export function MiniMapa({
  lat,
  lng,
  ulica,
  miejscowosc,
}: {
  lat: number;
  lng: number;
  ulica: string;
  miejscowosc: string;
}) {
  const jasny = useMotyw() === "jasny";
  const wzory = kafelkiPodkladu("dark_all", jasny);

  /* położenie boiska w pikselach świata (Web Mercator) na danym przybliżeniu */
  const n = 2 ** ZOOM;
  const px = ((lng + 180) / 360) * n * KAFEL;
  const rad = (lat * Math.PI) / 180;
  const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * KAFEL;
  const tx = Math.floor(px / KAFEL);
  const ty = Math.floor(py / KAFEL);

  const kafelki = [];
  for (let dy = -ZASIEG_Y; dy <= ZASIEG_Y; dy++) {
    for (let dx = -ZASIEG_X; dx <= ZASIEG_X; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      const wzor = wzory[(x + y) % wzory.length];
      kafelki.push({
        klucz: `${x}-${y}`,
        src: wzor.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y)),
        /* przesunięcie względem środka ramki: tam stoi punkt boiska */
        left: x * KAFEL - px,
        top: y * KAFEL - py,
      });
    }
  }

  const nawigacja = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <section className="kb-sekcja" aria-labelledby="dojazd-tytul">
      <h2 id="dojazd-tytul" className="kb-tytul px-1">
        Dojazd
      </h2>
      <div className="kb-mapka">
        <div className="kb-mapka-kafelki" aria-hidden>
          {kafelki.map((k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={k.klucz}
              src={k.src}
              alt=""
              width={KAFEL}
              height={KAFEL}
              loading="lazy"
              decoding="async"
              style={{ left: `calc(50% + ${k.left}px)`, top: `calc(50% + ${k.top}px)` }}
            />
          ))}
        </div>

        {/* pinezka-piłka dokładnie w środku ramki, tam gdzie wypada punkt boiska */}
        <span className="kb-mapka-pinezka" aria-hidden>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10.5" fill="url(#kb-pilka)" />
            <defs>
              <linearGradient id="kb-pilka" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--grad-1)" />
                <stop offset="0.5" stopColor="var(--grad-2)" />
                <stop offset="1" stopColor="var(--grad-3)" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="#1a0b02" strokeWidth="1.2" strokeLinecap="round">
              <path d="M12 1.5v21M1.5 12h21" />
              <path d="M5 4.6c3 3.4 3 11.4 0 14.8M19 4.6c-3 3.4-3 11.4 0 14.8" />
            </g>
          </svg>
        </span>

        <div className="kb-mapka-adres">
          <p>
            <b>{ulica}</b>
            <span>{miejscowosc}</span>
          </p>
          <a href={nawigacja} target="_blank" rel="noreferrer" className="kb-przycisk kb-przycisk-kadr gap-2 px-4">
            <IkProwadz className="h-[17px] w-[17px]" /> Prowadź
          </a>
        </div>
      </div>
      <p className="mt-1 px-1 text-right text-[10.5px] text-faint">© OpenStreetMap{process.env.NEXT_PUBLIC_CARTO_KEY ? " · © CARTO" : " · Esri"}</p>
    </section>
  );
}
