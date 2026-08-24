"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAKS_SERIA, poziomDlaSerii, type IdMiejsca } from "@/lib/minigra";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";
import { TloBoiska } from "./TlaBoisk";

/**
 * Minigra: rzut do kosza swipem.
 *
 * Zasada jest ta sama, co w starej grze z komunikatora - łapiesz piłkę, przeciągasz
 * w stronę kosza i puszczasz. Kierunek i długość przeciągnięcia to wektor rzutu, resztę
 * robi grawitacja.
 *
 * Seria kończy się na pierwszym pudle i to ona jest wynikiem - dlatego trudność rośnie
 * razem z nią, a nie z liczbą podejść. Kosz zaczyna uciekać dopiero po dwudziestu
 * trafieniach: pierwsze rzuty mają być spokojne, żeby dało się zrozumieć zasady.
 *
 * Rysujemy na `canvas`, bo lecąca piłka to sześćdziesiąt klatek na sekundę - w DOM-ie
 * każda z nich byłaby przeliczeniem układu strony. Tło zostaje SVG pod spodem: jest
 * nieruchome, więc nie ma powodu przerysowywać go w każdej klatce.
 */

/* Świat gry ma stałe wymiary, a canvas tylko go skaluje - dzięki temu fizyka zachowuje
   się identycznie na telefonie i na monitorze. */
const SZER = 1000;
const WYS = 680;

const GRAWITACJA = 0.42;
const OPOR = 0.999;
const SILA = 0.155;
const MAKS_SILA = 27;

const PILKA_R = 34;
const START_X = 210;
const START_Y = 548;

const KOSZ_X = 748;
const KOSZ_Y = 332;
const OBRECZ_R = 52;

type Faza = "gotowa" | "celowanie" | "lot" | "koniec";

interface Stan {
  faza: Faza;
  x: number;
  y: number;
  vx: number;
  vy: number;
  obrot: number;
  /* skąd i dokąd ciągnie palec */
  odX: number;
  odY: number;
  doX: number;
  doY: number;
  /* czy w tym locie piłka była już nad obręczą - bez tego licząc trafienie z dołu */
  nadObreczka: boolean;
  seria: number;
  czas: number;
}

export function RzutDoKosza({
  miejsce,
  rekord,
  onWynik,
}: {
  miejsce: IdMiejsca;
  /** najlepszy wynik zalogowanego gracza w tym miejscu */
  rekord: number;
  /** wywoływane po zakończeniu serii - odświeża ranking na stronie */
  onWynik: (seria: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stanRef = useRef<Stan>({
    faza: "gotowa",
    x: START_X,
    y: START_Y,
    vx: 0,
    vy: 0,
    obrot: 0,
    odX: 0,
    odY: 0,
    doX: 0,
    doY: 0,
    nadObreczka: false,
    seria: 0,
    czas: 0,
  });

  const [seria, setSeria] = useState(0);
  const [najlepszy, setNajlepszy] = useState(rekord);
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [zagrane, setZagrane] = useState(false);

  const sesja = useSesja();
  const zalogowany = Boolean(sesja?.user);

  /* piłki wczytujemy raz - to te same pliki, co odznaczenia na profilu */
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

    const dopasuj = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    };
    dopasuj();
    window.addEventListener("resize", dopasuj);

    const rysuj = () => {
      if (!zywy) return;
      const s = stanRef.current;
      s.czas += 1;

      const poziom = poziomDlaSerii(s.seria);
      const t = (s.czas / 60) * poziom.tempo;
      const koszX = KOSZ_X + Math.sin(t * 1.1) * poziom.bok * SZER;
      const koszY = KOSZ_Y + Math.sin(t * 1.7 + 1.2) * poziom.pion * WYS;

      /* --- fizyka --- */
      if (s.faza === "lot") {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += GRAWITACJA;
        s.vx *= OPOR;
        s.obrot += s.vx * 0.02;

        /* tablica: odbicie od pionowej płyty za obręczą */
        const plytaX = koszX + OBRECZ_R + 10;
        if (
          s.vx > 0 &&
          s.x + PILKA_R > plytaX &&
          s.x - PILKA_R < plytaX + 14 &&
          s.y > koszY - 130 &&
          s.y < koszY + 10
        ) {
          s.x = plytaX - PILKA_R;
          s.vx *= -0.52;
        }

        if (s.y < koszY - PILKA_R) s.nadObreczka = true;

        /* trafienie: opada, jest w świetle obręczy i wcześniej była nad nią */
        const trafiona =
          s.vy > 0 &&
          s.nadObreczka &&
          Math.abs(s.y - koszY) < 14 &&
          Math.abs(s.x - koszX) < OBRECZ_R - 10;

        if (trafiona) {
          s.seria += 1;
          setSeria(s.seria);
          setNajlepszy((n) => Math.max(n, s.seria));
          setKomunikat(null);
          resetPilki(s);
        } else if (s.y > WYS + 120 || s.x < -140 || s.x > SZER + 140) {
          /* pudło kończy serię */
          const wynik = s.seria;
          s.faza = "koniec";
          setKomunikat(wynik > 0 ? `Seria przerwana na ${wynik}` : "Pudło - spróbuj jeszcze raz");
          void zapiszWynik(wynik);
        }
      }

      /* --- rysowanie --- */
      const skala = canvas.width / SZER;
      ctx.setTransform(skala, 0, 0, skala, 0, 0);
      ctx.clearRect(0, 0, SZER, WYS);

      rysujKosz(ctx, koszX, koszY);

      if (s.faza === "celowanie") rysujPodpowiedz(ctx, s);

      const obrazek = pilkiRef.current[poziom.pilka];
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.obrot);
      if (obrazek?.complete && obrazek.naturalWidth) {
        ctx.drawImage(obrazek, -PILKA_R, -PILKA_R, PILKA_R * 2, PILKA_R * 2);
      } else {
        ctx.fillStyle = "#ff7a18";
        ctx.beginPath();
        ctx.arc(0, 0, PILKA_R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      klatka = requestAnimationFrame(rysuj);
    };

    klatka = requestAnimationFrame(rysuj);

    return () => {
      zywy = false;
      cancelAnimationFrame(klatka);
      window.removeEventListener("resize", dopasuj);
    };
  }, [zapiszWynik]);

  /* ------------------------------------------------------------- sterowanie */
  const naSwiat = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SZER,
      y: ((e.clientY - r.top) / r.height) * WYS,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza === "lot") return;

    if (s.faza === "koniec") {
      s.seria = 0;
      setSeria(0);
      setKomunikat(null);
      resetPilki(s);
    }

    const p = naSwiat(e);
    s.faza = "celowanie";
    s.odX = p.x;
    s.odY = p.y;
    s.doX = p.x;
    s.doY = p.y;
    setZagrane(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const ciagnij = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;
    const p = naSwiat(e);
    s.doX = p.x;
    s.doY = p.y;
  };

  const puszczaj = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;

    const dx = s.doX - s.odX;
    const dy = s.doY - s.odY;
    const dlugosc = Math.hypot(dx, dy);

    /* zbyt krótkie machnięcie to najczęściej przypadkowe dotknięcie - nie strzelamy */
    if (dlugosc < 26) {
      s.faza = "gotowa";
      return;
    }

    const moc = Math.min(dlugosc * SILA, MAKS_SILA);
    s.vx = (dx / dlugosc) * moc;
    s.vy = (dy / dlugosc) * moc;
    s.faza = "lot";
    s.nadObreczka = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const poziom = poziomDlaSerii(seria);

  return (
    <div className="relative overflow-hidden rounded-[28px] shadow-[0_40px_90px_-40px_rgba(0,0,0,.95)]">
      <div className="relative aspect-[1000/680] w-full">
        <TloBoiska miejsce={miejsce} />

        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={ciagnij}
          onPointerUp={puszczaj}
          onPointerCancel={puszczaj}
          className="absolute inset-0 h-full w-full touch-none"
        />

        {/* licznik serii i poziom - nad planszą, nie zasłaniają toru piłki */}
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
          <span className="szklo-pro rounded-full px-4 py-2 text-[13px] text-ink">
            seria <b className="text-[16px]">{seria}</b>
          </span>
          <span className="szklo-pro rounded-full px-4 py-2 text-[13px] text-muted">
            rekord <b className="text-ink">{najlepszy}</b>
          </span>
        </div>

        <div className="pointer-events-none absolute right-4 top-4">
          <span className="szklo-pro rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted">
            {poziom.nazwa}
          </span>
        </div>

        {!zagrane && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <span className="szklo-pro rounded-full px-5 py-2.5 text-[13px] text-ink">
              Przeciągnij od piłki w stronę kosza i puść
            </span>
          </div>
        )}

        {komunikat && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <span className="szklo-pro rounded-full px-5 py-2.5 text-[13px] text-ink">
              {komunikat} &middot; dotknij, żeby zacząć od nowa
            </span>
          </div>
        )}
      </div>

      {!zalogowany && (
        <p className="bg-black/40 px-5 py-3 text-center text-[12px] text-muted">
          Grasz bez konta - wynik nie wejdzie do rankingu. Zaloguj się, żeby się w nim
          znaleźć.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- rysunki */

function resetPilki(s: Stan) {
  s.faza = "gotowa";
  s.x = START_X;
  s.y = START_Y;
  s.vx = 0;
  s.vy = 0;
  s.obrot = 0;
  s.nadObreczka = false;
}

function rysujKosz(ctx: CanvasRenderingContext2D, x: number, y: number) {
  /*
    Słup pod tablicą. Bez niego obręcz wisiała w powietrzu i scena wyglądała jak pomyłka -
    a że kosz na wyższych poziomach się buja, słup buja się razem z nim i to właśnie ten
    ruch najlepiej widać.
  */
  const slupX = x + OBRECZ_R + 16;
  ctx.fillStyle = "rgba(30,34,44,.9)";
  ctx.fillRect(slupX - 5, y - 20, 12, 620);
  ctx.beginPath();
  ctx.ellipse(slupX + 1, 596, 34, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fill();

  /* tablica */
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillRect(x + OBRECZ_R + 10, y - 130, 14, 150);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.fillRect(x + OBRECZ_R + 10, y - 92, 14, 62);

  /* obręcz - grubsza kreska w barwie marki, bo to jedyny cel na planszy */
  ctx.strokeStyle = "#ff5a14";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x - OBRECZ_R, y);
  ctx.lineTo(x + OBRECZ_R, y);
  ctx.stroke();

  /* siatka - sześć nitek zbiegających się do dołu */
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 6; i++) {
    const gora = x - OBRECZ_R + (i * (OBRECZ_R * 2)) / 6;
    const dol = x - OBRECZ_R * 0.45 + (i * (OBRECZ_R * 0.9)) / 6;
    ctx.beginPath();
    ctx.moveTo(gora, y);
    ctx.lineTo(dol, y + 54);
    ctx.stroke();
  }
  for (let r = 1; r <= 2; r++) {
    const t = r / 3;
    const szer = OBRECZ_R * (1 - t * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - szer, y + 54 * t);
    ctx.lineTo(x + szer, y + 54 * t);
    ctx.stroke();
  }
}

/**
 * Podpowiedź toru: kilka punktów po paraboli, którą poleci piłka.
 *
 * Nie rysujemy całej linii do końca - tylko początek. Pełna trajektoria zamieniłaby grę
 * w celowanie po linijce, a chodzi o wyczucie.
 */
function rysujPodpowiedz(ctx: CanvasRenderingContext2D, s: Stan) {
  const dx = s.doX - s.odX;
  const dy = s.doY - s.odY;
  const dlugosc = Math.hypot(dx, dy);
  if (dlugosc < 26) return;

  const moc = Math.min(dlugosc * SILA, MAKS_SILA);
  let vx = (dx / dlugosc) * moc;
  let vy = (dy / dlugosc) * moc;
  let x = s.x;
  let y = s.y;

  ctx.fillStyle = "rgba(255,255,255,.55)";
  for (let i = 0; i < 26; i++) {
    x += vx;
    y += vy;
    vy += GRAWITACJA;
    vx *= OPOR;
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, 5 - i * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* strzałka siły przy piłce */
  ctx.strokeStyle = "rgba(255,122,24,.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + (dx / dlugosc) * Math.min(dlugosc, 150), s.y + (dy / dlugosc) * Math.min(dlugosc, 150));
  ctx.stroke();
}
