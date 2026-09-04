import { PhotoKind } from "@/lib/types";

/**
 * Rysunek kadru: to samo boisko obejrzane z miejsca, w którym ma stanąć fotografujący.
 * Linie liczy prawdziwy rzut perspektywiczny modelu boiska 28 × 15 m, więc kadry są
 * spójne między sobą. Jeden komponent obsługuje kafelki w tutorialu i nakładkę
 * na podgląd z aparatu (`mode="overlay"`).
 */

/* ------------------------------------------------------------------ */
/*  Rzut perspektywiczny z automatycznym kadrowaniem                   */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number];
type Pt = [number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

type Ink = "edge" | "line" | "struct" | "rim" | "net" | "paint" | "crack" | "grain";

interface Shape {
  ink: Ink;
  pts: Vec3[];
  closed?: boolean;
  /** wypełnienie zamiast konturu: płyta boiska, pas malowanej linii */
  filled?: boolean;
}

interface Scene {
  eye: Vec3;
  target: Vec3;
  shapes: Shape[];
  /**
   * Punkty, które muszą wejść w kadr. Reszta geometrii może wyjść za krawędź -
   * dokładnie tak, jak na prawdziwym zdjęciu. Bez tego kadruje się całą scenę.
   */
  frame?: Vec3[];
}

/** Rzutuje punkt na płaszczyznę kamery i dopasowuje skalę do viewBoxa. */
function makeProjector(scene: Scene, w: number, h: number, pad: number) {
  const forward = unit(sub(scene.target, scene.eye));
  // przy patrzeniu prosto w dół pion przestaje być użyteczny jako odniesienie
  const upRef: Vec3 = Math.abs(forward[2]) > 0.985 ? [1, 0, 0] : [0, 0, 1];
  const right = unit(cross(forward, upRef));
  const up = cross(right, forward);

  const raw = (p: Vec3): Pt => {
    const d = sub(p, scene.eye);
    const depth = Math.max(dot(d, forward), 0.08);
    return [dot(d, right) / depth, -dot(d, up) / depth];
  };

  const fitted = (scene.frame ?? scene.shapes.flatMap((s) => s.pts)).map(raw);
  const xs = fitted.map((p) => p[0]);
  const ys = fitted.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxX + minX) * scale) / 2;
  const oy = (h - (maxY + minY) * scale) / 2;

  return (p: Vec3): Pt => {
    const q = raw(p);
    return [q[0] * scale + ox, q[1] * scale + oy];
  };
}

const toPath = (pts: Pt[], closed?: boolean) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
  (closed ? " Z" : "");

/* ------------------------------------------------------------------ */
/*  Model boiska (metry; x = długość, y = szerokość, z = wysokość)      */
/* ------------------------------------------------------------------ */

const L = 28;
const W = 15;
const MID = W / 2;

const quad = (x1: number, y1: number, x2: number, y2: number, z = 0): Vec3[] => [
  [x1, y1, z],
  [x2, y1, z],
  [x2, y2, z],
  [x1, y2, z],
];

const ring = (cx: number, cy: number, r: number, z = 0, steps = 40): Vec3[] =>
  Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as Vec3;
  });

const arc = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  z = 0,
  steps = 32
): Vec3[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / steps;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as Vec3;
  });

/** Pole trzech sekund i linia rzutów wolnych przy linii końcowej x0. */
function keyLines(x0: number): Shape[] {
  const dir = x0 === 0 ? 1 : -1;
  return [
    { ink: "line", pts: quad(x0, MID - 2.45, x0 + dir * 5.8, MID + 2.45), closed: true },
    { ink: "line", pts: ring(x0 + dir * 5.8, MID, 1.8) },
  ];
}

/** Łuk za trzy punkty z prostymi odcinkami przy liniach bocznych. */
function threePoint(x0: number): Shape[] {
  const dir = x0 === 0 ? 1 : -1;
  const bx = x0 + dir * 1.575;
  const reach = Math.sqrt(6.75 ** 2 - (MID - 0.9) ** 2); // 1.42 m za środkiem obręczy
  const theta = Math.atan2(MID - 0.9, reach);
  return [
    { ink: "line", pts: [[x0, 0.9, 0], [bx + dir * reach, 0.9, 0]] },
    { ink: "line", pts: [[x0, W - 0.9, 0], [bx + dir * reach, W - 0.9, 0]] },
    {
      ink: "line",
      pts: arc(
        bx,
        MID,
        6.75,
        dir > 0 ? -theta : Math.PI + theta,
        dir > 0 ? theta : Math.PI - theta
      ),
    },
  ];
}

/** Tablica, obręcz, siatka i konstrukcja jednego kosza. */
function hoop(x0: number, { net = true, mesh = false }: { net?: boolean; mesh?: boolean } = {}) {
  const dir = x0 === 0 ? 1 : -1;
  const face = x0 + dir * 1.2; // płaszczyzna tablicy
  const rimX = x0 + dir * 1.575;
  const poleX = x0 - dir * 0.7;

  const shapes: Shape[] = [
    { ink: "struct", pts: [[poleX, MID, 0], [poleX, MID, 3.45]] },
    { ink: "struct", pts: [[poleX, MID, 3.45], [face, MID, 3.45]] },
    { ink: "struct", pts: [[poleX, MID, 2.95], [face, MID, 2.95]] },
    {
      ink: "struct",
      pts: [
        [face, MID - 0.9, 2.9],
        [face, MID + 0.9, 2.9],
        [face, MID + 0.9, 3.95],
        [face, MID - 0.9, 3.95],
      ],
      closed: true,
    },
    {
      ink: "line",
      pts: [
        [face, MID - 0.295, 3.05],
        [face, MID + 0.295, 3.05],
        [face, MID + 0.295, 3.5],
        [face, MID - 0.295, 3.5],
      ],
      closed: true,
    },
    // mocowanie obręczy do tablicy
    { ink: "struct", pts: [[face, MID, 3.05], [rimX - dir * 0.225, MID, 3.05]] },
    { ink: "rim", pts: ring(rimX, MID, 0.225, 3.05, 32), closed: true },
  ];

  if (net) {
    const strands = mesh ? 16 : 12;
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * Math.PI * 2;
      const step = (Math.PI * 2) / strands;
      shapes.push({
        ink: "net",
        pts: [
          [rimX + Math.cos(a) * 0.225, MID + Math.sin(a) * 0.225, 3.05],
          [rimX + Math.cos(a + step) * 0.2, MID + Math.sin(a + step) * 0.2, 2.9],
          [rimX + Math.cos(a) * 0.17, MID + Math.sin(a) * 0.17, 2.75],
          [rimX + Math.cos(a + step) * 0.145, MID + Math.sin(a + step) * 0.145, 2.62],
        ],
      });
      if (mesh) {
        // druga rodzina nitek w przeciwną stronę - z bliska siatka ma romby
        shapes.push({
          ink: "net",
          pts: [
            [rimX + Math.cos(a) * 0.225, MID + Math.sin(a) * 0.225, 3.05],
            [rimX + Math.cos(a - step) * 0.2, MID + Math.sin(a - step) * 0.2, 2.9],
            [rimX + Math.cos(a) * 0.17, MID + Math.sin(a) * 0.17, 2.75],
            [rimX + Math.cos(a - step) * 0.145, MID + Math.sin(a - step) * 0.145, 2.62],
          ],
        });
      }
    }
    shapes.push({ ink: "net", pts: ring(rimX, MID, 0.2, 2.9, 28), closed: true });
    shapes.push({ ink: "net", pts: ring(rimX, MID, 0.145, 2.62, 28), closed: true });
  }

  return shapes;
}

/** Całe boisko: płyta, wszystkie linie, oba kosze. */
function fullCourt(): Shape[] {
  return [
    { ink: "edge", pts: quad(0, 0, L, W), closed: true, filled: true },
    { ink: "edge", pts: quad(0, 0, L, W), closed: true },
    { ink: "line", pts: [[L / 2, 0, 0], [L / 2, W, 0]] },
    { ink: "line", pts: ring(L / 2, MID, 1.8) },
    ...keyLines(0),
    ...threePoint(0),
    ...keyLines(L),
    ...threePoint(L),
    ...hoop(0, { net: false }),
    ...hoop(L, { net: false }),
  ];
}

/** Prosty deterministyczny generator - rysunek ma zawsze wyglądać tak samo. */
function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Detal nawierzchni z bliska: wycinek około metra na metr - pas malowanej linii,
 * spękania i ziarno kruszywa. Dopiero w takim zbliżeniu widać stan płyty.
 */
function surfacePatch(): Shape[] {
  const shapes: Shape[] = [
    // sama płyta - wypełnienie z zapasem poza kadr, żeby czytało się jako podłoże
    { ink: "edge", pts: quad(0.5, 3, 11, 12.5), closed: true, filled: true },
    // linia boiska: 5 cm farby biegnące przez kadr
    { ink: "paint", pts: quad(4.3, MID - 0.025, 6.3, MID + 0.025), closed: true, filled: true },
  ];

  const cracks: Vec3[][] = [
    [[4.62, 7.02, 0], [4.78, 7.2, 0], [4.72, 7.4, 0], [4.9, 7.62, 0], [4.86, 7.9, 0]],
    [[4.78, 7.2, 0], [5.02, 7.24, 0]],
    [[5.32, 7.05, 0], [5.44, 7.3, 0], [5.7, 7.38, 0], [5.82, 7.62, 0]],
    [[5.44, 7.3, 0], [5.36, 7.55, 0]],
    [[5.05, 7.86, 0], [5.3, 7.95, 0], [5.42, 8.15, 0]],
    [[5.95, 7.15, 0], [6.05, 7.44, 0]],
  ];
  cracks.forEach((pts) => shapes.push({ ink: "crack", pts }));

  // ziarno kruszywa - drobne kółka rozsypane po całym wycinku
  const rand = rnd(20260817);
  for (let i = 0; i < 60; i++) {
    const x = 4.45 + rand() * 1.75;
    const y = 6.95 + rand() * 1.3;
    if (Math.abs(y - MID) < 0.04) continue;
    shapes.push({ ink: "grain", pts: ring(x, y, 0.006 + rand() * 0.009, 0, 6), closed: true });
  }

  return shapes;
}

/* ------------------------------------------------------------------ */
/*  Scena dla każdego kadru                                            */
/* ------------------------------------------------------------------ */

/** Kadr kosza: od płyty pod obręczą do kawałka nieba nad tablicą. */
function hoopFrame(x0: number): Vec3[] {
  const dir = x0 === 0 ? 1 : -1;
  return [
    [x0 + dir * 1.2, MID - 1.35, 4.35],
    [x0 + dir * 1.2, MID + 1.35, 4.35],
    [x0 + dir * 1.6, MID - 2.1, 0],
    [x0 + dir * 1.6, MID + 2.1, 0],
  ];
}

/** Kosz z podłogą pod nim, ale bez dalekiej połowy boiska. */
function hoopScene(x0: number, eye: Vec3): Scene {
  const dir = x0 === 0 ? 1 : -1;
  return {
    eye,
    target: [x0 + dir * 1.575, MID, 2.9],
    shapes: [
      { ink: "edge", pts: [[x0, 0, 0], [x0, W, 0]] },
      ...keyLines(x0),
      ...threePoint(x0),
      ...hoop(x0),
    ],
    frame: hoopFrame(x0),
  };
}

const SCENES: Record<PhotoKind, () => Scene> = {
  // 1. całość z narożnika - kadr tytułowy
  "narożnik": () => ({
    eye: [-4, -5, 4.2],
    target: [16, MID, 0.5],
    shapes: fullCourt(),
  }),

  // 2. kosz A na wprost
  "kosz-a": () => hoopScene(0, [8.6, MID + 0.4, 1.6]),

  // 3. kosz B - kamera lekko z boku, żeby kadr nie był kopią kosza A
  "kosz-b": () => hoopScene(L, [L - 8, MID - 1.1, 1.65]),

  // 4. detal obręczy i siatki
  "detal-kosza": () => ({
    eye: [2.85, MID + 1.45, 2.62],
    target: [1.6, MID, 2.98],
    shapes: hoop(0, { mesh: true }),
    frame: [
      ...ring(1.575, MID, 0.34, 3.05, 10),
      [1.575, MID, 2.5],
      [1.575, MID, 3.45],
    ],
  }),

  // 5. nawierzchnia z bliska
  nawierzchnia: () => ({
    eye: [5.05, MID + 1.05, 1.35],
    target: [5.32, MID + 0.05, 0],
    shapes: surfacePatch(),
    frame: [
      [4.45, 6.9, 0],
      [6.25, 6.9, 0],
      [4.45, 8.3, 0],
      [6.25, 8.3, 0],
    ],
  }),

  // 6. całość z drugiej strony - od linii bocznej
  "ogólne-2": () => ({
    eye: [L / 2 + 1.5, -10.5, 3.3],
    target: [L / 2, MID, 1.1],
    shapes: fullCourt(),
  }),

  // dodatkowe: przeciwny narożnik, ujęcie zza linii końcowej, widok z góry
  "narożnik-2": () => ({
    eye: [L + 8.5, W + 9.5, 6.4],
    target: [12.5, MID, 0.5],
    shapes: fullCourt(),
  }),
  "ogólne-1": () => ({
    eye: [-10, MID + 0.5, 3.2],
    target: [15, MID, 1.1],
    shapes: fullCourt(),
  }),
  "ogólne-3": () => ({
    eye: [-5, W + 14, 13],
    target: [15, MID - 1, 0.4],
    shapes: fullCourt(),
  }),
};

/* ------------------------------------------------------------------ */
/*  Render                                                             */
/* ------------------------------------------------------------------ */

interface InkStyle {
  stroke: string;
  width: number;
  dash?: string;
  fill?: string;
}

const TILE_INK: Record<Ink, InkStyle> = {
  edge: { stroke: "rgba(255,255,255,0.6)", width: 2.4, fill: "rgba(255,255,255,0.05)" },
  line: { stroke: "rgba(255,255,255,0.32)", width: 1.5 },
  struct: { stroke: "rgba(255,255,255,0.5)", width: 2 },
  rim: { stroke: "var(--color-flame)", width: 3.6 },
  net: { stroke: "rgba(255,255,255,0.34)", width: 1.2 },
  paint: { stroke: "none", width: 0, fill: "rgba(255,255,255,0.46)" },
  crack: { stroke: "rgba(255,255,255,0.36)", width: 1.7 },
  grain: { stroke: "rgba(255,255,255,0.16)", width: 1 },
};

const OVERLAY_INK: Record<Ink, InkStyle> = {
  edge: { stroke: "rgb(var(--rgb-glow) / 0.9)", width: 2.6 },
  line: { stroke: "rgb(var(--rgb-glow) / 0.45)", width: 1.6, dash: "7 7" },
  struct: { stroke: "rgb(var(--rgb-glow) / 0.85)", width: 2.2 },
  rim: { stroke: "var(--color-flame)", width: 3.4 },
  net: { stroke: "rgb(var(--rgb-glow) / 0.4)", width: 1.2 },
  paint: { stroke: "none", width: 0, fill: "rgb(var(--rgb-glow) / 0.75)" },
  crack: { stroke: "rgb(var(--rgb-glow) / 0.4)", width: 1.4 },
  grain: { stroke: "rgb(var(--rgb-glow) / 0.2)", width: 1 },
};

export function ShotDiagram({
  kind,
  mode = "tile",
  className = "",
}: {
  kind: PhotoKind;
  mode?: "tile" | "overlay";
  className?: string;
}) {
  const w = 800;
  const h = 600;
  const scene = SCENES[kind]();
  const project = makeProjector(scene, w, h, mode === "overlay" ? 58 : 44);
  const inks = mode === "overlay" ? OVERLAY_INK : TILE_INK;
  const uid = kind.replace(/[^a-z0-9]/gi, "") || "kadr";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-full w-full ${className}`}
      role="img"
      aria-label="Schemat kadru"
    >
      {mode === "tile" && (
        <>
          <defs>
            <radialGradient id={`shot-bg-${uid}`} cx="0.5" cy="0.12" r="0.95">
              <stop offset="0" stopColor="#17191d" />
              <stop offset="1" stopColor="#0a0b0d" />
            </radialGradient>
          </defs>
          <rect width={w} height={h} fill={`url(#shot-bg-${uid})`} />
        </>
      )}

      {scene.shapes.map((shape, i) => {
        // wypełnienia to płyta boiska i pas farby - na nakładce zostaje sam kontur
        if (shape.filled && mode === "overlay" && shape.ink !== "paint") return null;
        const style = inks[shape.ink];
        const filled = !!shape.filled;
        return (
          <path
            key={i}
            d={toPath(shape.pts.map(project), shape.closed)}
            fill={filled ? style.fill ?? "none" : "none"}
            stroke={filled ? "none" : style.stroke}
            strokeWidth={style.width}
            strokeDasharray={style.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
