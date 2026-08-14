/**
 * MapLibre 6 wylicza adres swojego workera z `import.meta.url`. Turbopack przepisuje
 * moduły na własne chunki, więc ta ścieżka prowadzi w pustkę (404 → HTML) i mapa nie
 * renderuje ani kafelków, ani warstw. Kopiujemy worker do /public i wskazujemy go
 * jawnie przez setWorkerUrl() w components/MapView.tsx.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

await mkdir(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(from, file), join(to, file));
}
console.log("maplibre worker -> public/maplibre");
