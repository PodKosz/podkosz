import type { Map as MlMap } from "maplibre-gl";

/**
 * Żywe podświetlenie wybranego województwa.
 *
 * MapLibre nie umie wypełnić wielokąta gradientem: `fill-color` to jeden kolor na całą
 * figurę, więc z samych warstw mapy da się zrobić najwyżej pulsowanie jasności - a to
 * wygląda jak mruganie, nie jak żar. Dlatego rysujemy warstwę SVG nad kanwą mapy: kilka
 * miękkich plam światła przyciętych do kształtu województwa, każda w innym tempie i
 * fazie. Wewnątrz obrysu gradient wolno wędruje, poza nim nie ma go wcale.
 *
 * Cała sztuczka z wydajnością polega na tym, że kształt NIE jest przeliczany przy każdej
 * klatce. Współrzędne liczymy raz, w rzutowaniu Mercatora - tym samym, którego używa
 * mapa - i zapisujemy w stałej przestrzeni lokalnej. Przy braku obrotu i pochylenia (a
 * mapa ma je wyłączone) przejście z tej przestrzeni na ekran jest przekształceniem
 * afinicznym: przesunięcie plus skala. Na klatkę przypadają więc dwa rzutowania punktów
 * i jeden zapis atrybutu, a nie osiemset przeliczeń wierzchołków.
 */

/** Skala przestrzeni lokalnej. Polska ma w niej ~1800 jednostek szerokości - dość na detal. */
const K = 65536;

interface Ksztalt {
  d: string;
  /** róg bbox: lewy górny i prawy dolny - z nich liczymy przekształcenie na ekran */
  nw: [number, number];
  se: [number, number];
  lokalneNW: { x: number; y: number };
  lokalneSE: { x: number; y: number };
}

function merkator(lng: number, lat: number) {
  const x = (lng + 180) / 360;
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return { x: x * K, y: y * K };
}

type Pierscien = [number, number][];

function pierscienie(geom: GeoJSON.Geometry): Pierscien[] {
  if (geom.type === "Polygon") return geom.coordinates as Pierscien[];
  if (geom.type === "MultiPolygon") return (geom.coordinates as Pierscien[][]).flat();
  return [];
}

function zbudujKsztalt(geom: GeoJSON.Geometry): Ksztalt | null {
  const rings = pierscienie(geom);
  if (!rings.length) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  const czesci: string[] = [];

  for (const ring of rings) {
    if (ring.length < 3) continue;
    const punkty: string[] = [];
    for (const [lng, lat] of ring) {
      const p = merkator(lng, lat);
      punkty.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    czesci.push(`M${punkty.join("L")}Z`);
  }

  if (!czesci.length) return null;

  return {
    d: czesci.join(""),
    nw: [minLng, maxLat],
    se: [maxLng, minLat],
    lokalneNW: merkator(minLng, maxLat),
    lokalneSE: merkator(maxLng, minLat),
  };
}

/**
 * Prostokąt otaczający województwo - do przysunięcia kamery po kliknięciu w mapę.
 *
 * Liczymy go z tej samej funkcji, co kształt do rysowania, żeby kadr i poświata brały
 * granice z jednego źródła. Rozjazd byłby widoczny gołym okiem: żar wystawałby poza kadr
 * albo nie dochodził do jego krawędzi.
 */
export function bboxWojewodztwa(
  geom: GeoJSON.Geometry
): [number, number, number, number] | null {
  const k = zbudujKsztalt(geom);
  if (!k) return null;
  return [k.nw[0], k.se[1], k.se[0], k.nw[1]];
}

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(nazwa: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, nazwa);
}

export interface ZarWojewodztwa {
  /**
   * Zapala żar na podanym kształcie.
   *
   * `punkt` (lng, lat) to miejsce kliknięcia w mapę. Gdy jest podany, poświata nie pojawia
   * się całą powierzchnią naraz: od tego punktu rozchodzi się fala do granic województwa,
   * a żar wstaje za nią. Bez punktu - przy wyborze z panelu filtrów albo z adresu - zostaje
   * zwykłe rozjaśnienie, bo nie ma miejsca, z którego fala miałaby wyjść.
   */
  ustaw(geom: GeoJSON.Geometry | null, punkt?: [number, number]): void;
  /** 1 = pełny żar, 0 = wygaszony. Do płynnego gaśnięcia przy oddalaniu kamery. */
  przygas(wartosc: number): void;
  zniszcz(): void;
}

/**
 * Podpina warstwę do kanwy mapy i oddaje sterowanie nią.
 *
 * Warstwa ląduje tuż ZA kanwą, a przed pinezkami: żar ma leżeć na mapie, ale pod
 * pinezkami - inaczej podbarwiałby je na pomarańczowo i psuł fioletowe wyróżnienie Heatu.
 */
export function stworzZarWojewodztwa(map: MlMap, przyrostek: string): ZarWojewodztwa {
  const kontener = map.getCanvasContainer();
  const kanwa = map.getCanvas();

  const svg = el("svg");
  svg.setAttribute("class", "zar-woj");
  svg.setAttribute("aria-hidden", "true");

  const defs = el("defs");
  const clip = el("clipPath");
  const idClip = `zar-woj-ksztalt-${przyrostek}`;
  clip.setAttribute("id", idClip);
  const sciezka = el("path");
  clip.appendChild(sciezka);
  defs.appendChild(clip);

  /*
    Trzy gradienty w trzech odcieniach ognia: głęboka czerwień u podstawy, pomarańcz w
    środku i jasny żółty jako najmniejsza, najszybsza plama. Rozłożone na trzy warstwy,
    bo jedna plama w jednym kolorze czyta się jak reflektor, a nie jak rozgrzana blacha.
  */
  /*
    Barwy podajemy jako zmienne motywu, nie jako liczby: skórka „polska" albo „coconaut"
    ma przemalować także żar województw. Zmienna trafia wprost do `stop-color`, a ten
    rozwiązuje ją w kontekście dokumentu - warstwa SVG wisi w drzewie strony, więc widzi
    te same zmienne co reszta arkusza.
  */
  const barwy: [string, string, number][] = [
    ["zar-a", "var(--rgb-flame)", 0.26],
    ["zar-b", "var(--rgb-ember)", 0.23],
    ["zar-c", "var(--rgb-glow)", 0.26],
  ];
  for (const [nazwa, rgb, alfa] of barwy) {
    const g = el("radialGradient");
    g.setAttribute("id", `${nazwa}-${przyrostek}`);
    const s1 = el("stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", `rgb(${rgb} / ${alfa})`);
    const s2 = el("stop");
    s2.setAttribute("offset", "62%");
    s2.setAttribute("stop-color", `rgb(${rgb} / ${(alfa * 0.34).toFixed(3)})`);
    const s3 = el("stop");
    s3.setAttribute("offset", "100%");
    s3.setAttribute("stop-color", `rgb(${rgb} / 0)`);
    g.append(s1, s2, s3);
    defs.appendChild(g);
  }
  /*
    Gradient fali. Najjaśniejszy jest jej brzeg, a nie środek - dzięki temu czyta się jako
    czoło rozchodzącej się poświaty, a nie jako rosnąca plama. Środek zostawiamy prawie
    przezroczysty, więc pod falą widać już wstający żar.
  */
  const gFala = el("radialGradient");
  gFala.setAttribute("id", `zar-woj-fala-${przyrostek}`);
  for (const [offset, kolor] of [
    ["0%", "rgb(var(--rgb-glow) / 0)"],
    ["54%", "rgb(var(--rgb-glow) / 0.10)"],
    ["84%", "rgb(var(--rgb-glow) / 0.30)"],
    ["96%", "rgba(255,244,222,0.44)"],
    ["100%", "rgba(255,255,255,0)"],
  ] as [string, string][]) {
    const stop = el("stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", kolor);
    gFala.appendChild(stop);
  }
  defs.appendChild(gFala);

  svg.appendChild(defs);

  /** grupa przesuwana i skalowana razem z mapą */
  const scena = el("g");
  const przyciete = el("g");
  przyciete.setAttribute("clip-path", `url(#${idClip})`);
  scena.appendChild(przyciete);
  svg.appendChild(scena);

  /*
    Plamy w osobnej grupie, bo po kliknięciu w mapę wstają z opóźnieniem - najpierw
    przechodzi fala, potem osiada żar. Każda plama animuje już własną przezroczystość, więc
    wspólne wejście musi mieć swój element; nakładanie dwóch animacji tej samej właściwości
    na jednym elemencie skończyłoby się tym, że jedna po prostu wygrywa.
  */
  const grupaPlam = el("g");
  przyciete.appendChild(grupaPlam);

  const plamy = barwy.map(([nazwa], i) => {
    const e = el("ellipse");
    e.setAttribute("fill", `url(#${nazwa}-${przyrostek})`);
    e.setAttribute("class", `zar-woj-plama zar-woj-plama-${i + 1}`);
    grupaPlam.appendChild(e);
    return e;
  });

  /* czoło fali - nad plamami, w tym samym przycięciu, więc zatrzymuje się na granicy */
  const fala = el("circle");
  fala.setAttribute("class", "zar-woj-fala");
  fala.setAttribute("fill", `url(#zar-woj-fala-${przyrostek})`);
  przyciete.appendChild(fala);

  kontener.insertBefore(svg, kanwa.nextSibling);

  let ksztalt: Ksztalt | null = null;

  const przelicz = () => {
    if (!ksztalt) return;
    const a = map.project(ksztalt.nw);
    const b = map.project(ksztalt.se);
    const rozpietosc = ksztalt.lokalneSE.x - ksztalt.lokalneNW.x;
    if (rozpietosc <= 0) return;
    const skala = (b.x - a.x) / rozpietosc;
    const tx = a.x - skala * ksztalt.lokalneNW.x;
    const ty = a.y - skala * ksztalt.lokalneNW.y;
    scena.setAttribute("transform", `translate(${tx} ${ty}) scale(${skala})`);
  };

  map.on("move", przelicz);
  map.on("zoom", przelicz);
  map.on("resize", przelicz);

  return {
    ustaw(geom, punkt) {
      if (!geom) {
        ksztalt = null;
        svg.classList.remove("zar-woj-widoczny");
        svg.classList.remove("zar-woj-z-fala");
        fala.classList.remove("zar-woj-fala-gra");
        grupaPlam.classList.remove("zar-woj-plamy-po-fali");
        return;
      }

      const nowy = zbudujKsztalt(geom);
      if (!nowy) {
        ksztalt = null;
        svg.classList.remove("zar-woj-widoczny");
        return;
      }

      ksztalt = nowy;
      sciezka.setAttribute("d", nowy.d);
      /* nowy wybór zaczyna od pełnej jasności - inaczej zostałaby ta z poprzedniego gaśnięcia */
      svg.style.removeProperty("opacity");

      /*
        Plamy dobieramy do rozmiaru województwa, nie do stałej liczby pikseli: mazowieckie
        jest trzy razy większe od opolskiego, a żar ma w obu wyglądać tak samo gęsto.
        Amplituda ruchu też idzie z rozmiaru - stąd zmienne w stylu, z których korzystają
        klatki animacji w globals.css.

        Promienie są wyraźnie mniejsze od samego województwa i to jest sedno: żar ma być
        ciepłym środkiem, który wygasa przed granicami, a nie wypełnieniem po brzegi.
        Przy poprzednich wartościach największa plama miała średnicę półtora raza większą
        od regionu - po dolocie kamery, kiedy województwo zajmuje cały ekran, wychodziła
        z tego pomarańczowa płachta. Najmocniej widać to na telefonie, gdzie kadr jest
        wąski i region wypełnia go w całości.
      */
      const w = nowy.lokalneSE.x - nowy.lokalneNW.x;
      const h = nowy.lokalneSE.y - nowy.lokalneNW.y;
      const cx = nowy.lokalneNW.x + w / 2;
      const cy = nowy.lokalneNW.y + h / 2;

      const rozmiary = [0.5, 0.34, 0.2];
      plamy.forEach((e, i) => {
        const f = rozmiary[i];
        e.setAttribute("cx", cx.toFixed(2));
        e.setAttribute("cy", cy.toFixed(2));
        e.setAttribute("rx", (w * f).toFixed(2));
        e.setAttribute("ry", (h * f).toFixed(2));
        e.style.setProperty("--dx", `${(w * 0.26).toFixed(2)}px`);
        e.style.setProperty("--dy", `${(h * 0.26).toFixed(2)}px`);
      });

      /*
        Fala od miejsca kliknięcia.

        Punkt przeliczamy tym samym Merkatorem, co obrys, więc trafia wprost w przestrzeń
        lokalną - nie ma potrzeby odwracać przekształcenia ekranowego, a fala jedzie razem
        z kamerą tak jak reszta warstwy.

        Promień to odległość do najdalszego narożnika prostokąta otaczającego. Fala jest
        przycięta do kształtu, więc dobicie do narożników gwarantuje, że dojdzie do każdej
        granicy - także gdy ktoś kliknie przy samej krawędzi i do przeciwnej strony jest
        trzy razy dalej.

        Animację restartujemy zdjęciem i ponownym nadaniem klasy, z wymuszonym przeliczeniem
        układu pomiędzy. Bez tego drugie kliknięcie w to samo województwo nie robiło nic:
        klasa już tam była, a przeglądarka nie ma powodu puszczać animacji od nowa.
      */
      if (punkt) {
        const p = merkator(punkt[0], punkt[1]);
        const promien = Math.max(
          Math.hypot(p.x - nowy.lokalneNW.x, p.y - nowy.lokalneNW.y),
          Math.hypot(p.x - nowy.lokalneSE.x, p.y - nowy.lokalneSE.y),
          Math.hypot(p.x - nowy.lokalneNW.x, p.y - nowy.lokalneSE.y),
          Math.hypot(p.x - nowy.lokalneSE.x, p.y - nowy.lokalneNW.y)
        );

        fala.setAttribute("cx", p.x.toFixed(2));
        fala.setAttribute("cy", p.y.toFixed(2));
        fala.setAttribute("r", promien.toFixed(2));

        fala.classList.remove("zar-woj-fala-gra");
        grupaPlam.classList.remove("zar-woj-plamy-po-fali");
        void fala.getBoundingClientRect();
        fala.classList.add("zar-woj-fala-gra");
        grupaPlam.classList.add("zar-woj-plamy-po-fali");
        svg.classList.add("zar-woj-z-fala");
      } else {
        fala.classList.remove("zar-woj-fala-gra");
        grupaPlam.classList.remove("zar-woj-plamy-po-fali");
        svg.classList.remove("zar-woj-z-fala");
      }

      svg.classList.add("zar-woj-widoczny");
      przelicz();
    },

    /*
      Wygaszanie w rytm oddalania kamery. Ustawiamy przezroczystość wprost na elemencie,
      bo to jedyna wartość zmieniana co klatkę - reszta wyglądu zostaje w arkuszu.
      Działa dopiero po zakończeniu animacji wejścia: dopóki ona trwa, to ona rządzi tą
      właściwością. Nikt nie zdąży odsunąć kamery w ciągu tych sześciuset milisekund,
      a gdyby zdążył, żar i tak zgaśnie chwilę później.
    */
    przygas(wartosc) {
      svg.style.opacity = String(Math.max(0, Math.min(1, wartosc)));
    },

    zniszcz() {
      map.off("move", przelicz);
      map.off("zoom", przelicz);
      map.off("resize", przelicz);
      svg.remove();
    },
  };
}
