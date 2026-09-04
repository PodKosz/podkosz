"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAKS_SERIA, poziomDlaSerii, type IdMiejsca } from "@/lib/minigra";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";

/**
 * Minigra: rzut do kosza swipem.
 *
 * Zasada jest ta sama, co w starej grze z komunikatora: machasz piłką w stronę kosza.
 * O rzucie decyduje PRĘDKOŚĆ ręki w chwili puszczenia, a nie odległość przeciągnięcia -
 * dlatego powolne przeciągnięcie przez pół ekranu nie wystrzeli piłki, a krótkie, ostre
 * machnięcie owszem. Kierunek ruchu to kąt wylotu, szybkość to zasięg. Nie ma tu żadnej
 * linii celowniczej ani wskaźnika siły: całą informację zwrotną daje sama piłka, która
 * idzie za palcem.
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

const GRAWITACJA = 0.62;
const OPOR = 0.9992;
/*
  Przelicznik szybkości machnięcia na siłę rzutu i górne ograniczenie tej siły.

  Obie liczby są wyliczone, nie zgadnięte - przelotów nie da się rozegrać automatem
  (przeglądarka nie daje klatek w niewidocznej karcie), więc lot przeliczyłem osobno,
  tą samą fizyką, dla kilku profili machnięcia. Przy tym zestawie:

    leciutkie i spokojne machnięcie  - nie sięga obręczy, widać że było za słabe
    typowe i pewne                   - wpada, piłka cały czas w kadrze
    mocne i zamaszyste               - ścina je górne ograniczenie, więc nie ucieka z ekranu

  Tolerancja kąta wychodzi około ±40 px odchylenia machnięcia: wybacza drgnięcie ręki,
  ale nie wybacza rzutu w bok. Limit siły jest po to, żeby piłka nigdy nie wyleciała poza
  kadr - znikająca piłka nie mówi graczowi nic o tym, co zrobił źle.
*/
const SILA = 0.28;
const MAKS_SILA = 24;
/* poniżej tej szybkości traktujemy ruch jako przypadkowe dotknięcie, nie rzut */
const MIN_SZYBKOSC = 4.5;
/* ile ostatnich milisekund ruchu liczy się jako zamach */
const OKNO_ZAMACHU = 110;
/*
  Jak mocno piłka idzie za palcem. Nie jeden do jednego z rozmysłem: przy pełnym podążaniu
  szybkie machnięcie przerzucało piłkę przez pół planszy jeszcze przed puszczeniem i rzut
  startował za każdym razem z innej wysokości - a wtedy ta sama siła raz wpadała, raz nie.
  Przy 0.4 piłka wyraźnie reaguje na rękę, ale punkt wyrzutu zostaje w okolicy miejsca,
  z którego się rzuca.
*/
const PODAZANIE = 0.4;
const ZASIEG_PODAZANIA = 190;

const PILKA_R = 38;
const START_X = 500;
const START_Y = 470;

/*
  Kosz widziany z przodu, u góry kadru - jak w tej starej grze z komunikatora. Piłka leci
  z dołu w górę i musi wpaść przez obręcz, więc liczy się wyczucie siły, a nie kąt.
*/
const KOSZ_X = 500;
const KOSZ_Y = 250;
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
  /*
    Ostatnie położenia palca razem z czasem. Rzut bierze prędkość z tych próbek, a nie
    z odległości między początkiem a końcem przeciągnięcia: liczy się to, jak szybko ręka
    szła w chwili puszczenia, więc powolne przeciągnięcie przez pół ekranu nie wystrzeli
    piłki, a krótkie, ostre machnięcie owszem.
  */
  probki: { x: number; y: number; t: number }[];
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
    probki: [],
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

        /*
          Tablicy nie sprawdzamy. Przy koszu widzianym z przodu płyta wisi ZA obręczą,
          a piłka leci przed nią - odbicie od niej wymagałoby trzeciego wymiaru, którego
          tu nie ma. Wcześniejsza wersja traktowała tablicę jak ścianę w płaszczyźnie gry
          i zawracała każdy rzut jeszcze przed obręczą, więc trafić nie dało się w ogóle.
        */

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

      /*
        Poświata pod piłką. Na czarnym tle ciemna piłka „żaru" gubiła się kompletnie -
        a to jedyny obiekt, który gracz musi widzieć zawsze i natychmiast.
      */
      const obrazek = pilkiRef.current[poziom.pilka];
      const swiatlo = ctx.createRadialGradient(s.x, s.y, PILKA_R * 0.5, s.x, s.y, PILKA_R * 1.9);
      swiatlo.addColorStop(0, barwaMotywu("--rgb-flame", "rgba(255,122,24,.34)", 0.34));
      swiatlo.addColorStop(1, barwaMotywu("--rgb-flame", "rgba(255,122,24,0)", 0));
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
        ctx.fillStyle = barwaMotywu("--color-flame", "#ff7a18");
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
    s.probki = [{ x: p.x, y: p.y, t: performance.now() }];
    setZagrane(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const ciagnij = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;

    const p = naSwiat(e);
    s.probki.push({ x: p.x, y: p.y, t: performance.now() });
    if (s.probki.length > 8) s.probki.shift();

    /*
      Piłka idzie za palcem, ale z tłumieniem i w ograniczonym promieniu wokół swojego
      miejsca. Dzięki temu rzut zawsze startuje mniej więcej stamtąd, skąd gracz się
      spodziewa - a jednocześnie widać, że ręka piłkę prowadzi.
    */
    const dx = (p.x - START_X) * PODAZANIE;
    const dy = (p.y - START_Y) * PODAZANIE;
    const d = Math.hypot(dx, dy);
    const skrot = d > ZASIEG_PODAZANIA ? ZASIEG_PODAZANIA / d : 1;
    s.x = START_X + dx * skrot;
    s.y = START_Y + dy * skrot;
  };

  const puszczaj = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stanRef.current;
    if (s.faza !== "celowanie") return;

    e.currentTarget.releasePointerCapture(e.pointerId);

    /*
      Prędkość liczymy z ostatnich stu milisekund ruchu. Krótsze okno łapie drgnięcia
      palca tuż przed oderwaniem, dłuższe rozmywa zamach - sto milisekund to mniej więcej
      tyle, ile trwa samo machnięcie nadgarstkiem.
    */
    const teraz = performance.now();
    const ostatnia = s.probki[s.probki.length - 1];
    const pierwsza = [...s.probki].reverse().find((p) => teraz - p.t > OKNO_ZAMACHU) ?? s.probki[0];

    s.probki = [];

    if (!ostatnia || !pierwsza || ostatnia === pierwsza) {
      s.faza = "gotowa";
      resetPilki(s);
      return;
    }

    const dt = Math.max(ostatnia.t - pierwsza.t, 8);
    /* piksele świata na klatkę - stąd mnożnik przez czas jednej klatki */
    const vx = ((ostatnia.x - pierwsza.x) / dt) * 16.7;
    const vy = ((ostatnia.y - pierwsza.y) / dt) * 16.7;
    const szybkosc = Math.hypot(vx, vy);

    /* machnięcie w dół albo ledwo zauważalne to nie rzut - piłka wraca na miejsce */
    if (szybkosc < MIN_SZYBKOSC || vy > -1) {
      s.faza = "gotowa";
      resetPilki(s);
      return;
    }

    const moc = Math.min(szybkosc * SILA, MAKS_SILA);
    s.vx = (vx / szybkosc) * moc;
    s.vy = (vy / szybkosc) * moc;
    s.faza = "lot";
    s.nadObreczka = false;
  };

  const poziom = poziomDlaSerii(seria);

  return (
    /*
      Plansza nie ma własnego tła ani karty: rysunek miasta leży pod całą stroną, a tu
      zostaje sama gra. Włosowa obwódka mówi tylko, dokąd sięga pole rzutu.
    */
    <div className="relative">
      <div className="relative aspect-[1000/680] w-full rounded-[28px] border border-hairline">
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
              Machnij palcem albo myszką w stronę kosza
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
        <p className="mt-3 text-center text-[12px] text-muted">
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
/**
 * Barwa z motywu, wyliczona na liczby.
 *
 * Kanwa 2D nie czyta arkusza: `ctx.fillStyle = "var(--color-flame)"` nie jest błędem,
 * jest ciszą - przeglądarka odrzuca nierozpoznaną wartość i zostawia poprzednią barwę.
 * Efekt trudny do wyśledzenia, bo nic się nie wywala, tylko piłka nagle maluje się tym,
 * czym malowano przed nią. Dlatego tu, w odróżnieniu od całej reszty serwisu, motyw
 * odczytujemy wprost ze stylu wyliczonego.
 *
 * `alfa` dokładamy osobno, bo zmienne trzymają same składowe RGB - z gotowej barwy nie da
 * się zrobić „to samo, ale 34%".
 */
function barwaMotywu(nazwa: string, awaryjna: string, alfa?: number) {
  const v =
    typeof window === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue(nazwa).trim();
  if (!v) return awaryjna;
  return alfa === undefined ? v : `rgb(${v} / ${alfa})`;
}

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
  ctx.shadowColor = barwaMotywu("--rgb-ember", "rgba(255,77,10,.7)", 0.7);
  ctx.shadowBlur = 18;
  ctx.strokeStyle = barwaMotywu("--color-ember", "#ff4d0a");
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


