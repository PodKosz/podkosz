/**
 * Grafiki do stojaka z wyróżnieniami.
 *
 * Jednorazowy skrypt: bierze dwa zdjęcia źródłowe i robi z nich komplet plików, które
 * wchodzą do repozytorium. Uruchamia się ręcznie, nie przy każdym budowaniu - źródła nie
 * są w repo (ważą 4 MB) i nie ma powodu, żeby były.
 *
 *   node scripts/stojak-wyroznien.mjs <zdjęcie-stojaka> <zdjęcie-piłki>
 *
 * CO POWSTAJE
 *
 *   public/wyroznienia/stojak.webp   - stojak z TŁEM WYCIĘTYM DO PRZEZROCZYSTOŚCI
 *   public/wyroznienia/pilka-*.webp  - ta sama piłka w ośmiu barwach wyróżnień
 *   public/wyroznienia/pilka-zimna.webp - wygaszona, dla niezdobytych
 *
 * DLACZEGO ALFA Z JASNOŚCI. Stojak jest białym szkłem na czerni. Zwykłe wycięcie progiem
 * zostawiłoby twardą obwódkę i zabiło poświatę, która jest tu połową efektu. Kanał alfa
 * bierzemy więc wprost z jasności: czarne tło ma zero, szkło ma pełne krycie, a wszystko
 * pomiędzy - łunę - zachowuje swoją miękkość. Dzięki temu stojak wchodzi na dowolne tło
 * strony bez czarnego prostokąta pod spodem.
 *
 * DLACZEGO PIŁKI SĄ ODBARWIANE, A POTEM MALOWANE. Źródłem jest jedno zdjęcie limonkowej
 * piłki. Odbarwienie do samej jasności zostawia to, co w niej cenne - ziarno skóry, szwy
 * i światło - a odbiera kolor, który potem nakładamy ośmioma barwami wyróżnień. Osiem
 * osobnych zdjęć nie trzymałoby wspólnego oświetlenia i każda piłka wyglądałaby jak
 * z innego kompletu.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const KATALOG = "public/wyroznienia";

/*
  Barwy piłek to NASYCONE odpowiedniki palety wyróżnień z `.barwa-*` w globals.css.
  Paleta w arkuszu jest pastelowa, bo dobierano ją do stempli wielkości paznokcia; piłka
  ma kilkadziesiąt razy większą powierzchnię i przy tamtych wartościach wychodziła
  wyblakła. Odcień zostaje ten sam, zmienia się tylko nasycenie - więc kropka w okienku
  i piłka nadal czytają się jako ten sam kolor.
*/
const BARWY = {
  zloto: { r: 255, g: 176, b: 32 },
  limonka: { r: 190, g: 240, b: 60 },
  fiolet: { r: 155, g: 92, b: 255 },
  lazur: { r: 43, g: 182, b: 255 },
  roza: { r: 255, g: 77, b: 141 },
  mieta: { r: 31, g: 217, b: 164 },
  blekit: { r: 76, g: 123, b: 255 },
  miedz: { r: 232, g: 112, b: 42 },
};

/** Stojak: kadr do samej konstrukcji i tło wycięte jasnością. */
async function stojak(zrodlo) {
  const { data, info } = await sharp(zrodlo).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  /* Ramka liczona progiem, nie na oko - zdjęcie ma sporo czarnego marginesu. */
  const PROG = 70;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] > PROG) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  /* Luz na łunę, która sięga dalej niż samo szkło. */
  const luz = Math.round((x1 - x0) * 0.035);
  const kadr = {
    left: Math.max(0, x0 - luz),
    top: Math.max(0, y0 - luz),
    width: Math.min(W, x1 + luz) - Math.max(0, x0 - luz),
    height: Math.min(H, y1 + luz) - Math.max(0, y0 - luz),
  };

  /* Kolumna profilu ma najwyżej 1104 px - 1280 daje zapas na ekrany o gęstym pikselu,
     a 1600 (pierwsza wersja) ważyło 612 kB za nic. */
  const SZER = 1280;
  const kolor = sharp(zrodlo).extract(kadr).resize({ width: SZER });
  const alfa = await sharp(zrodlo)
    .extract(kadr)
    .resize({ width: SZER })
    .greyscale()
    /* Delikatna krzywa: tło do zera, szkło do pełni, łuna zachowana pośrodku. */
    .linear(1.35, -14)
    .raw()
    .toBuffer();

  const rgb = await kolor.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = rgb.info;
  const wyjscie = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    wyjscie[i * 4] = rgb.data[i * channels];
    wyjscie[i * 4 + 1] = rgb.data[i * channels + 1];
    wyjscie[i * 4 + 2] = rgb.data[i * channels + 2];
    wyjscie[i * 4 + 3] = alfa[i];
  }

  await sharp(wyjscie, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 88 })
    .toFile(path.join(KATALOG, "stojak.webp"));

  return { kadr, w, h };
}

/** Piłka: kadr do kuli, maska koła, odbarwienie - i osiem odmian barwnych. */
async function pilki(zrodlo) {
  const { data, info } = await sharp(zrodlo).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  /* Kula jest limonkowa i jasna - po tym ją znajdujemy, bez zgadywania współrzędnych. */
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (data[i + 1] > 150 && data[i + 1] > data[i] + 25 && data[i + 1] > data[i + 2] + 60) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  const cx = Math.round((x0 + x1) / 2);
  const cy = Math.round((y0 + y1) / 2);
  const promien = Math.round(Math.max(x1 - x0, y1 - y0) / 2);
  const bok = promien * 2 + 8;
  const kadr = { left: cx - bok / 2, top: cy - bok / 2, width: bok, height: bok };

  /* Piłka wyświetla się przy 130 px; 320 starcza na podwójną gęstość i mieści się
     w 35 kB zamiast 90. Przy siedemnastu piłkach to różnica rzędu megabajta. */
  const BOK = 320;
  /*
    Maska koła z włosowym zmiękczeniem na krawędzi. Bez niego brzeg piłki jest ząbkowany,
    a przy dziewiętnastu piłkach na ekranie widać to od razu.
  */
  const r = (promien / (bok / 2)) * (BOK / 2) - 1;
  const maska = Buffer.from(
    `<svg width="${BOK}" height="${BOK}"><circle cx="${BOK / 2}" cy="${BOK / 2}" r="${r.toFixed(1)}" fill="#fff"/></svg>`
  );

  /*
    Jasność w DÓŁ, nie w górę. `tint` odwzorowuje jasność na barwę, więc wszystko, co
    w odbarwionym zdjęciu jest blisko bieli, zostaje białe niezależnie od koloru - a górna
    połowa piłki właśnie taka była. Przy pierwszej próbie wychodziły z tego kule wybielone
    od góry, z kolorem tylko przy dolnej krawędzi. Ściągnięcie zakresu w dół zostawia
    światłu miejsce na barwę.
  */
  const szara = await sharp(zrodlo)
    .extract(kadr)
    .resize(BOK, BOK)
    .greyscale()
    .linear(0.82, 2)
    .toBuffer();

  for (const [nazwa, kolor] of Object.entries(BARWY)) {
    await sharp(szara)
      .tint(kolor)
      /* Po barwieniu jeszcze nasycenie - piłka ma być soczysta, nie przypudrowana. */
      .modulate({ saturation: 1.3, brightness: 1.05 })
      .composite([{ input: maska, blend: "dest-in" }])
      .webp({ quality: 90, alphaQuality: 95 })
      .toFile(path.join(KATALOG, `pilka-${nazwa}.webp`));
  }

  /* Wygaszona: ta sama piłka, przyciemniona i lekko schłodzona. */
  await sharp(szara)
    .linear(0.42, -8)
    .tint({ r: 150, g: 160, b: 178 })
    .composite([{ input: maska, blend: "dest-in" }])
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(path.join(KATALOG, "pilka-zimna.webp"));

  return { kadr, promien };
}

const [, , zrodloStojaka, zrodloPilki] = process.argv;
if (!zrodloStojaka || !zrodloPilki) {
  console.error("Użycie: node scripts/stojak-wyroznien.mjs <stojak.jpg> <pilka.jpg>");
  process.exit(1);
}

await mkdir(KATALOG, { recursive: true });
const s = await stojak(zrodloStojaka);
const p = await pilki(zrodloPilki);
console.log("stojak:", JSON.stringify(s));
console.log("piłka:", JSON.stringify(p));
console.log("gotowe ->", KATALOG);
