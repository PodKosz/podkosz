"use client";

import { useCallback, useEffect, useRef } from "react";
import { MAKS_SERIA, poziomDlaSerii, type IdMiejsca } from "@/lib/minigra";
import {
  GRAWITACJA,
  KOSZ_Y,
  KROK,
  OBRECZ_R,
  OBRECZ_RY,
  PILKA_R,
  TABLICA_SZER,
  TABLICA_WYS,
  WYS,
  czyTrafienie,
  geometriaKosza,
  krokLotu,
  krzywaObreczy,
  pozycjaPilki,
  rozegrajRzut,
  wektorRzutu,
} from "@/lib/gra/fizyka";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";

/**
 * Minigra: rzut do kosza.
 *
 * ------------------------------------------------------------------ sterowanie
 *
 * Celujesz, ciągnąc od piłki w stronę, w którą ma polecieć. Kierunek to kierunek
 * przeciągnięcia, siła to jego długość, a nad piłką widać kropkowany tor, którym rzut
 * poleci. Puszczasz - piłka leci dokładnie tam.
 *
 * Poprzednia wersja liczyła rzut z PRĘDKOŚCI machnięcia i to był jej główny problem.
 * Prędkość ręki jest wielkością chwilową: mysz podskoczy o trzy piksele w ostatnich
 * dwudziestu milisekundach i ten sam ruch daje raz rzut pod obręcz, raz przez pół ekranu.
 * Nie da się tego wytrenować, bo gracz nie ma jak zobaczyć, co właściwie zrobił.
 *
 * Nowy model jest deterministyczny: ten sam gest daje ten sam rzut, zawsze. Do tego trzy
 * rzeczy, które razem robią całą płynność:
 *
 *   1. MARTWA STREFA - przeciągnięcie krótsze niż `MARTWA_STREFA` nie jest rzutem.
 *      Drgnięcie nadgarstka i kliknięcie w planszę nie wyrzucają piłki.
 *   2. WYGŁADZANIE - celownik dochodzi do kursora wykładniczo, nie skacze za nim. Szum
 *      trackpada i drżenie palca gasną, a świadomy ruch przechodzi bez opóźnienia.
 *      To jest ta różnica między „ledwo ruszyłem, a poleciała w kosmos" i „prowadzę ją".
 *   3. TOR NA PODGLĄDZIE - liczony tą samą fizyką, którą potem leci piłka. Nie przybliżenie
 *      i nie ozdoba: jeśli kropki wchodzą w obręcz, rzut wpada.
 *
 * Krzywa siły jest wypukła (`Math.pow(t, 1.35)`): przy krótkim przeciągnięciu przyrost
 * jest łagodny, przy długim szybszy. Dzięki temu delikatne poprawki celowania są naprawdę
 * delikatne, a pełną moc trzeba świadomie wyciągnąć.
 *
 * Silnika fizyki tu nie ma i to jest decyzja, nie zaniedbanie. Matter.js (MIT),
 * Planck.js (zlib) i Rapier (Apache-2.0) są darmowe i dobre, ale rozwiązują problem,
 * którego tu nie ma: kolizje wielu ciał. Tu jest jedno ciało, dwa punkty żelaza i siatka.
 * Za to każdy z nich dodaje od 90 do 400 kB do paczki easter egga i odbiera kontrolę nad
 * dokładnie tym, co w tej grze jest najważniejsze - wyczuciem lotu. Zamiast silnika
 * pożyczamy z tych gier MECHANIKĘ: celowanie przeciągnięciem z podglądem toru (model
 * „procy" znany z Angry Birds) i siatkę na więzach odległości (verlet), czyli to samo,
 * co silnik zrobiłby dla tkaniny.
 *
 * ------------------------------------------------------------------ krok czasu
 *
 * Fizyka liczy się stałym krokiem 1/120 s w akumulatorze, niezależnie od tego, ile klatek
 * daje przeglądarka. Na monitorze 144 Hz i na telefonie w oszczędzaniu energii lot jest
 * ten sam - przy liczeniu „na klatkę" gra na szybszym ekranie leciała szybciej.
 */

/* ---------------------------------------------------------------- plansza */

/*
  Zasady lotu, rozmiary i próg martwej strefy siedzą w `lib/gra/fizyka.ts` - tu zostaje
  rysowanie i sterowanie. Podział nie jest kosmetyczny: fizykę da się tam rozegrać bez
  przeglądarki i policzyć, ile błędu celowania jeszcze wpada.
*/

/** jak szybko celownik dogania kursor (0-1 na klatkę 60 Hz) */
const WYGLADZANIE = 0.24;


/* siatka jako tkanina na więzach - kolumny, rzędy i głębokość w pikselach świata */
const SIATKA_KOL = 11;
const SIATKA_RZED = 6;
const SIATKA_GLEB = 132;

type Faza = "rysowanie" | "gotowa" | "celowanie" | "lot" | "koniec";

interface Punkt {
  x: number;
  y: number;
  px: number;
  py: number;
  /** górny rząd wisi na obręczy i nie spada */
  przypiety: boolean;
}

interface Stan {
  faza: Faza;
  /** postęp rysowania kosza, 0-1 */
  rysunek: number;
  /** postęp pojawiania się piłki, 0-1 */
  pilka: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  obrot: number;
  /** wygładzony punkt celowania */
  celX: number;
  celY: number;
  /** surowa pozycja wskaźnika */
  wskX: number;
  wskY: number;
  nadObreczka: boolean;
  seria: number;
  czas: number;
  /** klatka ostatniego trafienia - do błysku obręczy */
  blysk: number;
  siatka: Punkt[];
}

export function RzutDoKosza({
  miejsce,
  rekord,
  zaczeta,
  onWynik,
  onSeria,
}: {
  miejsce: IdMiejsca;
  /** najlepszy wynik gracza w tym miejscu - stoi w tle planszy */
  rekord: number;
  /** dopóki false, plansza jest zamglona i nie przyjmuje rzutów (ekran tytułowy) */
  zaczeta: boolean;
  /** po zakończonej serii - odświeża ranking na stronie */
  onWynik: (seria: number) => void;
  /** przy każdej zmianie serii - licznik nad planszą */
  onSeria: (seria: number, komunikat: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stanRef = useRef<Stan>(nowyStan());
  const zaczetaRef = useRef(zaczeta);

  const sesja = useSesja();
  const zalogowany = Boolean(sesja?.user);

  /*
    Rekord czytamy przez ref, nie przez stan. Liczba stoi w tle planszy, czyli na kanwie -
    a pętla rysująca i tak działa poza Reactem. Trzymanie go dodatkowo w stanie tego
    komponentu dawałoby drugie źródło prawdy obok `EkranGry`, który już nim zarządza.
  */
  const rekordRef = useRef(rekord);
  useEffect(() => {
    rekordRef.current = rekord;
  }, [rekord]);

  /*
    Rysowanie kosza startuje w chwili zniknięcia ekranu tytułowego, nie przy montowaniu:
    plansza jest pod tytułem widoczna (rozmyta), więc gdyby kreska rysowała się od razu,
    cały efekt zdążyłby się skończyć, zanim ktokolwiek na niego spojrzy.
  */
  useEffect(() => {
    zaczetaRef.current = zaczeta;
    if (zaczeta) {
      const s = stanRef.current;
      s.faza = "rysowanie";
      s.rysunek = 0;
      s.pilka = 0;
    }
  }, [zaczeta]);

  /* piłki to te same pliki, co odznaczenia na profilu */
  const pilkiRef = useRef<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    (["zar", "iskra", "plomien", "niebieski"] as const).forEach((nazwa) => {
      const img = new Image();
      img.src = `/odznaczenia/${nazwa}.webp`;
      pilkiRef.current[nazwa] = img;
    });
  }, []);

  const zapiszWynik = useCallback(
    async (wynik: number) => {
      onWynik(wynik);
      if (!zalogowany || wynik <= 0) return;

      const supabase = await supabaseBrowser();
      if (!supabase) return;
      await supabase.rpc("minigra_zapisz", {
        p_miejsce: miejsce,
        p_seria: Math.min(wynik, MAKS_SERIA),
      });
    },
    [miejsce, onWynik, zalogowany]
  );

  /* ---------------------------------------------------------------- pętla */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let klatka = 0;
    let zywy = true;
    let poprzednia = performance.now();
    let zapas = 0;
    /* szerokość świata zależy od proporcji okna - liczona przy każdym dopasowaniu */
    let szer = WYS;

    const dopasuj = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      szer = (r.width / Math.max(r.height, 1)) * WYS;
      const s = stanRef.current;
      if (s.faza === "gotowa" || s.faza === "rysowanie" || s.faza === "koniec") {
        ustawPilke(s, szer);
      }
      if (!s.siatka.length) s.siatka = zbudujSiatke(szer / 2, WYS * KOSZ_Y);
    };
    dopasuj();
    const ro = new ResizeObserver(dopasuj);
    ro.observe(canvas);

    const petla = (teraz: number) => {
      if (!zywy) return;
      const s = stanRef.current;

      /* dt ograniczamy: po powrocie z innej karty zaległość byłaby liczona jak teleport */
      const dt = Math.min((teraz - poprzednia) / 1000, 0.05);
      poprzednia = teraz;
      s.czas += dt;

      const poziom = poziomDlaSerii(s.seria);
      const t = s.czas * poziom.tempo;
      const koszX = szer / 2 + Math.sin(t * 1.1) * poziom.bok * szer;
      const koszY = WYS * KOSZ_Y + Math.sin(t * 1.7 + 1.2) * poziom.pion * WYS;

      if (s.faza === "rysowanie") {
        s.rysunek = Math.min(1, s.rysunek + dt / 1.15);
        if (s.rysunek >= 1) s.pilka = Math.min(1, s.pilka + dt / 0.4);
        if (s.pilka >= 1) s.faza = "gotowa";
      } else if (zaczetaRef.current) {
        s.rysunek = 1;
        s.pilka = 1;
      }

      /* celownik dogania kursor wykładniczo - to on odpowiada za płynność */
      if (s.faza === "celowanie") {
        const k = 1 - Math.pow(1 - WYGLADZANIE, dt * 60);
        s.celX += (s.wskX - s.celX) * k;
        s.celY += (s.wskY - s.celY) * k;
      }

      /* --- fizyka stałym krokiem --- */
      zapas += dt;
      while (zapas >= KROK) {
        zapas -= KROK;
        if (s.faza === "lot") krokLotu(s, KROK, koszX, koszY);
        krokSiatki(s, KROK, koszX, koszY);
      }

      if (s.faza === "lot") {
        if (s.y < koszY - PILKA_R) s.nadObreczka = true;

        if (czyTrafienie(s, koszX, koszY, s.nadObreczka)) {
          s.seria += 1;
          s.blysk = s.czas;
          onSeria(s.seria, null);
          ustawPilke(s, szer);
          s.faza = "gotowa";
        } else if (s.y > WYS + 160 || s.x < -200 || s.x > szer + 200) {
          const wynik = s.seria;
          s.faza = "koniec";
          onSeria(wynik, wynik > 0 ? `Seria przerwana na ${wynik}` : "Pudło");
          void zapiszWynik(wynik);
        }
      }

      /* --- rysowanie --- */
      const skala = canvas.width / szer;
      ctx.setTransform(skala, 0, 0, skala, 0, 0);
      ctx.clearRect(0, 0, szer, WYS);

      rysujRekord(ctx, szer, rekordRef.current);
      rysujKosz(ctx, koszX, koszY, s);
      rysujSiatke(ctx, s);
      if (s.faza === "celowanie") rysujTor(ctx, s, szer, koszX, koszY);
      rysujPilke(ctx, s, pilkiRef.current[poziom.pilka]);

      klatka = requestAnimationFrame(petla);
    };

    klatka = requestAnimationFrame(petla);

    return () => {
      zywy = false;
      cancelAnimationFrame(klatka);
      ro.disconnect();
    };
  }, [onSeria, zapiszWynik]);

  /* ------------------------------------------------------------- wskaźnik */
  const naSwiat = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const szer = (r.width / Math.max(r.height, 1)) * WYS;
    return {
      x: ((e.clientX - r.left) / r.width) * szer,
      y: ((e.clientY - r.top) / r.height) * WYS,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zaczeta) return;
    const s = stanRef.current;
    if (s.faza === "lot" || s.faza === "rysowanie") return;

    if (s.faza === "koniec") {
      s.seria = 0;
      onSeria(0, null);
      const r = e.currentTarget.getBoundingClientRect();
      ustawPilke(s, (r.width / Math.max(r.height, 1)) * WYS);
    }

    const p = naSwiat(e);
    s.faza = "celowanie";
    s.wskX = p.x;
    s.wskY = p.y;
    /* celownik startuje w punkcie dotknięcia, nie w poprzednim - inaczej pierwsza klatka
       pokazywałaby tor sprzed sekundy i wyglądałoby to jak skok */
    s.celX = p.x;
    s.celY = p.y;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const ciagnij = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;
    const p = naSwiat(e);
    s.wskX = p.x;
    s.wskY = p.y;
  };

  const puszczaj = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* wskaźnik mógł już zniknąć - to nie powód, żeby nie oddać rzutu */
    }

    const rzut = wektorRzutu(s.x, s.y, s.celX, s.celY);
    if (!rzut) {
      s.faza = "gotowa";
      return;
    }

    s.vx = rzut.vx;
    s.vy = rzut.vy;
    s.faza = "lot";
    s.nadObreczka = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={ciagnij}
      onPointerUp={puszczaj}
      onPointerCancel={puszczaj}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label={zalogowany ? "Plansza gry" : "Plansza gry - grasz bez konta"}
    />
  );
}

/* ---------------------------------------------------------------- stan */

function nowyStan(): Stan {
  return {
    faza: "gotowa",
    rysunek: 0,
    pilka: 0,
    x: WYS / 2,
    y: WYS * 0.86,
    vx: 0,
    vy: 0,
    obrot: 0,
    celX: 0,
    celY: 0,
    wskX: 0,
    wskY: 0,
    nadObreczka: false,
    seria: 0,
    czas: 0,
    blysk: -99,
    siatka: [],
  };
}

function ustawPilke(s: Stan, szer: number) {
  /* stanowisko wybiera numer trafienia: każde trafienie przenosi na następne */
  const p = pozycjaPilki(szer, s.seria);
  s.x = p.x;
  s.y = p.y;
  s.vx = 0;
  s.vy = 0;
  s.obrot = 0;
  s.nadObreczka = false;
}

/* ---------------------------------------------------------------- siatka */

/**
 * Siatka jako tkanina na więzach odległości (verlet).
 *
 * Górny wieniec wisi na obręczy, resztę ciągnie w dół grawitacja, a więzy trzymają nitki
 * na stałej długości. Dokładnie to samo zrobiłby silnik fizyki dla tkaniny - tylko że
 * tutaj mieści się w czterdziestu linijkach i nic więcej nie musi umieć.
 *
 * Piłka odpycha punkty promieniowo, więc przelot przez obręcz szarpie siatką w dół i na
 * boki, a potem więzy same ją składają. Nie ma tu żadnej animacji „po trafieniu" -
 * siatka rusza się, bo coś przez nią przeszło.
 *
 * Górny wieniec siedzi na PRZEDNIEJ połowie elipsy obręczy, nie na prostej. Obręcz jest
 * rysowana w lekkiej perspektywie, więc nitki przypięte do odcinka odstawałyby od żelaza
 * dokładnie w środku, tam gdzie elipsa opada najniżej.
 */
function zbudujSiatke(x: number, y: number): Punkt[] {
  const p: Punkt[] = [];
  for (let r = 0; r < SIATKA_RZED; r++) {
    const t = r / (SIATKA_RZED - 1);
    /* stożek: dolny wieniec jest węższy od obręczy */
    const promien = OBRECZ_R * (1 - t * 0.44);
    for (let k = 0; k < SIATKA_KOL; k++) {
      const u = k / (SIATKA_KOL - 1);
      const px = x - promien + u * promien * 2;
      const py = y + krzywaObreczy(u) + t * SIATKA_GLEB;
      p.push({ x: px, y: py, px, py, przypiety: r === 0 });
    }
  }
  return p;
}

function krokSiatki(s: Stan, dt: number, koszX: number, koszY: number) {
  const p = s.siatka;
  if (!p.length) return;

  for (let r = 0; r < SIATKA_RZED; r++) {
    for (let k = 0; k < SIATKA_KOL; k++) {
      const i = r * SIATKA_KOL + k;
      const pkt = p[i];

      if (pkt.przypiety) {
        /* górny wieniec trzyma się obręczy, także wtedy, gdy kosz ucieka na boki */
        const u = k / (SIATKA_KOL - 1);
        pkt.x = koszX - OBRECZ_R + u * OBRECZ_R * 2;
        pkt.y = koszY + krzywaObreczy(u);
        pkt.px = pkt.x;
        pkt.py = pkt.y;
        continue;
      }

      /* verlet: nowa pozycja z poprzedniej i przyspieszenia, bez trzymania prędkości */
      const vx = (pkt.x - pkt.px) * 0.94;
      const vy = (pkt.y - pkt.py) * 0.94;
      pkt.px = pkt.x;
      pkt.py = pkt.y;
      pkt.x += vx;
      pkt.y += vy + GRAWITACJA * 0.35 * dt * dt;

      /* piłka rozpycha nitki - stąd szarpnięcie przy przelocie */
      const dx = pkt.x - s.x;
      const dy = pkt.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < PILKA_R * 1.15 && d > 0.001) {
        const push = (PILKA_R * 1.15 - d) * 0.6;
        pkt.x += (dx / d) * push;
        pkt.y += (dy / d) * push;
      }
    }
  }

  /* więzy: dwa przebiegi wystarczają, siatka nie musi być sztywna */
  for (let iter = 0; iter < 2; iter++) {
    for (let r = 0; r < SIATKA_RZED; r++) {
      for (let k = 0; k < SIATKA_KOL; k++) {
        const i = r * SIATKA_KOL + k;
        if (k < SIATKA_KOL - 1) wiaz(p[i], p[i + 1], dlugoscPoziom(r));
        if (r < SIATKA_RZED - 1) wiaz(p[i], p[i + SIATKA_KOL], SIATKA_GLEB / (SIATKA_RZED - 1));
      }
    }
  }
}

function dlugoscPoziom(r: number) {
  const t = r / (SIATKA_RZED - 1);
  return (OBRECZ_R * 2 * (1 - t * 0.44)) / (SIATKA_KOL - 1);
}

function wiaz(a: Punkt, b: Punkt, dl: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return;
  const roznica = (d - dl) / d;
  const ruchA = a.przypiety ? 0 : b.przypiety ? 1 : 0.5;
  const ruchB = b.przypiety ? 0 : a.przypiety ? 1 : 0.5;
  a.x += dx * roznica * ruchA;
  a.y += dy * roznica * ruchA;
  b.x -= dx * roznica * ruchB;
  b.y -= dy * roznica * ruchB;
}

/* ---------------------------------------------------------------- rysunki */

/**
 * Barwa z motywu, wyliczona na liczby.
 *
 * Kanwa 2D nie czyta arkusza: `ctx.fillStyle = "var(--color-flame)"` nie jest błędem,
 * jest ciszą - przeglądarka odrzuca nierozpoznaną wartość i zostawia poprzednią barwę.
 */
function barwa(nazwa: string, awaryjna: string, alfa?: number) {
  const v =
    typeof window === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue(nazwa).trim();
  if (!v) return awaryjna;
  return alfa === undefined ? v : `rgb(${v} / ${alfa})`;
}

/** Rekord jako wydrążona liczba w tle - ten sam zabieg co numery w rankingu. */
function rysujRekord(ctx: CanvasRenderingContext2D, szer: number, rekord: number) {
  if (rekord <= 0) return;
  ctx.save();
  ctx.font = "800 340px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = barwa("--rgb-szyba", "rgba(255,255,255,.07)", 0.07);
  ctx.strokeText(String(rekord), szer / 2, WYS * 0.62);
  ctx.restore();
}

/**
 * Kosz: tablica, kwadrat celowniczy, mocowanie, obręcz w perspektywie i siatka.
 *
 * Poprzednia wersja była trzema prostokątami i odcinkiem - czytelna, ale wyglądała jak
 * schemat, nie jak kosz. Trzy rzeczy to zmieniają:
 *
 *   1. OBRĘCZ JEST ELIPSĄ, nie odcinkiem. Sam kształt daje perspektywę: przednia połowa
 *      idzie grubą kreską w barwie marki, tylna cieńszą i przygaszoną, jakby schodziła
 *      za siatkę. Fizyka na tym nie traci - krańce elipsy leżą dokładnie tam, gdzie
 *      punkty zderzeń z żelazem, czyli na wysokości obręczy.
 *   2. TABLICA MA SZYBĘ - bardzo słabe wypełnienie i jaśniejszą krawędź. Puste obrysy
 *      wyglądały na dziurę w tle, a nie na płytę, przez którą coś prześwituje.
 *   3. MOCOWANIE. Dwa krótkie ukosy od dołu tablicy do obręczy. Bez nich obręcz wisiała
 *      w powietrzu pod tablicą i to była pierwsza rzecz, która rzucała się w oczy.
 *
 * Wszystko rysuje się z postępem 0-1, każdy element w swoim oknie - to ten sam gest, co
 * obrysy na tłach strony, tylko że tam rysuje je CSS, a tu trzeba rozłożyć ścieżki na
 * ułamki.
 */
function rysujKosz(ctx: CanvasRenderingContext2D, x: number, y: number, s: Stan) {
  const p = s.rysunek;
  if (p <= 0) return;

  const { tablica, kwadrat, mocowanie } = geometriaKosza(x, y);
  const lewa = tablica.x;
  const gora = tablica.y;
  const kreda = barwa("--rgb-szyba", "rgba(226,228,236,.6)", 0.5);
  const kredaMocna = barwa("--rgb-szyba", "rgba(226,228,236,.8)", 0.72);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  /* szyba tablicy - pojawia się razem z jej obwodem, więc płyta nie „doskakuje" po nim */
  const szyba = okno(p, 0.06, 0.5);
  if (szyba > 0) {
    ctx.globalAlpha = szyba;
    const g = ctx.createLinearGradient(lewa, gora, lewa, gora + TABLICA_WYS);
    g.addColorStop(0, barwa("--rgb-szyba", "rgba(255,255,255,.07)", 0.07));
    g.addColorStop(1, barwa("--rgb-szyba", "rgba(255,255,255,.02)", 0.02));
    ctx.fillStyle = g;
    zaokraglonaSciezka(ctx, lewa, gora, TABLICA_SZER, TABLICA_WYS, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* obwód tablicy rysowany od górnego lewego narożnika */
  ctx.strokeStyle = kredaMocna;
  ctx.lineWidth = 5;
  obwod(ctx, lewa, gora, TABLICA_SZER, TABLICA_WYS, okno(p, 0, 0.42));

  /* kwadrat celowniczy */
  ctx.strokeStyle = kreda;
  ctx.lineWidth = 4;
  obwod(ctx, kwadrat.x, kwadrat.y, kwadrat.w, kwadrat.h, okno(p, 0.3, 0.58));

  /* mocowanie: dwa ukosy od dołu tablicy do krańców obręczy */
  const moc = okno(p, 0.5, 0.66);
  if (moc > 0) {
    ctx.strokeStyle = kredaMocna;
    ctx.lineWidth = 6;
    for (const { ax, ay, bx, by } of mocowanie) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + (bx - ax) * moc, ay + (by - ay) * moc);
      ctx.stroke();
    }
  }

  /* obręcz: tylna połowa elipsy przygaszona, przednia w barwie marki */
  const o = okno(p, 0.6, 1);
  if (o > 0) {
    const swieze = Math.max(0, 1 - (s.czas - s.blysk) / 0.5);

    ctx.strokeStyle = barwa("--rgb-ember", "rgba(255,77,10,.45)", 0.35 + swieze * 0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, OBRECZ_R, OBRECZ_RY, 0, Math.PI, Math.PI + Math.PI * o);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = barwa("--rgb-ember", "rgba(255,77,10,.7)", 0.5 + swieze * 0.45);
    ctx.shadowBlur = 16 + swieze * 26;
    ctx.strokeStyle = barwa("--color-ember", "#ff4d0a");
    ctx.lineWidth = 9 + swieze * 3;
    ctx.beginPath();
    ctx.ellipse(x, y, OBRECZ_R, OBRECZ_RY, 0, 0, Math.PI * o);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/** Ułamek postępu w zadanym oknie - 0 przed, 1 po, liniowo w środku. */
function okno(p: number, od: number, do_: number) {
  if (p <= od) return 0;
  if (p >= do_) return 1;
  return (p - od) / (do_ - od);
}

/** Ścieżka zaokrąglonego prostokąta - bez rysowania, do wypełnienia albo obrysu. */
function zaokraglonaSciezka(
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
function obwod(
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
 * Siatka: nitki pionowe, wieńce poziome i przeplot na ukos.
 *
 * Ukosy to jedyny dodatek, który zmienia rysunek z „kilku kresek pod obręczą" w siatkę:
 * dopiero po nich widać oczka. Idą tylko w jedną stronę na rząd, naprzemiennie, bo pełny
 * przeplot w obu kierunkach przy dziewięciu kolumnach zamienia się w plamę.
 */
function rysujSiatke(ctx: CanvasRenderingContext2D, s: Stan) {
  const p = s.siatka;
  const post = okno(s.rysunek, 0.7, 1);
  if (!p.length || post <= 0) return;

  ctx.save();
  ctx.lineCap = "round";

  const rzedy = Math.max(2, Math.round(SIATKA_RZED * post));
  const pkt = (r: number, k: number) => p[r * SIATKA_KOL + k];

  /* nitki pionowe - gasną ku dołowi, bo tam siatka jest luźniejsza i cieńsza */
  for (let k = 0; k < SIATKA_KOL; k++) {
    ctx.beginPath();
    for (let r = 0; r < rzedy; r++) {
      const q = pkt(r, k);
      if (r === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = barwa("--rgb-szyba", "rgba(255,255,255,.4)", 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* wieńce poziome - bez górnego, tam jest już żelazo obręczy */
  for (let r = 1; r < rzedy; r++) {
    ctx.beginPath();
    for (let k = 0; k < SIATKA_KOL; k++) {
      const q = pkt(r, k);
      if (k === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = barwa("--rgb-szyba", "rgba(255,255,255,.28)", 0.26);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  /* przeplot na ukos - to on robi oczka */
  ctx.strokeStyle = barwa("--rgb-szyba", "rgba(255,255,255,.2)", 0.18);
  ctx.lineWidth = 1.4;
  for (let r = 0; r < rzedy - 1; r++) {
    const wPrawo = r % 2 === 0;
    ctx.beginPath();
    for (let k = 0; k < SIATKA_KOL - 1; k++) {
      const a = wPrawo ? pkt(r, k) : pkt(r, k + 1);
      const b = wPrawo ? pkt(r + 1, k + 1) : pkt(r + 1, k);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Kropkowany tor rzutu.
 *
 * Tor bierzemy z `rozegrajRzut` - z tej samej funkcji, która rozgrywa prawdziwy lot, tym
 * samym krokiem i z tymi samymi odbiciami od żelaza. To nie oszczędność kodu, a warunek
 * uczciwości podglądu: gdyby tor liczył się inaczej niż lot, kropki byłyby obietnicą,
 * której gra nie dotrzymuje - a wtedy lepiej byłoby ich nie rysować wcale.
 */
function rysujTor(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  szer: number,
  koszX: number,
  koszY: number
) {
  const rzut = wektorRzutu(s.x, s.y, s.celX, s.celY);
  if (!rzut) return;

  const { tor } = rozegrajRzut(s.x, s.y, s.celX, s.celY, koszX, koszY, szer);

  ctx.save();
  /* pokazujemy początek toru, nie całość: dalej piłka odbija się od obręczy i dokładna
     dalsza droga zależy już od żelaza, a nie od celowania */
  const ile = Math.min(tor.length, 30);
  for (let i = 0; i < ile; i++) {
    const zanik = 1 - i / ile;
    ctx.fillStyle = barwa("--rgb-glow", "rgba(255,178,92,.5)", 0.1 + zanik * 0.5);
    ctx.beginPath();
    ctx.arc(tor[i].x, tor[i].y, 3 + zanik * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* uchwyt celowania: krótka kreska od piłki w stronę ciągnięcia */
  ctx.strokeStyle = barwa("--rgb-flame", "rgba(255,122,24,.55)", 0.45);
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.celX, s.celY);
  ctx.stroke();
  ctx.setLineDash([]);

  /* pierścień siły - rośnie z mocą, więc widać ją bez patrzenia na tor */
  ctx.strokeStyle = barwa("--rgb-ember", "rgba(255,77,10,.7)", 0.35 + rzut.moc * 0.5);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s.x, s.y, PILKA_R + 10 + rzut.moc * 16, 0, Math.PI * 2 * rzut.moc);
  ctx.stroke();

  ctx.restore();
}

function rysujPilke(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  obrazek: HTMLImageElement | undefined
) {
  if (s.pilka <= 0) return;
  /* piłka pojawia się z lekkim przeskalowaniem - stąd „wjazd" po dorysowaniu kosza */
  const skala = 0.7 + 0.3 * s.pilka;
  const r = PILKA_R * skala;

  ctx.save();
  ctx.globalAlpha = s.pilka;

  const swiatlo = ctx.createRadialGradient(s.x, s.y, r * 0.5, s.x, s.y, r * 1.9);
  swiatlo.addColorStop(0, barwa("--rgb-flame", "rgba(255,122,24,.34)", 0.3));
  swiatlo.addColorStop(1, barwa("--rgb-flame", "rgba(255,122,24,0)", 0));
  ctx.fillStyle = swiatlo;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(s.x, s.y);
  ctx.rotate(s.obrot);
  if (obrazek?.complete && obrazek.naturalWidth) {
    ctx.drawImage(obrazek, -r, -r, r * 2, r * 2);
  } else {
    ctx.fillStyle = barwa("--color-flame", "#ff7a18");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
