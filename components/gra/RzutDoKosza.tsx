"use client";

import { useCallback, useEffect, useRef } from "react";
import { MAKS_SERIA, poziomDlaSerii, type IdMiejsca } from "@/lib/minigra";
import { barwa, obwod, okno, rysujLicznik, rysujPilke, zaokraglonaSciezka } from "./rysunki";
import {
  KOSZ_Y,
  KROK,
  OBRECZ_R,
  OBRECZ_RY,
  PILKA_R,
  TABLICA_SZER,
  TABLICA_WYS,
  WYS,
  SIATKA_KOL,
  SIATKA_RZED,
  czyTrafienie,
  geometriaKosza,
  krokLotu,
  krokSiatki,
  predkoscObrotu,
  pozycjaPilki,
  type PunktSiatki,
  zbudujSiatke,
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


/*
  „wpadla" jest osobną fazą, a nie chwilą. Wcześniej trafienie natychmiast przenosiło piłkę
  na następne stanowisko - czyli w klatce, w której czubek piłki mijał płaszczyznę obręczy,
  piłka po prostu znikała. Siatka dostawała wtedy jedno szturchnięcie i nic więcej: nie było
  czego przez nią przepuścić. Teraz piłka leci dalej przez siatkę i tam ją rozpycha, a na
  następne stanowisko wraca po `CZAS_PRZELOTU`.
*/
type Faza = "rysowanie" | "gotowa" | "celowanie" | "lot" | "wpadla" | "koniec";

/** ile piłka leci jeszcze po trafieniu, żeby przejść przez całą siatkę (w sekundach) */
const CZAS_PRZELOTU = 0.55;


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
  /**
   * Prędkość obrotu w radianach na sekundę, nadawana w chwili rzutu.
   *
   * Osobno od kąta, bo obrót nie jest ozdobą doklejoną do lotu - wynika z rzutu i ma
   * o nim mówić. Do tej pory nikt jej nie ustawiał i piłka leciała bez obrotu w ogóle.
   */
  obrotV: number;
  /** wygładzony punkt celowania */
  celX: number;
  celY: number;
  /** surowa pozycja wskaźnika */
  wskX: number;
  wskY: number;
  nadObreczka: boolean;
  /** czas od trafienia - odlicza przelot przez siatkę */
  przelot: number;
  seria: number;
  czas: number;
  /** klatka ostatniego trafienia - do błysku obręczy */
  blysk: number;
  siatka: PunktSiatki[];
}

export function RzutDoKosza({
  miejsce,
  zaczeta,
  onWynik,
  onSeria,
}: {
  miejsce: IdMiejsca;
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
        if (s.faza === "lot" || s.faza === "wpadla") krokLotu(s, KROK, koszX, koszY);
        krokSiatki(s, KROK, koszX, koszY);
      }

      /* obrót leci razem z piłką - także po trafieniu, w czasie przelotu przez siatkę */
      if (s.faza === "lot" || s.faza === "wpadla") s.obrot += s.obrotV * dt;

      if (s.faza === "wpadla") {
        /* piłka przelatuje przez siatkę - dopiero potem wraca na następne stanowisko */
        s.przelot += dt;
        if (s.przelot >= CZAS_PRZELOTU) {
          ustawPilke(s, szer);
          s.faza = "gotowa";
        }
      } else if (s.faza === "lot") {
        if (s.y < koszY - PILKA_R) s.nadObreczka = true;

        if (czyTrafienie(s, koszX, koszY, s.nadObreczka)) {
          s.seria += 1;
          s.blysk = s.czas;
          s.przelot = 0;
          s.faza = "wpadla";
          onSeria(s.seria, null);
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

      rysujLicznik(ctx, szer, WYS, s.seria, Math.max(0, 1 - (s.czas - s.blysk) / 0.45));
      /*
        Siatka rysuje się PO piłce, żeby przy przelocie przednie nitki przechodziły przed
        nią. Odwrotna kolejność zasłaniała siatkę piłką dokładnie w tej jednej chwili,
        w której cała rzecz się dzieje.
      */
      rysujKosz(ctx, koszX, koszY, s);
      if (s.faza === "celowanie") rysujTor(ctx, s, szer, koszX, koszY);
      rysujPilke(ctx, {
        x: s.x,
        y: s.y,
        /* piłka pojawia się z lekkim przeskalowaniem - stąd „wjazd" po dorysowaniu kosza */
        r: PILKA_R * (0.7 + 0.3 * s.pilka),
        obrot: s.obrot,
        alfa: s.pilka,
        stopien: poziom.pilka,
      });
      rysujSiatke(ctx, s);

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
    if (s.faza === "lot" || s.faza === "wpadla" || s.faza === "rysowanie") return;

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

    /* obrót z rzutu - kierunek, moc i kąt, opis przy funkcji w lib/gra/fizyka.ts */
    s.obrotV = predkoscObrotu(rzut.vx, rzut.vy, rzut.moc);

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
    obrotV: 0,
    celX: 0,
    celY: 0,
    wskX: 0,
    wskY: 0,
    nadObreczka: false,
    przelot: 0,
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
  s.obrotV = 0;
  s.nadObreczka = false;
}

/* ---------------------------------------------------------------- rysunki */

/**
 * Barwa z motywu, wyliczona na liczby.
 *
 * Kanwa 2D nie czyta arkusza: `ctx.fillStyle = "var(--color-flame)"` nie jest błędem,
 * jest ciszą - przeglądarka odrzuca nierozpoznaną wartość i zostawia poprzednią barwę.
 */
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
