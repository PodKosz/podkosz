/**
 * Wspólne rysowanie dla obu minigier.
 *
 * Piłka, odczyt barw motywu i drobiazgi do rysowania kreską z postępem. Wydzielone
 * w chwili, w której doszła druga gra: kozłowanie rysuje tę samą piłkę, tym samym
 * gradientem i z tymi samymi szwami, co rzut do kosza. Skopiowana setka linijek
 * rozjechałaby się przy pierwszej poprawce wyglądu - a piłka jest jedyną rzeczą, którą
 * gracz oglądą w tej grze z bliska.
 */

/*
  Wartości zapamiętujemy do czasu zmiany motywu. Rysunek pyta o kilkanaście zmiennych
  w każdej klatce, a `getComputedStyle` wymusza przeliczenie stylu - przy sześćdziesięciu
  klatkach to prawie tysiąc takich przeliczeń na sekundę za odpowiedzi, które się nie
  zmieniają. Pamięć czyścimy po atrybucie `data-motyw`, bo tylko on je zmienia.
*/
const pamiecBarw = new Map<string, string>();
let pamiecMotywu: string | null = null;

export function barwa(nazwa: string, awaryjna: string, alfa?: number) {
  if (typeof window === "undefined") return awaryjna;

  const motyw = document.documentElement.dataset.motyw ?? "";
  if (motyw !== pamiecMotywu) {
    pamiecBarw.clear();
    pamiecMotywu = motyw;
  }

  let v = pamiecBarw.get(nazwa);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(nazwa).trim();
    pamiecBarw.set(nazwa, v);
  }

  if (!v) return awaryjna;
  return alfa === undefined ? v : `rgb(${v} / ${alfa})`;
}

/** Ułamek postępu w zadanym oknie - 0 przed, 1 po, liniowo w środku. */
/**
 * Wynik bieżącej rozgrywki jako wydrążona liczba w tle - ten sam zabieg co numery
 * w rankingu. W rzucie do kosza to długość serii, w kozłowaniu liczba kozłowań.
 *
 * W tle stał wcześniej rekord i to była zła liczba na tym miejscu. Rekord jest stały przez
 * całą rozgrywkę, więc wielka cyfra pośrodku ekranu nic nie robiła - wisiała. Licznik
 * bieżącej serii rośnie z każdym trafieniem, czyli ta sama powierzchnia mówi teraz, co się
 * właśnie dzieje. Rekord przeniósł się do złotej plakietki w narożniku, bo jest celem,
 * a nie stanem.
 *
 * Zera nie rysujemy: na początku serii i po pudle w tle zostaje czysta plansza. Przy każdym
 * trafieniu liczba na chwilę podskakuje - skala idzie z czasu ostatniego trafienia
 * (`blysk`), tego samego, którym rozjaśnia się obręcz. Jedno zdarzenie, dwie reakcje.
 */
export function rysujLicznik(
  ctx: CanvasRenderingContext2D,
  szer: number,
  wys: number,
  wartosc: number,
  /** 0-1: jak świeże jest ostatnie zdobycie punktu - od tego podskok liczby */
  swieze: number
) {
  if (wartosc <= 0) return;

  const skok = 1 + 0.09 * swieze * swieze;

  ctx.save();
  ctx.translate(szer / 2, wys * 0.62);
  ctx.scale(skok, skok);
  ctx.font = "800 340px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = barwa("--rgb-szyba", "rgba(255,255,255,.07)", 0.07 + swieze * 0.1);
  ctx.strokeText(String(wartosc), 0, 0);
  ctx.restore();
}

export function okno(p: number, od: number, do_: number) {
  if (p <= od) return 0;
  if (p >= do_) return 1;
  return (p - od) / (do_ - od);
}

/** Ścieżka zaokrąglonego prostokąta - bez rysowania, do wypełnienia albo obrysu. */
export function zaokraglonaSciezka(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Obwód prostokąta rysowany częściowo, zaczynając od górnego lewego narożnika. */
export function obwod(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  post: number
) {
  if (post <= 0) return;
  const boki: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
  const dlugosci = boki.map(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay));
  const razem = dlugosci.reduce((a, b) => a + b, 0);
  let doNarysowania = razem * post;

  ctx.beginPath();
  for (let i = 0; i < boki.length && doNarysowania > 0; i++) {
    const [ax, ay, bx, by] = boki[i];
    const dl = dlugosci[i];
    const u = Math.min(1, doNarysowania / dl);
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u);
    doNarysowania -= dl;
  }
  ctx.stroke();
}

/**
 * Piłka rysowana kreską i gradientem, bez pliku graficznego.
 *
 * Wcześniej piłką był obrazek z katalogu odznaczeń - ten sam webp, który stoi na profilu
 * przy stopniach. Miało to sens jako skrót, ale kosztowało trzy rzeczy: cztery pobrania
 * przy wejściu do gry, brak jakiegokolwiek światła zgodnego ze sceną i - najgorsze -
 * niewidoczny obrót. Obrócony obrazek piłki wygląda jak obrócony obrazek, bo szwy na nim
 * są namalowane razem z odblaskiem: kręci się cała fotografia, a nie kula.
 *
 * Teraz piłka jest złożona z czterech warstw i to ta kolejność sprzedaje bryłę:
 *
 *   1. ŁUNA pod piłką - w barwie stopnia, żeby na ciemnym tle nie ginęła.
 *   2. KORPUS - gradient promieniowy z ogniskiem przesuniętym w górę i w lewo: jasny
 *      grzbiet, nasycony środek, ciemna krawędź.
 *   3. SZWY - obracane razem z piłką. Cztery kreski w układzie prawdziwej piłki:
 *      równik, południk i dwie klamry po bokach.
 *   4. ODBLASK - NIEOBRACANY. To jedyna warstwa, która stoi w miejscu, i właśnie dlatego
 *      wszystko działa: światło zostaje tam, gdzie było, a kula pod nim się kręci.
 *      Gdyby odblask kręcił się razem ze szwami, wróciłby efekt obracanego obrazka.
 *
 * Barwy idą ze stopni odznaczeń (`--zar-*`, `--iskra-*`, `--plomien-*`, `--niebieski-*`)
 * i to jedyne miejsce w grze, gdzie barwa nie należy do motywu. Powód jest ten sam, co
 * przy samych odznaczeniach: kolor jest tu TREŚCIĄ - mówi, jak długa jest seria. Piłka
 * w barwie motywu wyglądałaby spójniej i nie mówiłaby nic.
 */
const PALETY: Record<string, [string, string, string]> = {
  zar: ["#ffc79a", "#ff7a2e", "#6e2405"],
  iskra: ["#ffe9a8", "#f0b53c", "#6b4204"],
  plomien: ["#ffa392", "#ec2f2a", "#5c060c"],
  niebieski: ["#d6f2ff", "#3f9bff", "#0b2170"],
};

export function paletaPilki(nazwa: string): [string, string, string] {
  const zapas = PALETY[nazwa] ?? PALETY.zar;
  return [
    barwa(`--${nazwa}-a`, zapas[0]),
    barwa(`--${nazwa}-b`, zapas[1]),
    barwa(`--${nazwa}-c`, zapas[2]),
  ];
}

export interface PilkaDoRysowania {
  x: number;
  y: number;
  /** promień w pikselach świata - obie gry mają swój */
  r: number;
  obrot: number;
  /** 0-1: przezroczystość, do pojawiania się piłki */
  alfa: number;
  /** spłaszczenie w pionie - 1 to kula, mniej to piłka zgnieciona o parkiet */
  splaszczenie?: number;
  /** nazwa stopnia: zar, iskra, plomien, niebieski */
  stopien: string;
}

export function rysujPilke(ctx: CanvasRenderingContext2D, p: PilkaDoRysowania) {
  if (p.alfa <= 0) return;

  const r = p.r;
  const s = { x: p.x, y: p.y, obrot: p.obrot };
  const [jasna, srodek, ciemna] = paletaPilki(p.stopien);

  ctx.save();
  ctx.globalAlpha = p.alfa;

  /* --- 1. łuna pod piłką --- */
  const luna = ctx.createRadialGradient(s.x, s.y, r * 0.6, s.x, s.y, r * 2.1);
  luna.addColorStop(0, przezroczysta(srodek, 0.3));
  luna.addColorStop(1, przezroczysta(srodek, 0));
  ctx.fillStyle = luna;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(s.x, s.y);
  /*
    Spłaszczenie w pionie robimy skalowaniem całej kuli, nie osobnym rysunkiem. Piłka
    zgnieciona o parkiet ma być tą samą piłką, więc gradient, szwy i odblask muszą się
    ścisnąć razem z nią - inaczej odblask zostałby okrągły na spłaszczonej bryle.
  */
  if (p.splaszczenie !== undefined && p.splaszczenie !== 1) {
    ctx.scale(1 / Math.sqrt(p.splaszczenie), p.splaszczenie);
  }

  /* --- 2. korpus --- */
  const korpus = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.08, 0, 0, r * 1.06);
  korpus.addColorStop(0, jasna);
  korpus.addColorStop(0.42, srodek);
  korpus.addColorStop(1, ciemna);
  ctx.fillStyle = korpus;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  /* krawędź: ciemny pierścień od środka, żeby kula miała obrys bez rysowania obrysu */
  const brzeg = ctx.createRadialGradient(0, 0, r * 0.72, 0, 0, r);
  brzeg.addColorStop(0, przezroczysta(ciemna, 0));
  brzeg.addColorStop(1, przezroczysta(ciemna, 0.55));
  ctx.fillStyle = brzeg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  /* --- 3. szwy, obracane razem z piłką --- */
  ctx.save();
  ctx.rotate(s.obrot);
  /*
    Szwy przycinamy do koła piłki. Bez przycięcia klamry po bokach wychodzą za krawędź
    przy każdym obrocie, w którym elipsa nie leży dokładnie w osi - i piłka dostaje wąsy.
  */
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = przezroczysta(ciemna, 0.72);
  ctx.lineWidth = Math.max(1.2, r * 0.085);
  ctx.lineCap = "round";

  /* równik i południk */
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();

  /* dwie klamry - elipsa o zwężonej poziomej półosi daje obie naraz */
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  /* --- 4. odblask, nieobracany --- */
  const blask = ctx.createRadialGradient(-r * 0.4, -r * 0.46, 0, -r * 0.4, -r * 0.46, r * 0.62);
  blask.addColorStop(0, "rgba(255,255,255,.5)");
  blask.addColorStop(0.55, "rgba(255,255,255,.1)");
  blask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = blask;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Barwa z dodaną przezroczystością.
 *
 * Zmienne stopni trzymają gotowe barwy w zapisie szesnastkowym, nie składowe RGB, więc
 * nie da się z nich zrobić „to samo, ale 30%" tak, jak z `--rgb-*`. Doklejamy więc dwie
 * cyfry kanału alfa - to jedyny sposób, który działa dla obu zapisów, jakie mogą tu
 * przyjść: `#rrggbb` z arkusza i wartość zapasowa z tego pliku.
 */
export function przezroczysta(kolor: string, alfa: number) {
  const a = Math.round(Math.max(0, Math.min(1, alfa)) * 255)
    .toString(16)
    .padStart(2, "0");
  if (/^#[0-9a-f]{6}$/i.test(kolor)) return `${kolor}${a}`;
  /* nieznany zapis - lepiej oddać barwę bez alfy niż nic nie narysować */
  return alfa <= 0.02 ? "transparent" : kolor;
}
