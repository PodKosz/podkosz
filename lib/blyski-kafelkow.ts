import type { Map as MlMap } from "maplibre-gl";

/**
 * Błysk pod każdym nowym kafelkiem podkładu.
 *
 * Podkład to kafelki rastrowe, więc mapa zawsze wstaje na raty - kwadrat po kwadracie.
 * Tego się nie da ukryć bez czekania na komplet (próbowaliśmy kurtyny, która odsłaniała
 * mapę dopiero na końcu - wyglądało gorzej niż samo ładowanie). Zamiast chować kwadraty,
 * robimy z nich efekt: każdy wchodzi z delikatnym gradientem w barwie marki, który gaśnie,
 * zanim zdąży się zrobić natrętny. Mapa nie „doładowuje się", tylko zapala.
 *
 * Kafelki rysuje WebGL, więc na sam kafelek niczego nałożyć nie można. Błyski to zwykłe
 * elementy w warstwie nad płótnem, ustawiane w miejscu kafelka z jego współrzędnych
 * (z/x/y), a przy przesuwaniu mapy przeliczane - inaczej odjeżdżałyby od swoich kwadratów.
 * Warstwa siedzi w kontenerze płótna TUŻ ZA płótnem, czyli pod pinezkami: światło kładzie
 * się na mapie, a nie na boiskach.
 */

/** tyle błysków naraz najwyżej - przy szybkim przybliżaniu kafelków leci naraz setka */
const NAJWIECEJ = 120;

type Blysk = { el: HTMLSpanElement; zach: number; pln: number; wsch: number; pld: number };

/** Lewy górny róg kafelka w stopniach. `wrap` to kolejna kopia świata przy przewinięciu mapy. */
function naroznik(x: number, y: number, z: number, wrap: number) {
  const n = 2 ** z;
  const lng = ((x + wrap * n) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lng, lat };
}

export function blyskiKafelkow(map: MlMap, zrodlo: string): () => void {
  // bez ruchu na życzenie systemu - wtedy kafelki wchodzą po prostu przenikaniem
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;

  const plotno = map.getCanvas();
  const warstwa = document.createElement("div");
  warstwa.className = "blyski-kafelkow";
  warstwa.setAttribute("aria-hidden", "true");
  plotno.parentElement?.insertBefore(warstwa, plotno.nextSibling);

  const zywe = new Set<Blysk>();

  const ustaw = (b: Blysk) => {
    const lg = map.project([b.zach, b.pln]);
    const pd = map.project([b.wsch, b.pld]);
    b.el.style.transform = `translate(${lg.x}px, ${lg.y}px)`;
    b.el.style.width = `${pd.x - lg.x}px`;
    b.el.style.height = `${pd.y - lg.y}px`;
  };

  const poWczytaniu = (e: unknown) => {
    const ev = e as {
      dataType?: string;
      sourceId?: string;
      tile?: { tileID?: { canonical: { x: number; y: number; z: number }; wrap: number } };
    };
    if (ev.dataType !== "source" || ev.sourceId !== zrodlo || !ev.tile?.tileID) return;
    if (zywe.size >= NAJWIECEJ) return;

    const { canonical: c, wrap } = ev.tile.tileID;
    const lg = naroznik(c.x, c.y, c.z, wrap);
    const pd = naroznik(c.x + 1, c.y + 1, c.z, wrap);
    const el = document.createElement("span");
    el.className = "blysk-kafelka";
    const b: Blysk = { el, zach: lg.lng, pln: lg.lat, wsch: pd.lng, pld: pd.lat };
    ustaw(b);
    el.addEventListener(
      "animationend",
      () => {
        el.remove();
        zywe.delete(b);
      },
      { once: true }
    );
    warstwa.appendChild(el);
    zywe.add(b);
  };

  /* przeliczamy tylko to, co jeszcze świeci - zwykle kilka, kilkanaście elementów */
  const poRuchu = () => {
    for (const b of zywe) ustaw(b);
  };

  map.on("data", poWczytaniu);
  map.on("move", poRuchu);

  return () => {
    map.off("data", poWczytaniu);
    map.off("move", poRuchu);
    warstwa.remove();
    zywe.clear();
  };
}
