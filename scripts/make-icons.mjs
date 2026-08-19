/**
 * Renderuje ikony aplikacji z jednego źródła: app/icon.svg.
 *
 *   node scripts/make-icons.mjs
 *
 * Powstają:
 *   app/favicon.ico   - 16/32/48 px dla przeglądarek pytających o /favicon.ico
 *   app/apple-icon.png - 180 px na ekran główny iPhone'a
 *
 * Skrypt uruchamiamy ręcznie po zmianie logo - pliki wynikowe siedzą w repozytorium,
 * więc build nie potrzebuje sharpa.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(path.join(root, "app", "icon.svg"));
// przy 16 px pełny rysunek zlewa się w plamę, więc najmniejsza klatka idzie z uproszczonego źródła
const svgSmall = await readFile(path.join(root, "scripts", "icon-small.svg"));

const png = (size) =>
  sharp(size <= 16 ? svgSmall : svg, { density: 384 }).resize(size, size).png().toBuffer();

/** Kontener ICO z gotowymi PNG-ami w środku - tak robią to wszystkie współczesne ikony. */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // rezerwa
  head.writeUInt16LE(1, 2); // typ: ikona
  head.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const dir = [];
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // szerokość
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // wysokość
    entry.writeUInt8(0, 2); // paleta
    entry.writeUInt8(0, 3); // rezerwa
    entry.writeUInt16LE(1, 4); // płaszczyzny
    entry.writeUInt16LE(32, 6); // bity na piksel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    dir.push(entry);
  }

  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)]);
}

const sizes = [16, 32, 48];
const images = [];
for (const size of sizes) images.push({ size, data: await png(size) });

await writeFile(path.join(root, "app", "favicon.ico"), ico(images));
await writeFile(path.join(root, "app", "apple-icon.png"), await png(180));

console.log(`ikony gotowe: favicon.ico (${sizes.join("/")} px) + apple-icon.png (180 px)`);
