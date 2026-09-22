/**
 * Piłki na stojak wyróżnień - z arkusza dziewięciu szklanych kul.
 *
 *   node scripts/pilki-wyroznien.mjs <arkusz-3x3.jfif>
 *
 * CO POWSTAJE
 *
 *   public/wyroznienia/pilka-<barwa>.webp  - siedemnaście barw wyróżnień
 *   public/wyroznienia/pilka-zimna.webp    - wygaszona, dla niezdobytych
 *
 * PO PRZEGENEROWANIU PODNIEŚ `WERSJA` w `components/StojakWyroznien.tsx`. Nazwy plików są
 * stałe, a przeglądarka trzyma je cztery godziny - bez zmiany adresu dalej rysuje stare
 * kule, choć na serwerze leżą już nowe. Objaw myli, bo wygląda jak niewdrożona zmiana.
 *
 * KULE MAJĄ RÓŻNE UŁOŻENIA. Poprzednia wersja robiła wszystkie barwy z JEDNEGO zdjęcia,
 * więc wszystkie kule na półce były identyczne co do szwu - komplet, owszem, ale i osiem
 * kopii tej samej rzeczy. Tutaj każdy kolor bierze INNĄ kulę z arkusza, obróconą inaczej,
 * a do palety serwisu dostraja się samym obrotem odcienia. Światło, szkło i połysk zostają
 * z oryginału, bo obrót odcienia nie rusza ani jasności, ani nasycenia.
 *
 * DLACZEGO MASKA KOŁA, A NIE ALFA Z JASNOŚCI. Te kule są ze szkła: ich brzeg bywa ciemny,
 * a świeci dopiero rdzeń w środku. Alfa liczona z jasności zjadłaby cały ciemny obrys
 * i z piłki zostałaby świecąca kropka. Wycinamy więc koło - promień mierzymy w arkuszu,
 * w najszerszym wierszu kuli, bo szerokość jest wiarygodna tam, gdzie wysokość ginie
 * w czerni.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const KATALOG = "public/wyroznienia";
const BOK = 320;

/*
  Skąd którą kulę bierzemy i na jaki odcień ją przestrajamy. Każde z siedemnastu wyróżnień
  ma WŁASNĄ barwę, a kul w arkuszu jest dziewięć - więc źródła się powtarzają i część kul
  dzieli ułożenie. To świadoma zgoda: siedemnaście różnych kolorów czyta się jako
  siedemnaście różnych rzeczy nawet przy powtórzonym szwie, a odwrotnie już nie.

  Źródło dobiera NAJBLIŻSZY odcień, żeby obrót był jak najmniejszy - zielona kula na
  limonkę, nie na róż; przy dużym obrocie barwne refleksy w szkle kłócą się z rdzeniem.
  Z jednym zastrzeżeniem: sąsiedzi na liście nie mogą mieć tego samego źródła, bo na półce
  stoją obok siebie i powtórzone ułożenie widać wtedy od razu.

  Pozycje w arkuszu liczone od zera, [wiersz, kolumna].
*/
const PRZYDZIAL = [
  { nazwa: "czerwien", zrodlo: [2, 1], cel: [245, 117, 117] },
  { nazwa: "miedz", zrodlo: [0, 1], cel: [226, 146, 96] },
  { nazwa: "zloto", zrodlo: [0, 2], cel: [255, 197, 106] },
  { nazwa: "bursztyn", zrodlo: [0, 1], cel: [245, 228, 117] },
  { nazwa: "cytryna", zrodlo: [0, 2], cel: [232, 245, 117] },
  { nazwa: "limonka", zrodlo: [1, 0], cel: [190, 234, 96] },
  { nazwa: "trawa", zrodlo: [0, 2], cel: [151, 245, 117] },
  { nazwa: "szmaragd", zrodlo: [1, 0], cel: [117, 245, 151] },
  { nazwa: "mieta", zrodlo: [2, 0], cel: [106, 232, 190] },
  { nazwa: "turkus", zrodlo: [1, 1], cel: [117, 245, 245] },
  { nazwa: "lazur", zrodlo: [2, 0], cel: [108, 204, 255] },
  { nazwa: "blekit", zrodlo: [1, 1], cel: [126, 166, 255] },
  { nazwa: "szafir", zrodlo: [1, 2], cel: [117, 117, 245] },
  { nazwa: "fiolet", zrodlo: [2, 2], cel: [178, 138, 255] },
  { nazwa: "ametyst", zrodlo: [1, 2], cel: [213, 117, 245] },
  { nazwa: "magenta", zrodlo: [0, 0], cel: [245, 117, 219] },
  { nazwa: "roza", zrodlo: [2, 1], cel: [255, 138, 178] },
];
/* Dziewiąta kula zostaje na wygaszoną - żadna barwa wyróżnień jej nie potrzebuje. */
const ZIMNA = [2, 1];

const odcienZRgb = (r, g, b) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  if (d === 0) return 0;
  const [R, G, B] = [r / 255, g / 255, b / 255];
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return (h * 60 + 360) % 360;
};

/** Środek i promień kuli w danej komórce arkusza - mierzone, nie zgadywane. */
function znajdzKule(szary, W, ox, oy, cw, ch) {
  const PROG = 90;
  /*
    Najszerszy wiersz kuli wyznacza i środek w pionie, i promień. Ramka progowa liczona
    wprost dawała szerokość zgodną co do piksela, ale wysokość mniejszą nawet o 80 px -
    tam, gdzie szkło u góry albo u dołu jest ciemne, próg go nie widzi.
  */
  let najlepszyY = 0;
  let najszerszy = 0;
  let lewy = 0;
  let prawy = 0;
  for (let y = 0; y < ch; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < cw; x++) {
      if (szary[(oy + y) * W + ox + x] > PROG) {
        if (a < 0) a = x;
        b = x;
      }
    }
    if (a >= 0 && b - a > najszerszy) {
      najszerszy = b - a;
      najlepszyY = y;
      lewy = a;
      prawy = b;
    }
  }
  return {
    cx: ox + (lewy + prawy) / 2,
    cy: oy + najlepszyY,
    promien: najszerszy / 2,
  };
}

/** Dominujący odcień kuli - po nim liczymy, o ile ją obrócić. */
function odcienKuli(rgb, W, cx, cy, promien) {
  let sin = 0;
  let cos = 0;
  const r = promien * 0.62; // sam rdzeń, bez szklanego brzegu
  for (let y = Math.round(cy - r); y <= cy + r; y += 2) {
    for (let x = Math.round(cx - r); x <= cx + r; x += 2) {
      const i = (y * W + x) * 3;
      const [R, G, B] = [rgb[i], rgb[i + 1], rgb[i + 2]];
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      if (max - min < 40 || max < 60) continue;
      const waga = (max - min) / 255;
      const rad = (odcienZRgb(R, G, B) * Math.PI) / 180;
      sin += Math.sin(rad) * waga;
      cos += Math.cos(rad) * waga;
    }
  }
  return ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360;
}

/** Obrót odcienia o zadany kąt - jasność i nasycenie zostają nietknięte. */
function obrocOdcien(buf, kat) {
  const rad = (kat * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  /* Macierz obrotu odcienia w przestrzeni RGB - tania i nie wymaga konwersji tam i z powrotem. */
  const m = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  for (let i = 0; i < buf.length; i += 4) {
    const [r, g, b] = [buf[i], buf[i + 1], buf[i + 2]];
    buf[i] = Math.max(0, Math.min(255, m[0] * r + m[1] * g + m[2] * b));
    buf[i + 1] = Math.max(0, Math.min(255, m[3] * r + m[4] * g + m[5] * b));
    buf[i + 2] = Math.max(0, Math.min(255, m[6] * r + m[7] * g + m[8] * b));
  }
  return buf;
}

const arkusz = process.argv[2];
if (!arkusz) {
  console.error("Użycie: node scripts/pilki-wyroznien.mjs <arkusz-3x3.jfif>");
  process.exit(1);
}

await mkdir(KATALOG, { recursive: true });

const szary = await sharp(arkusz).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = szary.info.width;
const H = szary.info.height;
const kolor = await sharp(arkusz).removeAlpha().raw().toBuffer();
const cw = Math.floor(W / 3);
const ch = Math.floor(H / 3);

/*
  Maska koła ze zmiękczoną krawędzią. Bez zmiękczenia brzeg kuli jest ząbkowany, a przy
  siedemnastu piłkach naraz widać to od pierwszego spojrzenia.
*/
function maskaKola(promienWyjscia) {
  return Buffer.from(
    `<svg width="${BOK}" height="${BOK}"><defs><radialGradient id="m">
       <stop offset="${((promienWyjscia - 2) / promienWyjscia).toFixed(3)}" stop-color="#fff"/>
       <stop offset="1" stop-color="#000"/>
     </radialGradient></defs>
     <circle cx="${BOK / 2}" cy="${BOK / 2}" r="${promienWyjscia}" fill="url(#m)"/></svg>`
  );
}

async function wytnij([ry, rx]) {
  const { cx, cy, promien } = znajdzKule(szary.data, W, rx * cw, ry * ch, cw, ch);
  const luz = Math.round(promien * 0.03);
  const bok = Math.round((promien + luz) * 2);
  const kadr = {
    left: Math.max(0, Math.round(cx - bok / 2)),
    top: Math.max(0, Math.round(cy - bok / 2)),
    width: bok,
    height: bok,
  };
  const odcien = odcienKuli(kolor, W, cx, cy, promien);
  const rgba = await sharp(arkusz).extract(kadr).resize(BOK, BOK).ensureAlpha().raw().toBuffer();
  const promienWy = (promien / (bok / 2)) * (BOK / 2);
  return { rgba, odcien, maska: maskaKola(promienWy), gdzie: `[${ry},${rx}] r=${Math.round(promien)}` };
}

const zapisz = (buf, maska, plik, po = (s) => s) =>
  po(sharp(buf, { raw: { width: BOK, height: BOK, channels: 4 } }))
    .composite([{ input: maska, blend: "dest-in" }])
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(path.join(KATALOG, plik));

for (const { nazwa, zrodlo, cel } of PRZYDZIAL) {
  const { rgba, odcien, maska, gdzie } = await wytnij(zrodlo);
  const kat = ((odcienZRgb(...cel) - odcien + 540) % 360) - 180;
  await zapisz(obrocOdcien(rgba, kat), maska, `pilka-${nazwa}.webp`);
  console.log(`${nazwa.padEnd(8)} ${gdzie} odcien ${Math.round(odcien)}° -> ${Math.round(odcienZRgb(...cel))}° (obrot ${Math.round(kat)}°)`);
}

/*
  Wygaszona: bez barwy i przyciemniona, żeby półka pełna odróżniała się od pustej.

  `greyscale`, a nie `saturation: 0.12`: przy samym zbiciu nasycenia po czerwono-
  pomarańczowej kuli źródłowej zostawał ciepły, brązowawy nalot i niezdobyte wyróżnienia
  wyglądały na własną barwę, tylko przygaszoną. Odbarwiamy więc do zera i dopiero wtedy
  dokładamy chłodny grafit - żeby to czytało się jako „puste miejsce", a nie „brązowe".
*/
const zimna = await wytnij(ZIMNA);
await zapisz(zimna.rgba, zimna.maska, "pilka-zimna.webp", (s) =>
  s.greyscale().linear(0.66, -6).tint({ r: 176, g: 186, b: 205 })
);
console.log(`zimna    ${zimna.gdzie}`);
console.log("gotowe ->", KATALOG);
