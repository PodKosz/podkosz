/*
  Grafiki do maili powitalnych.

  W mailu nie da się użyć SVG ani CSS-owych gradientów - Gmail i Outlook je wycinają.
  Dlatego stylistykę strony (czarne tło, pomarańczowe światła, kontur boiska, logo)
  wypalamy tutaj w PNG-i, a szablon wskazuje je adresem na podkosz.pl. Zasłona przed
  premierą ich nie zasłania: matcher w proxy.ts pomija pliki .png.

  Uruchomienie:  node scripts/grafiki-maila.mjs        - tło i logo
                 node scripts/grafiki-maila.mjs logo   - samo logo (po zmianie znaku w lib/znak.ts)
  Po nowym logo trzeba podbić ?v= w lib/mail/szkielet.ts - skrzynki trzymają obrazki w pamięci.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NAPIS_BARWY, ZNAK, ZNAK_SLOWNY } from "../lib/znak.ts";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const WYJSCIE = path.join(KATALOG, "..", "public", "mail");

/* rozmiar wyświetlany w mailu; plik idzie w dwukrotności */
const SZEROKOSC = 1200;
const WYSOKOSC = 3000;
const CZERN = "#07070a";
/*
  „POWERED BY” pod napisem jako krzywe Instrument Sans SemiBold (krój serwisu). Nie <text>:
  librsvg bierze czcionki z systemu, więc na każdym komputerze obrazek wychodziłby inny. Krzywe
  robi narzedzia/powered-by-do-maila.py w podkosz-brand (HarfBuzz, z kerningiem). Sam napis
  PODKOSZ to rysunek z lib/znak.ts - bez żadnej czcionki.
*/
const POWERED = JSON.parse(fs.readFileSync(path.join(KATALOG, "powered-by.json"), "utf8"));
const COCONAUT = fs.readFileSync(path.join(KATALOG, "..", "public", "partnerzy", "coconaut-logo-web.png"));

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

function tlo(zTlem = true) {
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

  ${zTlem ? '<rect width="600" height="1500" fill="#07070a"/>' : ""}

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

/*
  ---------- logo: pełny zestaw - znak, napis PODKOSZ, „Powered by” i logo Coconaut ----------

  Znak i napis bierzemy z lib/znak.ts - ta sama geometria co w nawigacji, więc logo w mailu nie
  rozjedzie się z tym na stronie. Proporcje jak w components/Logotyp.tsx, gdzie wszystko liczy
  się od wysokości liter (L): znak 2,634 L, odstęp 0,585 L, pod napisem wiersz 0,293 L niżej
  z podpisem 0,366 L i logo Coconaut 0,488 L dosuniętym do prawej krawędzi Z.

  Plik ma trzykrotność rozmiaru z maila - skrypt wypisuje ten rozmiar, a trzeba go przepisać
  do `width`/`height` obrazka w lib/mail/szkielet.ts.
*/
const L = 77;
const ZNAK_H = 2.634 * L;
const ZNAK_W = ZNAK_H * ZNAK.proporcja;
const NAPIS_X = ZNAK_W + 0.585 * L;
const NAPIS_W = (L * ZNAK_SLOWNY.szerokosc) / ZNAK_SLOWNY.wysokosc;
const LOGO_W = Math.ceil(NAPIS_X + NAPIS_W);
const LOGO_H = Math.ceil(ZNAK_H);

function logo() {
  const g = ZNAK.grubosc.maly;
  const gr = ZNAK.gradient;
  const f = (n) => +n.toFixed(2);

  /* kolumna napisu (litery + wiersz pod nimi) stoi na środku wysokości znaku */
  const napisY = (ZNAK_H - L * (1 + 0.293 + 0.488)) / 2;
  const cocoH = 0.488 * L;
  const cocoW = (cocoH * 330) / 64;
  const cocoX = NAPIS_X + NAPIS_W - cocoW;
  const wierszY = napisY + 1.293 * L;
  /* podpis: wersaliki na środku wysokości logo Coconaut, jak `items-center` na stronie */
  const podpis = (0.366 * L) / 100;
  const podpisX = cocoX - 0.341 * L - POWERED.szerokosc * podpis;
  const podpisBaza = wierszY + cocoH / 2 + (POWERED.wersaliki * podpis) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${LOGO_W}" height="${LOGO_H}" viewBox="0 0 ${LOGO_W} ${LOGO_H}">
  <defs>
    <linearGradient id="znak" gradientUnits="userSpaceOnUse" x1="${gr.x1}" y1="${gr.y1}" x2="${gr.x2}" y2="${gr.y2}">
      ${gr.stopy.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}
    </linearGradient>
    <clipPath id="glowka"><path d="${ZNAK.rama}"/></clipPath>
    <linearGradient id="napis" gradientUnits="userSpaceOnUse" x1="${ZNAK_SLOWNY.koszOd}" y1="0" x2="${ZNAK_SLOWNY.szerokosc}" y2="${ZNAK_SLOWNY.wysokosc}">
      ${NAPIS_BARWY.plomien.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}
    </linearGradient>
  </defs>

  <!-- tło zostaje przezroczyste: mail podkłada pod nie własną czerń -->
  <g transform="scale(${f(ZNAK_H / 476)}) translate(-70 -22)" fill="none" stroke="url(#znak)"
     stroke-linecap="round" stroke-linejoin="round">
    <!-- szwy piłki przycięte do wnętrza pinezki, jak w components/Znak.tsx -->
    <g clip-path="url(#glowka)">${ZNAK.szwy.map((d) => `<path d="${d}" stroke-width="${g.szwy}"/>`).join("")}</g>
    <path d="${ZNAK.rama}" stroke-width="${g.rama}"/>
  </g>

  <g transform="translate(${f(NAPIS_X)} ${f(napisY)}) scale(${f(L / 100)})">
    <path d="${ZNAK_SLOWNY.pod}" fill="${NAPIS_BARWY.pod}"/>
    <path d="${ZNAK_SLOWNY.kosz}" fill="url(#napis)"/>
  </g>

  <path transform="translate(${f(podpisX)} ${f(podpisBaza)}) scale(${f(podpis)})" d="${POWERED.d}" fill="${NAPIS_BARWY.pod}"/>
  <image x="${f(cocoX)}" y="${f(wierszY)}" width="${f(cocoW)}" height="${f(cocoH)}"
    xlink:href="data:image/png;base64,${COCONAUT.toString("base64")}"/>
</svg>`;
}

/*
  Maska wygaszająca dekorację przy krawędziach obrazka.

  Tło ma 600 px szerokości, a okno poczty na komputerze jest szersze - poza kolumną listu
  zostaje płaska czerń tabeli. Jeżeli światła i kontur dochodzą do samej krawędzi obrazka,
  widać pionowe cięcie: z jednej strony gradient, z drugiej płaski kolor. Dlatego dekorację
  wygaszamy do zera na ostatnich kilkudziesięciu pikselach - wtedy brzeg obrazka JEST
  kolorem tabeli i szwu nie ma.

  Pion i poziom robimy dwoma przejściami `dest-in`, bo alfa mnoży się przez siebie i naroża
  wygaszają się mocniej niż same boki - dokładnie tak, jak trzeba.
*/
function maska(poziomo, dlugosc) {
  const kierunek = poziomo ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"';
  const bok = poziomo ? SZEROKOSC : WYSOKOSC;
  const u = (dlugosc / bok).toFixed(4);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SZEROKOSC}" height="${WYSOKOSC}">
       <defs>
         <linearGradient id="m" ${kierunek}>
           <stop offset="0" stop-color="#fff" stop-opacity="0"/>
           <stop offset="${u}" stop-color="#fff" stop-opacity="1"/>
           <stop offset="${(1 - Number(u)).toFixed(4)}" stop-color="#fff" stop-opacity="1"/>
           <stop offset="1" stop-color="#fff" stop-opacity="0"/>
         </linearGradient>
       </defs>
       <rect width="${SZEROKOSC}" height="${WYSOKOSC}" fill="url(#m)"/>
     </svg>`
  );
}

async function main() {
  fs.mkdirSync(WYJSCIE, { recursive: true });
  const tylkoLogo = process.argv.includes("logo");
  if (!tylkoLogo) await zrobTlo();

  /* logo z kanałem alfa - w mailu leży na czerni tabeli, nie na własnym prostokącie */
  await sharp(Buffer.from(logo()), { density: 72 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(WYJSCIE, "logo.png"));
  console.log("logo.png", `- w mailu ${Math.round(LOGO_W / 3)}x${Math.round(LOGO_H / 3)} (lib/mail/szkielet.ts)`);

  for (const p of tylkoLogo ? ["logo.png"] : ["tlo.png", "logo.png"]) {
    const m = await sharp(path.join(WYJSCIE, p)).metadata();
    console.log(" ", p, `${m.width}x${m.height}`, `${Math.round(fs.statSync(path.join(WYJSCIE, p)).size / 1024)} kB`);
  }
}

async function zrobTlo() {
  /* dekoracja bez tła - żeby dało się ją wygasić, zanim położymy ją na czerni */
  const dekoracja = await sharp(Buffer.from(tlo(false)), { density: 72 }).png().toBuffer();

  const wygaszona = await sharp(
    await sharp(dekoracja)
      .composite([{ input: maska(true, 132), blend: "dest-in" }])
      .toBuffer()
  )
    .composite([{ input: maska(false, 96), blend: "dest-in" }])
    .toBuffer();

  await sharp({
    create: { width: SZEROKOSC, height: WYSOKOSC, channels: 4, background: CZERN },
  })
    .composite([{ input: wygaszona }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(WYJSCIE, "tlo.png"));
  console.log("tlo.png");
}

main().catch((e) => {
  console.error("blad:", e.message);
  process.exit(1);
});
