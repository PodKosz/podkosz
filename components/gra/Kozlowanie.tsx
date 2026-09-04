"use client";

import { useCallback, useEffect, useRef } from "react";
import { MAKS_SERIA, poziomDlaSerii, type IdMiejsca } from "@/lib/minigra";
import {
  CZAS_RUNDY,
  PILKA_R,
  PODLOGA,
  WYS,
  krokKozlowania,
  liniaReki,
  nowaRunda,
  uderz,
  wRece,
  zablokowana,
  type StanKozlowania,
} from "@/lib/gra/kozlowanie";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";
import { barwa, okno, przezroczysta, rysujLicznik, rysujPilke } from "./rysunki";

/**
 * Minigra „kozłowanie": jak najwięcej kozłowań w minutę.
 *
 * Piłka skacze sama, a stuknięcie w ekran liczy się tylko wtedy, gdy dochodzi do ręki.
 * Wszystkie zasady - okno ręki, siła pchnięcia, kara za młotkowanie, przyspieszanie rytmu -
 * siedzą w `lib/gra/kozlowanie.ts` i dają się rozegrać bez przeglądarki. Tutaj zostaje
 * rysowanie i jedno zdarzenie wejścia.
 *
 * Cała nauka tej gry idzie przez JEDEN element rysunku: linię ręki. To przerywana kreska
 * na wysokości, do której piłka musi dojść, żeby uderzenie się liczyło - rozjaśnia się,
 * kiedy piłka wjeżdża w zasięg, i przygasa razem z karą po pudle. Bez niej gracz nie ma
 * skąd wiedzieć, czego gra od niego chce, i zostaje mu klikanie na oślep - czyli dokładnie
 * to, przed czym zasady mają go bronić.
 *
 * Parkiet rysuje się kreską przy starcie, tak samo jak kosz w drugiej grze, i kończy się
 * DOKŁADNIE na linii, od której odbija się piłka. Rysunek podłogi w tle SVG nie mógłby
 * tego zagwarantować: tamta warstwa skaluje się przez `preserveAspectRatio` i przy innych
 * proporcjach okna jej linia rozjeżdżałaby się z fizyką.
 */

type Faza = "rysowanie" | "gra" | "koniec";

interface Stan extends StanKozlowania {
  faza: Faza;
  /** postęp rysowania parkietu, 0-1 */
  rysunek: number;
  /** postęp pojawiania się piłki, 0-1 */
  widok: number;
  /** czas ostatniego stuknięcia - do fali pod palcem */
  stuk: number;
  stukX: number;
  stukY: number;
  /** czy ostatnie stuknięcie było zaliczone - fala ma barwę odpowiedzi */
  stukOk: boolean;
}

export function Kozlowanie({
  miejsce,
  zaczeta,
  onWynik,
  onSeria,
  onCzas,
}: {
  miejsce: IdMiejsca;
  zaczeta: boolean;
  onWynik: (wynik: number) => void;
  onSeria: (wynik: number, komunikat: string | null) => void;
  onCzas?: (sekundy: number | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stanRef = useRef<Stan>(nowyStan());
  const zaczetaRef = useRef(zaczeta);

  const sesja = useSesja();
  const zalogowany = Boolean(sesja?.user);

  useEffect(() => {
    zaczetaRef.current = zaczeta;
    if (zaczeta) {
      const s = stanRef.current;
      Object.assign(s, nowyStan());
      s.faza = "rysowanie";
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
    let szer = WYS;

    const dopasuj = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      szer = (r.width / Math.max(r.height, 1)) * WYS;
    };
    dopasuj();
    const ro = new ResizeObserver(dopasuj);
    ro.observe(canvas);

    const petla = (teraz: number) => {
      if (!zywy) return;
      const s = stanRef.current;

      const dt = Math.min((teraz - poprzednia) / 1000, 0.05);
      poprzednia = teraz;

      if (s.faza === "rysowanie") {
        s.rysunek = Math.min(1, s.rysunek + dt / 0.9);
        if (s.rysunek >= 1) s.widok = Math.min(1, s.widok + dt / 0.35);
        if (s.widok >= 1) {
          s.faza = "gra";
          s.czas = 0;
          onCzas?.(CZAS_RUNDY);
        }
      }

      /* --- fizyka stałym krokiem, tak samo jak w drugiej grze --- */
      if (s.faza === "gra") {
        zapas += dt;
        const KROK = 1 / 120;
        while (zapas >= KROK) {
          zapas -= KROK;
          krokKozlowania(s, KROK);
        }

        const zostalo = Math.max(0, CZAS_RUNDY - s.czas);
        onCzas?.(zostalo);

        if (zostalo <= 0) {
          s.faza = "koniec";
          onSeria(s.ile, s.ile > 0 ? `Koniec - ${s.ile} ${odmiana(s.ile)}` : "Koniec - bez kozłowania");
          void zapiszWynik(s.ile);
        }
      }

      /* --- rysowanie --- */
      const skala = canvas.width / szer;
      ctx.setTransform(skala, 0, 0, skala, 0, 0);
      ctx.clearRect(0, 0, szer, WYS);

      const swieze = Math.max(0, 1 - (s.czas - s.uderzenie) / 0.45);
      rysujLicznik(ctx, szer, WYS, s.ile, swieze);
      rysujParkiet(ctx, szer, s);
      rysujLinieReki(ctx, szer, s);
      rysujCien(ctx, szer, s);
      rysujFale(ctx, s);
      rysujPilkeGry(ctx, szer, s);

      klatka = requestAnimationFrame(petla);
    };

    klatka = requestAnimationFrame(petla);

    return () => {
      zywy = false;
      cancelAnimationFrame(klatka);
      ro.disconnect();
    };
  }, [onCzas, onSeria, zapiszWynik]);

  /* ------------------------------------------------------------- wejście */
  const stuknij = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zaczeta) return;
    const s = stanRef.current;
    if (s.faza === "rysowanie") return;

    const r = e.currentTarget.getBoundingClientRect();
    const szer = (r.width / Math.max(r.height, 1)) * WYS;
    s.stuk = s.czas;
    s.stukX = ((e.clientX - r.left) / r.width) * szer;
    s.stukY = ((e.clientY - r.top) / r.height) * WYS;

    if (s.faza === "koniec") {
      /* nowa runda - stuknięcie po końcu zaczyna od zera */
      Object.assign(s, nowyStan());
      s.faza = "gra";
      s.rysunek = 1;
      s.widok = 1;
      onSeria(0, null);
      onCzas?.(CZAS_RUNDY);
      return;
    }

    const w = uderz(s);
    s.stukOk = w.ok;
    if (w.ok) onSeria(s.ile, null);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={stuknij}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label={zalogowany ? "Plansza gry" : "Plansza gry - grasz bez konta"}
    />
  );
}

/* ---------------------------------------------------------------- stan */

function nowyStan(): Stan {
  return {
    ...nowaRunda(),
    faza: "gra",
    rysunek: 0,
    widok: 0,
    stuk: -99,
    stukX: 0,
    stukY: 0,
    stukOk: true,
  };
}

function odmiana(ile: number) {
  if (ile === 1) return "kozłowanie";
  const dwie = ile % 100;
  const jeden = ile % 10;
  if (jeden >= 2 && jeden <= 4 && !(dwie >= 12 && dwie <= 14)) return "kozłowania";
  return "kozłowań";
}

/* ---------------------------------------------------------------- rysunki */

/**
 * Parkiet: linia podłogi, deski w perspektywie i dwie linie boiska.
 *
 * Deski zbiegają się do punktu wysoko nad kadrem, nie do środka: przy zbiegu w środku
 * parkiet czyta się jak wachlarz, a nie jak podłoga, po której się chodzi. Poprzeczki
 * gęstnieją ku górze, bo tak działa perspektywa - i to one, nie same deski, dają wrażenie
 * głębokości.
 */
function rysujParkiet(ctx: CanvasRenderingContext2D, szer: number, s: Stan) {
  const p = s.rysunek;
  if (p <= 0) return;

  const linia = WYS * PODLOGA;
  const kreda = barwa("--rgb-szyba", "rgba(226,228,236,.55)", 0.42);
  const slaba = barwa("--rgb-szyba", "rgba(226,228,236,.3)", 0.2);

  ctx.save();
  ctx.lineCap = "round";

  /* linia podłogi - rysuje się od środka na oba boki, bo od niej odbija się piłka */
  const l = okno(p, 0, 0.4);
  if (l > 0) {
    ctx.strokeStyle = kreda;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(szer / 2 - (szer / 2) * l, linia);
    ctx.lineTo(szer / 2 + (szer / 2) * l, linia);
    ctx.stroke();
  }

  /* deski - od linii podłogi w dół, w stronę widza */
  const d = okno(p, 0.28, 0.78);
  if (d > 0) {
    const zbiegY = -WYS * 0.6;
    const t = (WYS - zbiegY) / (linia - zbiegY);
    ctx.strokeStyle = slaba;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) {
      const x = szer / 2 + i * (WYS * 0.13);
      if (x < -100 || x > szer + 100) continue;
      const xDol = szer / 2 + (x - szer / 2) * t;
      ctx.moveTo(x, linia);
      ctx.lineTo(x + (xDol - x) * d, linia + (WYS - linia) * d);
    }
    ctx.stroke();
  }

  /* poprzeczki */
  const q = okno(p, 0.5, 0.9);
  if (q > 0) {
    ctx.strokeStyle = slaba;
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 4; i++) {
      const y = linia + (WYS - linia) * Math.pow(i / 5, 1.7);
      const u = okno(q, (i - 1) / 5, 1);
      if (u <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(szer / 2 - (szer / 2) * u, y);
      ctx.lineTo(szer / 2 + (szer / 2) * u, y);
      ctx.stroke();
    }
  }

  /* łuk rzutów wolnych - jedna kreska, żeby to był parkiet, a nie deska */
  const a = okno(p, 0.7, 1);
  if (a > 0) {
    ctx.strokeStyle = slaba;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(szer / 2, linia, WYS * 0.3, WYS * 0.07, 0, 0, Math.PI * a);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Linia ręki - jedyna instrukcja tej gry.
 *
 * Przerywana kreska na wysokości, do której piłka musi dojść. Rozjaśnia się, kiedy piłka
 * wjeżdża w zasięg (wtedy uderzenie się liczy), i robi się czerwona w czasie kary po pudle.
 * Bez niej gra jest zagadką: piłka skacze, stuknięcia raz się liczą, raz nie, i nie ma
 * z czego wywnioskować, dlaczego.
 */
function rysujLinieReki(ctx: CanvasRenderingContext2D, szer: number, s: Stan) {
  if (s.widok <= 0) return;

  const y = WYS * PODLOGA - PILKA_R - liniaReki(s.ile);
  const gotowa = wRece(s);
  const kara = zablokowana(s);

  ctx.save();
  ctx.globalAlpha = s.widok;
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = gotowa ? 3 : 2;
  ctx.strokeStyle = kara
    ? barwa("--rgb-ember", "rgba(255,77,10,.5)", 0.45)
    : gotowa
      ? barwa("--rgb-glow", "rgba(255,178,92,.75)", 0.75)
      : barwa("--rgb-szyba", "rgba(255,255,255,.22)", 0.22);
  ctx.beginPath();
  ctx.moveTo(szer * 0.16, y);
  ctx.lineTo(szer * 0.84, y);
  ctx.stroke();
  ctx.restore();
}

/** Cień piłki na parkiecie - im wyżej piłka, tym mniejszy i słabszy. */
function rysujCien(ctx: CanvasRenderingContext2D, szer: number, s: Stan) {
  if (s.widok <= 0) return;

  const linia = WYS * PODLOGA;
  const wysokosc = Math.max(0, linia - PILKA_R - s.y);
  const blisko = 1 - Math.min(wysokosc / (WYS * 0.5), 1);

  ctx.save();
  ctx.globalAlpha = s.widok * (0.12 + blisko * 0.4);
  ctx.fillStyle = "rgb(0 0 0 / calc(1 * var(--moc-cienia, 1)))";
  ctx.beginPath();
  ctx.ellipse(szer / 2, linia + 4, PILKA_R * (0.5 + blisko * 0.8), PILKA_R * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Fala pod palcem - potwierdzenie, że stuknięcie doszło, i CZY się zaliczyło.
 *
 * Dwie barwy, bo to jedyne miejsce, gdzie gra odpowiada na sam dotyk: ciepła znaczy
 * kozłowanie, czerwona - stuknięcie poza zasięgiem, po którym ręka podnosi piłkę i traci
 * serię. Bez rozróżnienia oba wyglądają tak samo i nie da się nauczyć rytmu.
 */
function rysujFale(ctx: CanvasRenderingContext2D, s: Stan) {
  const wiek = s.czas - s.stuk;
  if (wiek < 0 || wiek > 0.45) return;

  const t = wiek / 0.45;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.lineWidth = 3 * (1 - t) + 1;
  ctx.strokeStyle = s.stukOk
    ? barwa("--rgb-glow", "rgba(255,178,92,.6)", 0.5)
    : barwa("--rgb-ember", "rgba(255,77,10,.6)", 0.5);
  ctx.beginPath();
  ctx.arc(s.stukX, s.stukY, 12 + t * 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Piłka: ta sama, co w rzucie do kosza, plus zgniecenie o parkiet.
 *
 * Spłaszczenie liczymy z czasu od kontaktu z podłogą - krótkie i mocne, bo tak wygląda
 * piłka odbijająca się od twardego parkietu. Barwa idzie ze stopni: co dwadzieścia
 * kozłowań piłka zmienia stopień, tak samo jak przy seriach trafień.
 */
function rysujPilkeGry(ctx: CanvasRenderingContext2D, szer: number, s: Stan) {
  const wiek = s.czas - s.kontakt;
  const zgniecenie = wiek >= 0 && wiek < 0.14 ? 1 - 0.3 * (1 - wiek / 0.14) : 1;

  rysujPilke(ctx, {
    x: szer / 2,
    y: s.y,
    r: PILKA_R * (0.7 + 0.3 * s.widok),
    obrot: s.obrot,
    alfa: s.widok,
    splaszczenie: zgniecenie,
    stopien: poziomDlaSerii(s.ile).pilka,
  });

  /* czyste uderzenie zostawia na chwilę pierścień - to jedyna nagroda za dokładność */
  const swieze = s.czas - s.uderzenie;
  if (swieze >= 0 && swieze < 0.3 && s.seria > 0) {
    const t = swieze / 0.3;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.lineWidth = 3;
    ctx.strokeStyle = przezroczysta(barwa("--iskra-a", "#ffe9a8"), 0.8);
    ctx.beginPath();
    ctx.arc(szer / 2, s.y, PILKA_R * (1.1 + t * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
