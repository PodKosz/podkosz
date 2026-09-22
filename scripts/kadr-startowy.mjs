/**
 * Kadr startowy mapy - obrazki, które stoją na ekranie, zanim wstanie żywa mapa.
 *
 * Mapa główna to ponad 900 kB skryptu plus kilkadziesiąt kafelków, więc przy pierwszym
 * wejściu przez chwilę nie ma czego pokazać. Zdecydowana większość pierwszych wejść widzi
 * jednak ten sam kadr - całą Polskę - więc można go przygotować z góry jako zwykły obrazek,
 * który przychodzi razem ze stroną. Żywa mapa przenika na jego miejsce, gdy ma komplet.
 *
 * ŻEBY NIE BYŁO PRZESUNIĘĆ, obrazek nie jest zrzutem „jakiegoś ekranu". To wycinek mapy
 * o znanej geometrii: skrypt zapisuje, ile pikseli zajmują na nim granice Polski, a arkusz
 * (`components/kadr-startowy.css`, generowany niżej) liczy z tego dokładnie ten sam kadr,
 * co `fitBounds` w mapie - te same granice, te same marginesy, ten sam próg 1024 px. Pozycja
 * zgadza się więc na każdym ekranie, nie tylko na wzorcowym. Trzy klasy urządzeń różnią się
 * rozdzielczością i zapasem płótna, nie geometrią.
 *
 * Uruchomienie (serwer deweloperski musi działać, z otwartą kurtyną):
 *
 *   node scripts/kadr-startowy.mjs
 *
 * Wymaga klucza CARTO w `.env.local` (NEXT_PUBLIC_CARTO_KEY) - produkcja jedzie na CARTO,
 * a obrazek z innego podkładu zmieniłby barwę mapy w chwili podmiany. Bez klucza skrypt
 * odmówi pracy; `--esri` wymusza zapasowy podkład, tylko do prób. Na co dzień linijka
 * z kluczem jest zakomentowana: CARTO wpuszcza go tylko z podkosz.pl, więc z nim lokalna
 * mapa nie dostaje ani jednego kafelka (skrypt obchodzi to sam, patrz `przezDomene`).
 *
 * PO KAŻDEJ ZMIANIE STYLU MAPY (barwy, warstwy, granice, marginesy `fitPadding`) TRZEBA GO
 * PUŚCIĆ PONOWNIE - inaczej obrazek przestanie pasować do mapy, która go zastępuje.
 */
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ADRES = process.env.ADRES ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ESRI = process.argv.includes("--esri");
/*
  Najmniejsze przybliżenie mapy (`minZoom` w MapView). Na wąskim telefonie `fitBounds`
  chciałby zejść niżej, żeby zmieścić całą Polskę, ale mapa się na to nie zgodzi - i obrazek
  też nie może zmaleć bardziej, bo przestałby pasować. MUSI być równe temu w MapView.
*/
const MIN_ZOOM = 4.5;

const MOTYWY = ["classic", "polska", "coconaut"];

/*
  Klasy urządzeń. `rw`×`rh` to ekran wzorcowy (na nim obrazek wchodzi w skali 1:1), `w`×`h`
  to płótno - z zapasem, bo na innych ekranach tej klasy obrazek jest rozciągany i przesuwany,
  a nie może skończyć się przed krawędzią. Zapas policzony dla skrajnych rozmiarów klasy
  (360×640 i 430×932 na telefonie, 640-1023 na tablecie, od 1280×720 do 3440×1440 na
  komputerze). Najtrudniejsze jest niskie, szerokie okno: Polsce brakuje wysokości, więc
  przybliżenie spada, a ekranu na boki zostaje dużo - stąd płótno szersze niż wysokie.

  Progi szerokości te same co w `fitPadding` i w arkuszu: 640 i 1024.
*/
const KLASY = [
  { nazwa: "telefon", rw: 390, rh: 844, w: 520, h: 1100, dpr: 2 },
  { nazwa: "tablet", rw: 820, rh: 1180, w: 900, h: 1400, dpr: 2 },
  { nazwa: "komputer", rw: 1920, rh: 1080, w: 2800, h: 1500, dpr: 1.5 },
];

const KATALOG = path.resolve("public/mapa/start");
const ARKUSZ = path.resolve("components/kadr-startowy.css");

await mkdir(KATALOG, { recursive: true });

const przegladarka = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // WebGL bez karty graficznej - w trybie bez okna Chrome rysuje programowo
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

/*
  KAFELKI CARTO W IMIENIU DOMENY SERWISU.

  Klucz CARTO jest przypisany do podkosz.pl - i dobrze, bo siedzi w publicznym skrypcie
  strony, więc bez tego przypisania każdy mógłby jechać na nim na własnej mapie. Skutek
  uboczny: z `localhost` serwer kafelków odpowiada 403 bez nagłówka CORS i mapa w skrypcie
  nie ma czego narysować.

  Obrazki robimy dla tej samej domeny, więc prośby o kafelki przejmujemy i wysyłamy
  z Node z pochodzeniem podkosz.pl. Przeglądarka dostaje odpowiedź z nagłówkiem CORS, jak
  na produkcji. Nic nie wychodzi poza ten komputer i CARTO.
*/
const DOMENA = process.env.DOMENA ?? "https://podkosz.pl";

async function przezDomene(strona) {
  await strona.setRequestInterception(true);
  strona.on("request", async (prosba) => {
    const url = prosba.url();
    if (!url.includes("basemaps.cartocdn.com")) return prosba.continue();
    try {
      const odp = await fetch(url, { headers: { Origin: DOMENA, Referer: `${DOMENA}/` } });
      if (odp.status !== 200) zleKafelki++;
      await prosba.respond({
        status: odp.status,
        contentType: odp.headers.get("content-type") ?? "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: Buffer.from(await odp.arrayBuffer()),
      });
    } catch {
      zleKafelki++;
      await prosba.abort("failed");
    }
  });
}

const geometria = {};
const wersje = {};
/** ile kafelków przyszło z błędem - zrzut z dziurami w podkładzie jest do wyrzucenia */
let zleKafelki = 0;

try {
  for (const k of KLASY) {
    for (const motyw of MOTYWY) {
      const strona = await przegladarka.newPage();
      await strona.setViewport({ width: k.w, height: k.h, deviceScaleFactor: k.dpr });
      await przezDomene(strona);
      const q = new URLSearchParams({ motyw, w: k.w, h: k.h, rw: k.rw, rh: k.rh });
      await strona.goto(`${ADRES}/zrzut-mapy?${q}`, { waitUntil: "domcontentloaded" });
      await strona.waitForFunction("window.__zrzut", { timeout: 90_000 });
      const g = await strona.evaluate("window.__zrzut");
      if (zleKafelki) {
        throw new Error(
          `${zleKafelki} kafelków przyszło z błędem - zrzut miałby dziury w podkładzie. ` +
            "Sprawdź klucz CARTO i połączenie, potem puść skrypt jeszcze raz."
        );
      }

      if (!ESRI && !g.podklad.includes("cartocdn")) {
        throw new Error(
          `Podkład to ${g.podklad}, a produkcja jedzie na CARTO. Odkomentuj NEXT_PUBLIC_CARTO_KEY ` +
            "w .env.local i zrestartuj serwer (albo puść z --esri, tylko do prób). Po generowaniu " +
            "zakomentuj go z powrotem - klucz działa tylko z podkosz.pl i lokalna mapa bez niego " +
            "jedzie na Esri, a z nim jest pusta."
        );
      }

      // przycisk narzędzi Next.js wisi w rogu każdej strony w trybie deweloperskim
      await strona.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const png = await strona.screenshot({ clip: { x: 0, y: 0, width: k.w, height: k.h } });
      const webp = await sharp(png).webp({ quality: 74, effort: 6 }).toBuffer();
      const plik = `${motyw}-${k.nazwa}.webp`;
      await writeFile(path.join(KATALOG, plik), webp);
      wersje[plik] = createHash("md5").update(webp).digest("hex").slice(0, 8);
      console.log(`${plik}: ${(webp.length / 1024).toFixed(0)} kB, zoom ${g.zoom.toFixed(3)}`);

      // geometria zależy od klasy, nie od motywu - bierzemy ją z pierwszego zrzutu
      geometria[k.nazwa] ??= g;
      await strona.close();
    }
  }
} finally {
  await przegladarka.close();
}

/* ---------- arkusz z geometrią ---------- */

const MARGINESY = {
  waski: { pt: 90, pb: 200, pl: 24, pr: 24 },
  szeroki: { pt: 90, pb: 70, pl: 70, pr: 70 },
};

const blok = (k) => {
  const g = geometria[k.nazwa];
  const m = k.nazwa === "komputer" ? MARGINESY.szeroki : MARGINESY.waski;
  const tla = MOTYWY.map((motyw) => {
    const plik = `${motyw}-${k.nazwa}.webp`;
    const url = `url("/mapa/start/${plik}?v=${wersje[plik]}")`;
    const sel =
      motyw === "classic"
        ? ".kadr-startowy-obraz"
        : `[data-motyw="${motyw}"] .kadr-startowy-obraz`;
    return `  ${sel} {\n    background-image: ${url};\n  }`;
  }).join("\n");

  return `  .kadr-startowy-obraz {
    --pt: ${m.pt}px;
    --pb: ${m.pb}px;
    --pl: ${m.pl}px;
    --pr: ${m.pr}px;
    --cw: ${k.w};
    --ch: ${k.h};
    --bw: ${g.bw.toFixed(3)};
    --bh: ${g.bh.toFixed(3)};
    --kmin: ${(2 ** (MIN_ZOOM - g.zoom)).toFixed(5)};
  }
${tla}`;
};

const [telefon, tablet, komputer] = KLASY;
const css = `/*
  WYGENEROWANE przez scripts/kadr-startowy.mjs - nie edytować ręcznie, tylko puścić skrypt.

  Geometria kadru startowego dla trzech klas urządzeń: marginesy z \`fitPadding\`, rozmiar
  płótna obrazka (--cw, --ch), granice Polski na tym płótnie (--bw, --bh) i najmniejsza skala,
  na jaką pozwala \`minZoom\` mapy (--kmin). Resztę - skalę
  i położenie - liczy arkusz w globals.css („kadr startowy mapy").
*/
@container kadr (max-width: 639.98px) {
${blok(telefon)}
}

@container kadr (min-width: 640px) and (max-width: 1023.98px) {
${blok(tablet)}
}

@container kadr (min-width: 1024px) {
${blok(komputer)}
}
`;
await writeFile(ARKUSZ, css);
console.log(`\nzapisane: ${path.relative(process.cwd(), ARKUSZ)}`);
