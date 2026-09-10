/**
 * Punkty „nieodkrytych boisk" z OpenStreetMap - pobranie, odsianie duplikatów, SQL do wgrania.
 *
 * ------------------------------------------------------------------ co to jest i czym NIE jest
 *
 * To NIE jest import boisk. Z OSM bierzemy wyłącznie WSPÓŁRZĘDNE - żadnych nazw, nawierzchni,
 * godzin ani opisów. Punkty nie mają swoich stron w mapie witryny, nie wchodzą do rankingów
 * i nie są nigdzie publikowane jako dane. Na mapie są szarą pinezką z jednym zdaniem: „przyjdź
 * tu i dodaj to boisko".
 *
 * Dwa powody, oba ważne:
 *
 *   1. PRAWNY. Osiem tysięcy rekordów to istotny wyciąg z bazy OSM, a ta jest na licencji ODbL
 *      (w Unii dochodzi jeszcze prawo sui generis do baz danych). Wzięcie samych współrzędnych
 *      tego nie zeruje, ale sprowadza rzecz do „Produced Work" - a przy nim ODbL wymaga
 *      ATRYBUCJI, nie share-alike. Stąd zasada: bierzemy minimum z minimum, trzymamy w osobnej
 *      tabeli, nigdy nie wystawiamy jako danych i podpisujemy widocznie przy mapie.
 *
 *   2. PRODUKTOWY. Import ośmiu tysięcy boisk bez zdjęć i bez opisu to osiem tysięcy pustych
 *      podstron - a wyszukiwarka ocenia serwis całościowo i takie strony ciągną w dół karty
 *      prawdziwych boisk. Szary punkt bez własnej treści nie ciągnie niczego, a daje powód,
 *      żeby wyjść z domu.
 *
 * ------------------------------------------------------------------ uruchamianie
 *
 *   node scripts/punkty-osm.mjs                      # pobiera z Overpass (~2 min) i pisze SQL
 *   node scripts/punkty-osm.mjs --z-pliku dane.json  # z wcześniej pobranej odpowiedzi
 *   node scripts/punkty-osm.mjs --do katalog         # gdzie zapisać wynik
 *
 * Powtórne uruchomienie jest bezpieczne: identyfikator punktu bierze się z OSM (`w123456`),
 * a wstawianie idzie z `on conflict do nothing`. Nowe boiska w OSM dojdą, istniejące zostaną
 * nietknięte razem ze swoim stanem odkrycia.
 */

import fs from "node:fs";
import path from "node:path";

const OVERPASS = "https://overpass-api.de/api/interpreter";

/*
  Dwa zapytania w jednym, bo boiska do kosza bywają w OSM opisane dwojako: jako `leisure=pitch`
  ze sportem, i jako sam `sport=basketball` na czymś innym (np. na terenie szkoły). `out center`
  jest tu konieczny - z ośmiu tysięcy obiektów prawie wszystkie to OBRYSY, a nie punkty, więc
  bez środka ciężkości nie dostalibyśmy współrzędnych w ogóle.
*/
const ZAPYTANIE = `[out:json][timeout:300];
area["ISO3166-1"="PL"][admin_level=2]->.pl;
(
  nwr["leisure"="pitch"]["sport"~"basketball"](area.pl);
  nwr["sport"="basketball"](area.pl);
);
out center;`;

/**
 * Promień, w którym dwa punkty uznajemy za to samo boisko.
 *
 * To samo boisko bywa w OSM zmapowane kilka razy - raz jako obrys płyty, raz jako punkt
 * z koszem, czasem jeszcze raz w relacji terenu sportowego. Bez odsiewania na mapie stałyby
 * trzy szare pinezki jedna na drugiej, a odkrycie jednej zostawiałoby dwie.
 *
 * Trzydzieści metrów to mniej niż długość boiska (28 m), więc dwa NAPRAWDĘ osobne boiska
 * obok siebie zwykle przetrwają - a przy takich, które się skleją, i tak wystarczy jedna
 * pinezka, bo prowadzi w to samo miejsce.
 */
const PROMIEN_DUPLIKATU_M = 30;

/** Odległość w metrach (haversine) - ta sama, co w `lib/obecnosc.ts` i w bazie. */
function odlegloscM(a, b) {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function pobierzZOverpass() {
  process.stderr.write("pobieram z Overpass (to trwa ok. dwóch minut)...\n");
  const res = await fetch(OVERPASS, {
    method: "POST",
    /* regulamin Overpass wymaga identyfikacji i kontaktu - bez tego potrafią odciąć adres IP */
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": "PodKosz/1.0 (kontakt: opinie@podkosz.pl)",
    },
    body: ZAPYTANIE,
  });
  if (!res.ok) throw new Error(`Overpass odpowiedział ${res.status}`);
  return res.json();
}

/** Współrzędne z jednego obiektu OSM: punkt ma je wprost, obrys i relacja w `center`. */
function wspolrzedne(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * Odsiewanie duplikatów siatką przestrzenną.
 *
 * Naiwne porównanie każdego z każdym to 32 miliony par przy ośmiu tysiącach punktów. Siatka
 * o oczku równym promieniowi sprowadza to do sprawdzenia dziewięciu komórek wokół punktu -
 * bo dalej niż o jedną komórkę nic bliższego niż promień leżeć nie może.
 */
function odsiejDuplikaty(punkty) {
  const dLat = PROMIEN_DUPLIKATU_M / 111320;
  /* w Polsce (ok. 52 stopnia szerokości) stopień długości jest krótszy o cosinus szerokości */
  const dLng = PROMIEN_DUPLIKATU_M / (111320 * Math.cos((52 * Math.PI) / 180));

  const siatka = new Map();
  const zostaje = [];

  for (const p of punkty) {
    const kx = Math.floor(p.lat / dLat);
    const ky = Math.floor(p.lng / dLng);

    let duplikat = false;
    for (let i = -1; i <= 1 && !duplikat; i += 1) {
      for (let j = -1; j <= 1 && !duplikat; j += 1) {
        for (const q of siatka.get(`${kx + i}|${ky + j}`) ?? []) {
          if (odlegloscM(p, q) <= PROMIEN_DUPLIKATU_M) duplikat = true;
        }
      }
    }
    if (duplikat) continue;

    const klucz = `${kx}|${ky}`;
    if (!siatka.has(klucz)) siatka.set(klucz, []);
    siatka.get(klucz).push(p);
    zostaje.push(p);
  }

  return zostaje;
}

function sql(punkty) {
  const linie = [];
  linie.push("-- =====================================================================");
  linie.push("--  Punkty nieodkrytych boisk z OpenStreetMap - same współrzędne.");
  linie.push("--  Wygenerowane przez scripts/punkty-osm.mjs, nie edytować ręcznie.");
  linie.push(`--  Stan OSM z dnia: ${new Date().toISOString().slice(0, 10)}`);
  linie.push(`--  Punktów: ${punkty.length}`);
  linie.push("--");
  linie.push("--  Dane pochodzą z OpenStreetMap i są udostępnione na licencji ODbL.");
  linie.push("--  Uruchom PO migration-punkty-osm.sql.");
  linie.push("-- =====================================================================");
  linie.push("");

  /*
    Paczkami po pięćset, nie jednym wstawieniem na osiem tysięcy wierszy: edytor SQL
    w Supabase potrafi się zadławić jednym poleceniem na kilkaset kilobajtów, a paczki
    dają też widoczny postęp.
  */
  const PACZKA = 500;
  for (let i = 0; i < punkty.length; i += PACZKA) {
    const grupa = punkty.slice(i, i + PACZKA);
    linie.push("insert into public.punkty_osm (osm_id, lat, lng) values");
    linie.push(
      grupa
        .map((p) => `  ('${p.id}', ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)})`)
        .join(",\n") + "\non conflict (osm_id) do nothing;"
    );
    linie.push("");
  }

  linie.push("-- ============================================================ kontrola");
  linie.push("select count(*) as punktow, count(*) filter (where odkryte_przez is not null) as odkrytych");
  linie.push("  from public.punkty_osm;");
  linie.push("");
  return linie.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const zPliku = args.includes("--z-pliku") ? args[args.indexOf("--z-pliku") + 1] : null;
  const doKatalogu = args.includes("--do") ? args[args.indexOf("--do") + 1] : "supabase";

  const dane = zPliku
    ? JSON.parse(fs.readFileSync(zPliku, "utf8"))
    : await pobierzZOverpass();

  const elementy = dane.elements ?? [];
  const surowe = [];
  for (const el of elementy) {
    const p = wspolrzedne(el);
    if (!p) continue;
    /* identyfikator z OSM: typ plus numer, żeby powtórne uruchomienie nie dublowało punktów */
    surowe.push({ id: `${el.type[0]}${el.id}`, lat: p.lat, lng: p.lng });
  }

  const punkty = odsiejDuplikaty(surowe);

  const plik = path.join(doKatalogu, "dane-punkty-osm.sql");
  fs.writeFileSync(plik, sql(punkty), "utf8");

  process.stderr.write(
    `obiektów z OSM: ${elementy.length}\n` +
      `ze współrzędnymi: ${surowe.length}\n` +
      `po odsianiu duplikatów (${PROMIEN_DUPLIKATU_M} m): ${punkty.length}\n` +
      `zapisane: ${plik} (${(fs.statSync(plik).size / 1024).toFixed(0)} kB)\n`
  );
}

main().catch((e) => {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
});
