import { WOJEWODZTWA_SRODKI, type MapCourt } from "./types";

/**
 * Grupy boisk na mapie - pinezki z liczbą zamiast setek pojedynczych.
 *
 * ------------------------------------------------------------------ po co
 *
 * Przy kilkuset boiskach w województwie mapa całej Polski zamienia się w plamę pinezek,
 * z której nic nie da się przeczytać. Grupy składają boiska w jedną pinezkę z liczbą,
 * a przybliżanie rozkłada je warstwa po warstwie (decyzja Basketa z 17.10.2026):
 *
 *   kraj         - jedna pinezka na całą Polskę; tylko przy oddaleniu dalej niż kadr
 *                  startowy, kiedy pinezki województw zaczęłyby na siebie wjeżdżać,
 *   wojewodztwa  - jedna pinezka na województwo, w jego środku; to widok startowy,
 *   skupiska     - województwo rozpada się na kilka pinezek w miejscach, gdzie boisk jest
 *                  najwięcej, każda w średnim położeniu swoich boisk,
 *   okolice      - skupisko rozpada się jeszcze raz, na mniejsze,
 *   (potem)      - zwykłe pinezki boisk.
 *
 * Grupy są zagnieżdżone: skupisko leży w całości w jednym województwie, okolica w jednym
 * skupisku. Dzięki temu przybliżanie zawsze rozkłada pinezkę na jej własne dzieci, a nie
 * przetasowuje boiska między sąsiadami.
 *
 * Moduł nie wie nic o mapie ani o przybliżeniu - liczy samo drzewo. Kiedy który poziom
 * widać, decyduje `MapView`.
 *
 * ------------------------------------------------------------------ jak liczone są skupiska
 *
 * Zachłannie, od najgęstszego miejsca: boisko z największą liczbą sąsiadów w promieniu
 * zaczyna skupisko i zabiera wszystkie wolne boiska w tym promieniu, potem następne
 * w kolejce wolne boisko robi to samo. Zaczynanie od gęstych miejsc stawia skupiska
 * w miastach, a nie na przypadkowym boisku z brzegu. Na końcu skupiska, których średnie
 * położenia wypadły za blisko siebie, zlewają się w jedno - inaczej ich pinezki mogłyby
 * na siebie nachodzić.
 *
 * Wynik zależy tylko od listy boisk (remisy rozstrzyga identyfikator), więc ta sama baza
 * daje zawsze te same grupy.
 */

export type PoziomGrup = "kraj" | "wojewodztwa" | "skupiska" | "okolice";

export interface GrupaBoisk {
  /** stały między przeliczeniami, o ile skład grupy się nie zmienił - po nim mapa poznaje pinezkę */
  id: string;
  poziom: PoziomGrup;
  /** gdzie stoi pinezka */
  lat: number;
  lng: number;
  idBoisk: string[];
  /** grupa poziom wyżej, z której ta wyłania się przy przybliżaniu */
  rodzic: string | null;
  /** podpis: „Polska", województwo, a niżej najczęstsze miasto w grupie */
  nazwa: string;
  /** zasięg boisk w grupie [zachód, południe, wschód, północ] - kadr po kliknięciu */
  ramka: [number, number, number, number];
}

export interface DrzewoGrup {
  poziomy: Record<PoziomGrup, GrupaBoisk[]>;
  /** w której grupie danego poziomu leży boisko */
  przynaleznosc: Record<PoziomGrup, Map<string, string>>;
  grupy: Map<string, GrupaBoisk>;
}

/**
 * Promień skupiska. Czterdzieści kilometrów zbiera miasto razem z okolicą w jedną pinezkę,
 * więc województwo rozpada się na kilka (nie kilkadziesiąt) - tak, jak było w zamówieniu.
 */
export const PROMIEN_SKUPISKA_KM = 40;
/**
 * Promień okolicy - duże miasto dzieli się na kilka części, małe zostaje w całości. Przy
 * dziewięciu kilometrach centrum Warszawy zostawało jedną pinezką z trzema setkami boisk.
 */
export const PROMIEN_OKOLICY_KM = 5.5;

/** Środek geograficzny Polski (okolice Piątku) - tam stoi pinezka całego kraju. */
const SRODEK_POLSKI = { lat: 52.07, lng: 19.48 };

/** Skupiska, których średnie położenia są bliżej niż ta część promienia, zlewają się. */
const ZLEWANIE = 0.75;

export function zbudujDrzewoGrup(boiska: MapCourt[]): DrzewoGrup {
  const drzewo: DrzewoGrup = {
    poziomy: { kraj: [], wojewodztwa: [], skupiska: [], okolice: [] },
    przynaleznosc: {
      kraj: new Map(),
      wojewodztwa: new Map(),
      skupiska: new Map(),
      okolice: new Map(),
    },
    grupy: new Map(),
  };
  if (!boiska.length) return drzewo;

  const dodaj = (g: GrupaBoisk) => {
    drzewo.grupy.set(g.id, g);
    drzewo.poziomy[g.poziom].push(g);
    for (const id of g.idBoisk) drzewo.przynaleznosc[g.poziom].set(id, g.id);
  };

  const kraj = grupa("kraj", "pl", boiska, null, "Polska", SRODEK_POLSKI);
  dodaj(kraj);

  const wgWojewodztw = new Map<string, MapCourt[]>();
  for (const b of boiska) {
    const lista = wgWojewodztw.get(b.voivodeship);
    if (lista) lista.push(b);
    else wgWojewodztw.set(b.voivodeship, [b]);
  }

  for (const [nazwa, lista] of wgWojewodztw) {
    /* boisko z województwem spoza listy (literówka w bazie) dostaje pinezkę w środku swoich boisk */
    const srodek = WOJEWODZTWA_SRODKI[nazwa as keyof typeof WOJEWODZTWA_SRODKI] ?? srednia(lista);
    const woj = grupa("wojewodztwa", `w:${nazwa}`, lista, kraj.id, nazwa, srodek);
    dodaj(woj);

    for (const s of skupiaj(lista, PROMIEN_SKUPISKA_KM)) {
      const skupisko = grupa("skupiska", `s:${najmniejszeId(s)}`, s, woj.id, najczestszeMiasto(s), srednia(s));
      dodaj(skupisko);

      for (const o of skupiaj(s, PROMIEN_OKOLICY_KM)) {
        dodaj(grupa("okolice", `o:${najmniejszeId(o)}`, o, skupisko.id, najczestszeMiasto(o), srednia(o)));
      }
    }
  }

  return drzewo;
}

function grupa(
  poziom: PoziomGrup,
  id: string,
  boiska: MapCourt[],
  rodzic: string | null,
  nazwa: string,
  gdzie: { lat: number; lng: number }
): GrupaBoisk {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const b of boiska) {
    w = Math.min(w, b.lng);
    e = Math.max(e, b.lng);
    s = Math.min(s, b.lat);
    n = Math.max(n, b.lat);
  }
  return {
    id,
    poziom,
    lat: gdzie.lat,
    lng: gdzie.lng,
    idBoisk: boiska.map((b) => b.id),
    rodzic,
    nazwa,
    ramka: [w, s, e, n],
  };
}

function srednia(boiska: MapCourt[]) {
  let lat = 0;
  let lng = 0;
  for (const b of boiska) {
    lat += b.lat;
    lng += b.lng;
  }
  return { lat: lat / boiska.length, lng: lng / boiska.length };
}

function najmniejszeId(boiska: MapCourt[]) {
  let min = boiska[0].id;
  for (const b of boiska) if (b.id < min) min = b.id;
  return min;
}

/** Miasto, w którym leży najwięcej boisk grupy; remis rozstrzyga alfabet. */
function najczestszeMiasto(boiska: MapCourt[]) {
  const ile = new Map<string, number>();
  for (const b of boiska) {
    const miasto = b.city?.trim();
    if (miasto) ile.set(miasto, (ile.get(miasto) ?? 0) + 1);
  }
  let najlepsze = "";
  let rekord = 0;
  for (const [miasto, n] of ile) {
    if (n > rekord || (n === rekord && miasto.localeCompare(najlepsze, "pl") < 0)) {
      najlepsze = miasto;
      rekord = n;
    }
  }
  return najlepsze || "Okolica";
}

/**
 * Dzieli boiska na skupiska o zadanym promieniu - opis algorytmu w nagłówku pliku.
 *
 * Odległości liczone w kilometrach na płaszczyźnie stycznej w średniej szerokości grupy.
 * Na obszarze województwa błąd takiego przybliżenia to ułamek procenta - dla decyzji
 * „blisko czy daleko" bez znaczenia.
 */
export function skupiaj(boiska: MapCourt[], promienKm: number): MapCourt[][] {
  if (boiska.length <= 1) return boiska.length ? [boiska] : [];

  const latSr = boiska.reduce((s, b) => s + b.lat, 0) / boiska.length;
  const kx = 111.32 * Math.cos((latSr * Math.PI) / 180);
  const ky = 110.57;
  const x = boiska.map((b) => b.lng * kx);
  const y = boiska.map((b) => b.lat * ky);
  const r2 = promienKm * promienKm;

  /* siatka o boku promienia: sąsiadów szukamy tylko w dziewięciu kratkach dookoła */
  const kratka = (i: number) => [Math.floor(x[i] / promienKm), Math.floor(y[i] / promienKm)];
  const siatka = new Map<string, number[]>();
  for (let i = 0; i < boiska.length; i++) {
    const [cx, cy] = kratka(i);
    const klucz = `${cx}:${cy}`;
    const lista = siatka.get(klucz);
    if (lista) lista.push(i);
    else siatka.set(klucz, [i]);
  }
  const sasiedzi = (i: number) => {
    const [cx, cy] = kratka(i);
    const wynik: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of siatka.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const ddx = x[j] - x[i];
          const ddy = y[j] - y[i];
          if (ddx * ddx + ddy * ddy <= r2) wynik.push(j);
        }
      }
    }
    return wynik;
  };

  const gestosc = boiska.map((_, i) => sasiedzi(i).length);
  const kolejnosc = boiska
    .map((_, i) => i)
    .sort((a, b) => gestosc[b] - gestosc[a] || (boiska[a].id < boiska[b].id ? -1 : 1));

  const przydzial = new Array<number>(boiska.length).fill(-1);
  let grupy: number[][] = [];
  for (const i of kolejnosc) {
    if (przydzial[i] >= 0) continue;
    const nr = grupy.length;
    const czlonkowie: number[] = [];
    for (const j of sasiedzi(i)) {
      if (przydzial[j] < 0) {
        przydzial[j] = nr;
        czlonkowie.push(j);
      }
    }
    grupy.push(czlonkowie);
  }

  /*
    Zlewanie zbyt bliskich skupisk. Zarodki skupisk są od siebie dalej niż promień, ale
    średnie położenia już nie muszą: dwa skupiska po obu stronach granicy swoich zasięgów
    potrafią zjechać środkami prawie w jedno miejsce. Skupisk jest kilkanaście, nie
    kilka tysięcy, więc wystarczy zwykłe porównanie każdej pary.
  */
  const srodek = (g: number[]) => {
    let sx = 0;
    let sy = 0;
    for (const i of g) {
      sx += x[i];
      sy += y[i];
    }
    return [sx / g.length, sy / g.length];
  };
  const prog2 = (promienKm * ZLEWANIE) ** 2;
  for (let zmiana = true; zmiana && grupy.length > 1; ) {
    zmiana = false;
    const srodki = grupy.map(srodek);
    szukaj: for (let a = 0; a < grupy.length; a++) {
      for (let b = a + 1; b < grupy.length; b++) {
        const dx = srodki[a][0] - srodki[b][0];
        const dy = srodki[a][1] - srodki[b][1];
        if (dx * dx + dy * dy < prog2) {
          grupy[a] = grupy[a].concat(grupy[b]);
          grupy = grupy.filter((_, k) => k !== b);
          zmiana = true;
          break szukaj;
        }
      }
    }
  }

  return grupy.map((g) => g.map((i) => boiska[i]));
}
