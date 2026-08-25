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

const GRAWITACJA = 0.5;
const OPOR = 0.9992;
const SILA = 0.17;
const MAKS_SILA = 30;

const PILKA_R = 38;
const START_X = 500;
const START_Y = 520;

/*
  Kosz widziany z przodu, u góry kadru - jak w tej starej grze z komunikatora. Piłka leci
  z dołu w górę i musi wpaść przez obręcz, więc liczy się wyczucie siły, a nie kąt.
*/
const KOSZ_X = 500;
const KOSZ_Y = 236;
const OBRECZ_R = 78;
const TABLICA_SZER = 300;
const TABLICA_WYS = 132;

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

        /*
          Krawędzie obręczy odbijają piłkę. To one dają w tej grze całą dramaturgię:
          rzut trochę za mocny nie leci po prostu obok, tylko puka o żelazo i czasem
          jednak wpada.
        */
        for (const kraniec of [koszX - OBRECZ_R, koszX + OBRECZ_R]) {
          const dx = s.x - kraniec;
          const dy = s.y - koszY;
          const d = Math.hypot(dx, dy);
          if (d < PILKA_R + 6 && d > 0.001) {
            const nx = dx / d;
            const ny = dy / d;
            const rzut = s.vx * nx + s.vy * ny;
            s.vx = (s.vx - 2 * rzut * nx) * 0.62;
            s.vy = (s.vy - 2 * rzut * ny) * 0.62;
            s.x = kraniec + nx * (PILKA_R + 6);
            s.y = koszY + ny * (PILKA_R + 6);
          }
        }

        /* tablica za obręczą - zatrzymuje piłkę wystrzeloną prosto w płytę */
        if (
          s.vy < 0 &&
          s.y - PILKA_R < koszY - 6 &&
          s.y + PILKA_R > koszY - TABLICA_WYS &&
          Math.abs(s.x - koszX) < TABLICA_SZER / 2
        ) {
          s.vy *= -0.45;
          s.y = koszY - 6 + PILKA_R;
        }

        if (s.y < koszY - PILKA_R) s.nadObreczka = true;

        /* trafienie: opada, jest w świetle obręczy i wcześniej była nad nią */
        const trafiona =
          s.vy > 0 &&
          s.nadObreczka &&
          Math.abs(s.y - koszY) < 16 &&
          Math.abs(s.x - koszX) < OBRECZ_R - PILKA_R * 0.5;

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

      /*
        Poświata pod piłką. Na czarnym tle ciemna piłka „żaru" gubiła się kompletnie -
        a to jedyny obiekt, który gracz musi widzieć zawsze i natychmiast.
      */
      const obrazek = pilkiRef.current[poziom.pilka];
      const swiatlo = ctx.createRadialGradient(s.x, s.y, PILKA_R * 0.5, s.x, s.y, PILKA_R * 1.9);
      swiatlo.addColorStop(0, "rgba(255,140,50,.34)");
      swiatlo.addColorStop(1, "rgba(255,140,50,0)");
      ctx.fillStyle = swiatlo;
      ctx.beginPath();
      ctx.arc(s.x, s.y, PILKA_R * 1.9, 0, Math.PI * 2);
      ctx.fill();

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
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="szklo-pro rounded-full px-5 py-2.5 text-[13px] text-ink">
              Przeciągnij od piłki w stronę kosza i puść
            </span>
          </div>
        )}

        {komunikat && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
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

/**
 * Kosz widziany z przodu: tablica, kwadrat celowniczy, obręcz i siatka.
 *
 * Rysunek trzyma się języka strony - włosowa kreska, pomarańcz na obręczy, nic
 * wypełnionego. Obręcz jest jedynym mocnym akcentem w kadrze, bo to jedyny cel.
 */
function rysujKosz(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const lewa = x - TABLICA_SZER / 2;
  const gora = y - TABLICA_WYS;

  /* tablica */
  ctx.strokeStyle = "rgba(226,228,236,.62)";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  zaokraglony(ctx, lewa, gora, TABLICA_SZER, TABLICA_WYS, 10);
  ctx.stroke();

  /* kwadrat celowniczy nad obręczą */
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(226,228,236,.5)";
  const kw = TABLICA_SZER * 0.42;
  ctx.strokeRect(x - kw / 2, y - 76, kw, 66);

  /* wspornik pod tablicą */
  ctx.fillStyle = "rgba(226,228,236,.42)";
  ctx.fillRect(x - 22, y + 14, 44, 9);

  /* obręcz - gruba kreska w barwie marki, z poświatą */
  ctx.save();
  ctx.shadowColor = "rgba(255,90,20,.7)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "#ff5a14";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - OBRECZ_R, y);
  ctx.lineTo(x + OBRECZ_R, y);
  ctx.stroke();
  ctx.restore();

  /* siatka - nitki schodzące się ku dołowi */
  ctx.strokeStyle = "rgba(255,255,255,.4)";
  ctx.lineWidth = 2;
  const glebokosc = 62;
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const gx = x - OBRECZ_R + t * OBRECZ_R * 2;
    const dx = x - OBRECZ_R * 0.42 + t * OBRECZ_R * 0.84;
    ctx.beginPath();
    ctx.moveTo(gx, y + 4);
    ctx.lineTo(dx, y + glebokosc);
    ctx.stroke();
  }
  for (let r = 1; r <= 2; r++) {
    const t = r / 3;
    const szer = OBRECZ_R * (1 - t * 0.58);
    ctx.beginPath();
    ctx.moveTo(x - szer, y + 4 + glebokosc * t);
    ctx.lineTo(x + szer, y + 4 + glebokosc * t);
    ctx.stroke();
  }
}

function zaokraglony(
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
