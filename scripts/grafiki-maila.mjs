/*
  Grafiki do maili powitalnych.

  W mailu nie da się użyć SVG ani CSS-owych gradientów - Gmail i Outlook je wycinają.
  Dlatego stylistykę strony (czarne tło, pomarańczowe światła, kontur boiska, logo)
  wypalamy tutaj w PNG-i, a szablon wskazuje je adresem na podkosz.pl. Zasłona przed
  premierą ich nie zasłania: matcher w middleware.ts pomija pliki .png.

  Uruchomienie:  node scripts/grafiki-maila.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const WYJSCIE = path.join(KATALOG, "..", "public", "mail");
const CZ = "Segoe UI, Arial, sans-serif";

/* ---------- tło: czerń, pomarańczowe światła i kontur boiska ---------- */

/*
  Kontur przepisany z components/CourtOutline.tsx. Rysunek ma 840x460 i wsadzamy go
  w grupę ze skalą, więc wszystkie współrzędne zostają takie jak na stronie.
*/
const BOISKO = `
  <g stroke="url(#linia)" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <rect x="40" y="40" width="760" height="380" rx="6" stroke-width="2.4"/>
    <path d="M420 40v380" stroke-width="1.6" stroke="rgba(255,178,92,0.5)"/>
    <circle cx="420" cy="230" r="62" stroke-width="1.8"/>
    <path d="M40 140h150v180H40" stroke-width="1.8"/>
    <path d="M190 170a60 60 0 0 1 0 120" stroke-width="1.6"/>
    <path d="M800 140h-150v180h150" stroke-width="1.8"/>
    <path d="M650 170a60 60 0 0 0 0 120" stroke-width="1.6"/>
    <path d="M40 92h34a186 186 0 0 1 0 276H40" stroke-width="1.6"/>
    <path d="M800 92h-34a186 186 0 0 0 0 276h34" stroke-width="1.6"/>
    <path d="M62 196v68M778 196v68" stroke-width="2.6" stroke="rgba(255,150,60,0.26)"/>
    <circle cx="76" cy="230" r="9" stroke-width="1.8"/>
    <circle cx="764" cy="230" r="9" stroke-width="1.8"/>
  </g>`;

/* piłka - obwód, równik i dwa południki, tak jak w components/BallOutline.tsx */
const PILKA = `
  <g stroke="url(#linia2)" fill="none" stroke-linecap="round">
    <circle cx="200" cy="200" r="176" stroke-width="2.6"/>
    <path d="M24 200h352" stroke-width="1.6"/>
    <path d="M200 24v352" stroke-width="1.4"/>
    <path d="M118 44c46 44 46 268 0 312" stroke-width="1.5"/>
    <path d="M282 44c-46 44-46 268 0 312" stroke-width="1.5"/>
  </g>`;

function tlo() {
  /*
    600x1500 to rozmiar wyświetlany w mailu; plik idzie w dwukrotności, żeby na telefonie
    z gęstym ekranem linie nie były rozmyte.

    Wysokość jest dobrana pod długość listu, a dolne 200 px to już czysta czerń - gdy
    treść wyjdzie poza obrazek, tło przechodzi w `bgcolor` komórki bez widocznego szwu.
  */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="3000" viewBox="0 0 600 1500">
  <defs>
    <linearGradient id="linia" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(255,122,24,0)"/>
      <stop offset="0.18" stop-color="rgba(255,150,60,0.62)"/>
      <stop offset="0.5" stop-color="rgba(255,186,110,0.95)"/>
      <stop offset="0.82" stop-color="rgba(255,150,60,0.62)"/>
      <stop offset="1" stop-color="rgba(255,122,24,0)"/>
    </linearGradient>
    <linearGradient id="linia2" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="rgba(255,196,125,0.55)"/>
      <stop offset="0.6" stop-color="rgba(255,122,24,0.35)"/>
      <stop offset="1" stop-color="rgba(255,61,0,0.12)"/>
    </linearGradient>
    <radialGradient id="swiatlo1" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(255,122,24,0.34)"/>
      <stop offset="0.45" stop-color="rgba(255,77,10,0.11)"/>
      <stop offset="0.72" stop-color="rgba(255,77,10,0.03)"/>
      <stop offset="1" stop-color="rgba(255,77,10,0)"/>
    </radialGradient>
    <radialGradient id="swiatlo2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(255,178,92,0.28)"/>
      <stop offset="0.5" stop-color="rgba(255,122,24,0.06)"/>
      <stop offset="1" stop-color="rgba(255,122,24,0)"/>
    </radialGradient>
    <radialGradient id="swiatlo3" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(255,61,0,0.16)"/>
      <stop offset="1" stop-color="rgba(255,61,0,0)"/>
    </radialGradient>
  </defs>

  <rect width="600" height="1500" fill="#07070a"/>

  <!-- ciepłe światło z lewej góry - dokładnie tam, gdzie w mailu zaczyna się nagłówek -->
  <ellipse cx="70" cy="20" rx="430" ry="360" fill="url(#swiatlo1)"/>
  <ellipse cx="300" cy="430" rx="330" ry="290" fill="url(#swiatlo3)"/>
  <!-- drugie, chłodniejsze, w połowie listu; kończy się długo przed dolną krawędzią -->
  <ellipse cx="560" cy="1010" rx="380" ry="330" fill="url(#swiatlo2)"/>

  <!--
    Kontur boiska: przekrzywiony i szerszy niż kadr, tak jak na stronie zasłony - widać
    fragment płyty, a nie cały rysunek. Przygaszony, bo pod nim leży treść listu.
  -->
  <g opacity="0.34" transform="translate(-70 220) rotate(-9 375 197) scale(0.895)">
    ${BOISKO}
  </g>

  <!-- piłka niżej, w prawym dolnym rogu treści -->
  <g opacity="0.24" transform="translate(330 880) scale(0.70)">
    ${PILKA}
  </g>
</svg>`;
}

/* ---------- logo: znak marki + napis POD/KOSZ ---------- */
function logo() {
  const znak = `
    <g stroke="url(#marka)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4.5" y="12.5" width="55" height="39" rx="4.5" stroke-width="2.4"/>
      <path d="M32 12.5v39" stroke-width="1.8" opacity=".9"/>
      <path d="M4.5 23.5h10v17h-10" stroke-width="1.8"/>
      <path d="M59.5 23.5h-10v17h10" stroke-width="1.8"/>
      <path d="M14.5 27a7 7 0 0 1 0 10" stroke-width="1.6" opacity=".85"/>
      <path d="M49.5 27a7 7 0 0 0 0 10" stroke-width="1.6" opacity=".85"/>
      <circle cx="32" cy="32" r="7.5" stroke-width="2.2"/>
      <path d="M32 24.5v15M24.5 32h15" stroke-width="1.3" opacity=".95"/>
      <path d="M27.2 26c2.7 3.3 2.7 8.7 0 12M36.8 26c-2.7 3.3-2.7 8.7 0 12" stroke-width="1.3" opacity=".95"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="200" viewBox="0 0 330 100">
  <defs>
    <linearGradient id="marka" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#ffc47d"/>
      <stop offset="0.5" stop-color="#ff7a18"/>
      <stop offset="1" stop-color="#ff3d00"/>
    </linearGradient>
    <linearGradient id="napis" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#ffc47d"/>
      <stop offset="0.45" stop-color="#ff7a18"/>
      <stop offset="1" stop-color="#ff3d00"/>
    </linearGradient>
  </defs>

  <!-- tło zostaje przezroczyste: mail podkłada pod nie własną czerń -->
  <g transform="translate(8 18) scale(1.0)">${znak}</g>

  <text x="90" y="66" font-family="${CZ}" font-size="48" font-weight="700"
        letter-spacing="-1.2" fill="#f5f5f7">POD<tspan fill="url(#napis)">KOSZ</tspan></text>
</svg>`;
}

async function main() {
  fs.mkdirSync(WYJSCIE, { recursive: true });

  await sharp(Buffer.from(tlo()), { density: 72 })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(WYJSCIE, "tlo.png"));
  console.log("tlo.png");

  /* logo z kanałem alfa - w mailu leży na czerni tabeli, nie na własnym prostokącie */
  await sharp(Buffer.from(logo()), { density: 72 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(WYJSCIE, "logo.png"));
  console.log("logo.png");

  for (const p of ["tlo.png", "logo.png"]) {
    const m = await sharp(path.join(WYJSCIE, p)).metadata();
    console.log(" ", p, `${m.width}x${m.height}`, `${Math.round(fs.statSync(path.join(WYJSCIE, p)).size / 1024)} kB`);
  }
}

main().catch((e) => {
  console.error("blad:", e.message);
  process.exit(1);
});
