"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Court, TYPE_LABEL } from "@/lib/types";
import type { OdkrywcaRanking } from "@/lib/repo";
import { plural } from "@/lib/site";
import { CourtPhoto } from "./CourtPhoto";
import { MIEJSC_W_KONSTELACJI, OrbitaOdkrywcow } from "./ranking/OrbitaOdkrywcow";
import {
  ArrowLeftIcon,
  BasketApprovedBadge,
  FireBallIcon,
  FunnyBadge,
  PinIcon,
} from "./icons";

/** Ile boisk pokazujemy w karuzeli okładek, a ile w liście pod nią. */
const TOP = 10;
const LISTA_DO = 25;

/** Konstelacja bierze pięć pierwszych miejsc, reszta idzie listą. */
const TOP_GRACZY = 5;

export function RankingTabs({
  courts,
  odkrywcy,
}: {
  courts: Court[];
  odkrywcy: OdkrywcaRanking[];
}) {
  const [tab, setTab] = useState<"gracze" | "boiska">("gracze");

  const naglowek =
    tab === "gracze"
      ? {
          tytul: "Ranking odkrywców",
          opis:
            "W rankingu liczą się tylko zalogowani użytkownicy. Miejsce zależy od liczby boisk, które ktoś dodał - przy równej liczbie wyżej stoi ten, kogo boiska częściej podpalano.",
        }
      : {
          tytul: "Najgorętsze boiska w Polsce",
          opis:
            "Kolejność wyznaczają płonące piłki od społeczności. Podpalaj boiska, na których dobrze się gra.",
        };

  return (
    <>
      {/*
        Przełącznik stoi nad tytułem i na środku: najpierw wybierasz, czego szukasz - graczy
        czy boisk - a tytuł i opis dopasowują się do wyboru.
      */}
      <header className="mb-12 flex flex-col items-center text-center">
        <div className="glass inline-flex gap-1 rounded-full p-1">
          {(["gracze", "boiska"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.12em] transition ${
                tab === t ? "flame-gradient text-black" : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="mt-8 text-[12px] uppercase tracking-[0.2em] text-flame">Ranking</p>
        <h1 className="mt-2 text-[clamp(30px,5vw,52px)] font-semibold leading-tight tracking-[-0.02em]">
          {naglowek.tytul}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{naglowek.opis}</p>
      </header>

      {tab === "gracze" ? (
        <>
          <Konstelacja odkrywcy={odkrywcy.slice(0, TOP_GRACZY)} />
          <ListaGraczy odkrywcy={odkrywcy.slice(TOP_GRACZY, LISTA_DO)} od={TOP_GRACZY + 1} />
        </>
      ) : (
        <>
          <Karuzela courts={courts.slice(0, TOP)} />
          <Lista courts={courts.slice(TOP, LISTA_DO)} od={TOP + 1} />
        </>
      )}
    </>
  );
}

/** Ile okładek wystaje za aktywną - dalsze czekają poza kadrem. */
const ZA_AKTYWNA = 3;

/**
 * Top 10 jako stos okładek: aktywna jest największa i z przodu, kolejne wystają za nią
 * w prawo, coraz mniejsze i coraz bardziej przygaszone. Strzałki po bokach przestawiają
 * stos, kliknięcie w wystającą okładkę wysuwa ją na przód, a na telefonie działa gest.
 */
/** Od tylu pikseli przeciągnięcie liczy się jako przewinięcie stosu, a nie jako klik. */
const PROG_GESTU = 44;

function Karuzela({ courts }: { courts: Court[] }) {
  const [aktywny, setAktywny] = useState(0);
  /** początek gestu - zapamiętany, żeby po puszczeniu poznać kierunek i dystans */
  const start = useRef<number | null>(null);
  /** ile stos jedzie za palcem w tej chwili; 0 = spoczynek */
  const [ciagniecie, setCiagniecie] = useState(0);
  /** przeciągnięcie kończy się kliknięciem - ten znacznik gasi je, żeby nie otwierać boiska */
  const bylGest = useRef(false);

  /* stos jest zapętlony: po ostatniej okładce wraca pierwsza i odwrotnie */
  const przesun = (kierunek: 1 | -1) =>
    setAktywny((i) => (i + kierunek + courts.length) % courts.length);

  /*
    Jedna obsługa na mysz i na palec: zdarzenia wskaźnika przychodzą z obu, więc nie ma
    dwóch osobnych ścieżek, które trzeba trzymać zgodne. Stos jedzie za wskaźnikiem z
    tłumieniem 0,55 - pełne nadążanie wyglądało jak szarpanie, bo okładki i tak wskakują
    na swoje miejsca dopiero po puszczeniu.
  */
  const zacznij = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    start.current = e.clientX;
    bylGest.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const ciagnij = (e: React.PointerEvent) => {
    if (start.current === null) return;
    const dystans = e.clientX - start.current;
    if (Math.abs(dystans) > 6) bylGest.current = true;
    setCiagniecie(dystans * 0.55);
  };

  const skoncz = (e: React.PointerEvent) => {
    if (start.current === null) return;
    const dystans = e.clientX - start.current;
    start.current = null;
    setCiagniecie(0);
    if (Math.abs(dystans) > PROG_GESTU) przesun(dystans < 0 ? 1 : -1);
  };

  if (!courts.length) return null;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Top {courts.length}</h2>
          <p className="mt-1 text-[14px] text-muted">Najczęściej podpalane boiska w bazie.</p>
        </div>

        {/* licznik jak na okładce płyty - od razu widać, w którym miejscu stosu jesteśmy */}
        <p className="shrink-0 text-[13px] tabular-nums text-faint">
          <span className="flame-text text-[22px] font-semibold">
            {String(aktywny + 1).padStart(2, "0")}
          </span>
          <span className="mx-1.5">/</span>
          {String(courts.length).padStart(2, "0")}
        </p>
      </div>

      {/*
        Rozmiary stosu trzymamy w zmiennych CSS: --w to bok okładki, --peek odstęp między
        kolejnymi okładkami, --shift przesunięcie całego stosu w lewo, żeby jego masa
        wypadła na środku kolumny. Na telefonie wszystko ciaśniejsze.
      */}
      <div className="relative [--peek:0.46] [--shift:0.15] [--w:min(52vw,200px)] sm:[--peek:0.66] sm:[--shift:0.55] sm:[--w:min(34vw,320px)]">
        {/*
          Ciepła kałuża światła pod stosem. Wychodzi poza scenę okładek w dół, więc poświata
          aktywnej okładki nie kończy się w powietrzu - płynnie przechodzi w listę pod spodem.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 left-0 h-[220px] w-[72%] blur-[70px] sm:left-[3%] sm:w-[62%]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,77,10,.32) 0%, rgba(255,122,24,.12) 52%, transparent 100%)",
          }}
        />

        <div
          className="okladki-scena relative -mx-6 h-[calc(var(--w)+150px)] cursor-grab touch-pan-y select-none active:cursor-grabbing sm:mx-0"
          onPointerDown={zacznij}
          onPointerMove={ciagnij}
          onPointerUp={skoncz}
          onPointerCancel={skoncz}
          style={{
            translate: `${ciagniecie}px 0`,
            transition: ciagniecie ? "none" : "translate 320ms cubic-bezier(0.22, 0.9, 0.24, 1)",
          }}
        >
          {courts.map((c, i) => {
            /* dystans liczony po okręgu - dzięki temu za dziesiątką znów staje pierwsza */
            const d = (i - aktywny + courts.length) % courts.length;
            const aktywna = d === 0;
            const widoczna = d <= ZA_AKTYWNA;
            /* okładki poza kadrem czekają o jedno miejsce w lewo, niewidoczne */
            const miejsce = widoczna ? d : -1;

            return (
              <Link
                key={c.id}
                href={`/boisko/${c.slug}`}
                draggable={false}
                onClick={(e) => {
                  // przeciągnięcie kończy się kliknięciem - bez tego każdy gest otwierał boisko
                  if (bylGest.current) {
                    e.preventDefault();
                    return;
                  }
                  // wystająca okładka najpierw wjeżdża na przód, dopiero z przodu prowadzi dalej
                  if (!aktywna) {
                    e.preventDefault();
                    setAktywny(i);
                  }
                }}
                tabIndex={widoczna ? undefined : -1}
                aria-hidden={!widoczna}
                className={`okladka glass group absolute left-1/2 top-1/2 aspect-square w-[var(--w)] overflow-hidden rounded-[28px] ${
                  aktywna ? "okladka-aktywna" : ""
                }`}
                style={{
                  zIndex: 20 - d,
                  opacity: widoczna ? 1 : 0,
                  pointerEvents: widoczna ? undefined : "none",
                  transform: `translate(calc(-50% + var(--w) * (${miejsce} * var(--peek) - var(--shift))), -50%) scale(${(
                    1 -
                    Math.max(miejsce, 0) * 0.12
                  ).toFixed(3)})`,
                }}
              >
                {/* okładki na wierzchu stosu wczytują się od razu, bez doładowywania */}
                <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="360px" priority={i < 3} />

                {/* wygaszenie dołu pod podpisy */}
                <span className="okladka-zaslona pointer-events-none absolute inset-0" />

                {/* dalsze okładki są przygaszone, żeby aktywna wychodziła na przód */}
                <span
                  className={`pointer-events-none absolute inset-0 bg-void transition-opacity duration-500 ${
                    aktywna ? "opacity-0" : "opacity-40"
                  }`}
                />

                {/* poświata pod kursorem - płynna plama w kolorze marki */}
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(130% 100% at 50% 118%, rgba(255,122,24,.42) 0%, rgba(255,77,10,.18) 38%, rgba(255,77,10,.05) 62%, transparent 80%)",
                  }}
                />

                {/* numer pozycji jako znak wodny */}
                <span
                  className="pointer-events-none absolute -bottom-7 right-3 flame-text text-[clamp(84px,15vw,140px)] font-bold leading-none tabular-nums opacity-25 transition-opacity duration-500 group-hover:opacity-45"
                  aria-hidden
                >
                  {i + 1}
                </span>

                {/*
                  Numerek i plakietki tylko na aktywnej okładce: na wystających i tak schowałby
                  je kadr z przodu, a same wystające czyta się po dużej cyfrze w tle.
                */}
                <span
                  className={`absolute left-4 top-4 flex items-center gap-2 transition-opacity duration-500 ${
                    aktywna ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="glass-dim grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-glow">
                    {i + 1}
                  </span>
                  {c.basketApproved && <BasketApprovedBadge />}
                  {c.funny && <FunnyBadge />}
                </span>

                {/* podpisy tylko na aktywnej - wystające okładki zostają czystym kadrem */}
                <span
                  className={`absolute inset-x-4 bottom-4 transition-opacity duration-500 ${
                    aktywna ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="block truncate text-[17px] font-semibold sm:text-[19px]">
                    {c.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/70">
                    <PinIcon className="h-3.5 w-3.5 text-flame" /> {c.city}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[13px] font-bold text-glow backdrop-blur">
                    <FireBallIcon className="h-4 w-4" /> {c.likes}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* strzałki po bokach stosu - poza maską scenki, żeby same nie gasły */}
        {([-1, 1] as const).map((k) => (
          <button
            key={k}
            onClick={() => przesun(k)}
            aria-label={k === -1 ? "Poprzednia okładka" : "Następna okładka"}
            className={`glass absolute top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:text-flame sm:h-12 sm:w-12 ${
              k === -1 ? "left-0" : "right-0"
            }`}
          >
            <ArrowLeftIcon className={`h-4 w-4 ${k === 1 ? "rotate-180" : ""}`} />
          </button>
        ))}
      </div>
    </section>
  );
}

/*
  Rytm nieregularnej siatki. Kolumna decyduje o przesunięciu w dół, a pozycja w rzędzie
  o proporcjach kadru - dzięki temu kafelki schodzą kaskadą zamiast stać w równych rzędach,
  a mimo to numeracja dalej czyta się od lewej do prawej. Wartości są wpisane, nie losowe:
  losowe zmieniałyby się przy każdym renderowaniu i to samo boisko skakałoby po siatce.
*/
const PROPORCJE = ["4 / 5", "1 / 1", "3 / 4", "5 / 6", "4 / 5", "1 / 1"];
const ZJAZD_TELEFON = ["", "mt-7"];
const ZJAZD_EKRAN = ["sm:mt-0", "sm:mt-14", "sm:mt-6"];

/**
 * Miejsca 11-25 jako kaskada okładek.
 *
 * Wcześniej był tu rządek szklanych wierszy z miniaturą wielkości znaczka pocztowego -
 * przy rankingu BOISK to najgorszy możliwy układ, bo o miejscu w kolejce decyduje właśnie
 * to, jak boisko wygląda. Teraz każde dostaje duży kadr tytułowy, a nazwę czyta się pod
 * nim, na spokojnym tle, zamiast walczyć o kontrast na zdjęciu.
 */
function Lista({ courts, od }: { courts: Court[]; od: number }) {
  if (!courts.length) return null;

  return (
    <section className="relative mt-14">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Miejsca {od}-{od + courts.length - 1}
      </h2>

      {/* rozmyta pomarańczowa poświata pod kaskadą - zamyka sekcję i wtapia ją w tło */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[4%] -bottom-28 h-[300px] blur-[90px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,77,10,.34) 0%, rgba(255,122,24,.13) 52%, transparent 100%)",
        }}
      />

      <ol className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-9">
        {courts.map((c, i) => (
          <li
            key={c.id}
            className={`${ZJAZD_TELEFON[i % 2]} ${ZJAZD_EKRAN[i % 3]}`}
          >
            <Link href={`/boisko/${c.slug}`} className="kafel-rankingu group relative block">
              <span
                className="kafel-obraz relative block overflow-hidden rounded-[22px]"
                style={{ aspectRatio: PROPORCJE[i % PROPORCJE.length] }}
              >
                <CourtPhoto
                  photo={c.photos[0]}
                  seed={c.seed}
                  sizes="(min-width: 640px) 33vw, 50vw"
                />

                {/* numer miejsca jako znak wodny - czytelny, ale nie zabiera zdjęciu miejsca */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-1 right-2.5 flame-text text-[clamp(40px,8vw,64px)] font-bold leading-none tabular-nums opacity-50 transition-opacity duration-500 group-hover:opacity-80"
                >
                  {od + i}
                </span>

                <span className="absolute left-3 top-3 flex items-center gap-1.5">
                  <span className="glass-dim grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold tabular-nums text-glow">
                    {od + i}
                  </span>
                  {c.basketApproved && <BasketApprovedBadge />}
                  {c.funny && <FunnyBadge />}
                </span>

                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[13px] font-bold text-glow backdrop-blur">
                  <FireBallIcon className="h-4 w-4" /> {c.likes}
                </span>
              </span>

              <span className="mt-3 block px-0.5">
                <span className="block truncate text-[clamp(14px,2.4vw,17px)] font-semibold leading-tight transition-colors group-hover:text-glow">
                  {c.name}
                </span>
                <span className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-muted sm:text-[13px]">
                  <PinIcon className="h-3.5 w-3.5 shrink-0 text-flame" />
                  <span className="truncate">
                    {c.city} · {TYPE_LABEL[c.type]}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Nagłówek i konstelacja pięciu pierwszych miejsc. */
function Konstelacja({ odkrywcy }: { odkrywcy: OdkrywcaRanking[] }) {
  return (
    <section>
      <h2 className="mb-8 text-center text-[13px] uppercase tracking-[0.18em] text-faint">
        Top {MIEJSC_W_KONSTELACJI}
      </h2>

      <div className="py-4 sm:py-8">
        <OrbitaOdkrywcow odkrywcy={odkrywcy} />
      </div>
    </section>
  );
}

/**
 * Miejsca 6-25: szklane wiersze z avatarem, liczbą boisk i podglądem trzech kadrów.
 *
 * Miejsca bez właściciela zostają w liście jako przerywane wiersze - od razu widać, ile
 * jest do wzięcia i jak ranking będzie wyglądał, gdy się wypełni.
 */
function ListaGraczy({ odkrywcy, od }: { odkrywcy: OdkrywcaRanking[]; od: number }) {
  const miejsca = Array.from(
    { length: LISTA_DO - od + 1 },
    (_, i) => odkrywcy[i] ?? null
  );

  return (
    <section className="relative mt-16">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Miejsca {od}-{LISTA_DO}
      </h2>

      {/* rozmyta pomarańczowa poświata pod wierszami - zamyka sekcję i wtapia ją w tło */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[4%] -bottom-28 h-[300px] blur-[90px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,77,10,.30) 0%, rgba(255,122,24,.11) 52%, transparent 100%)",
        }}
      />

      <ol className="relative mt-4 space-y-2">
        {miejsca.map((o, i) =>
          o ? (
            <li key={o.slug}>
              <Link
                href={`/gracz/${o.slug}`}
                className="glass row-glow flex items-center gap-4 rounded-[20px] p-3"
              >
                <span className="h-12 w-[3px] shrink-0 rounded-full flame-gradient opacity-70" />

                <span className="w-7 shrink-0 text-center text-[15px] font-semibold tabular-nums text-faint">
                  {od + i}
                </span>

                <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-flame/40">
                  {o.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flame-gradient grid h-full w-full place-items-center text-[15px] font-bold text-black">
                      {o.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">@{o.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {o.courts} {plural(o.courts, ["boisko", "boiska", "boisk"])} w bazie
                  </span>
                </span>

                {/* trzy kadry na zakładkę - zapowiedź tego, co widać w konstelacji wyżej */}
                <span className="hidden shrink-0 items-center sm:flex">
                  {o.kadry.slice(0, 3).map((k, j) => (
                    <span
                      key={k.slug}
                      className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-void"
                      style={{ marginLeft: j ? -12 : 0, zIndex: 3 - j }}
                    >
                      <CourtPhoto photo={k.photo} seed={k.seed} sizes="80px" />
                    </span>
                  ))}
                </span>

                <span className="flex w-16 shrink-0 items-center justify-end gap-1.5 text-[15px] font-bold text-glow">
                  <FireBallIcon className="h-4 w-4" /> {o.likes}
                </span>
              </Link>
            </li>
          ) : (
            <li key={`wolne-${od + i}`}>
              <div className="flex items-center gap-4 rounded-[20px] border border-dashed border-flame/20 bg-white/[0.015] p-3">
                <span className="h-12 w-[3px] shrink-0 rounded-full bg-white/10" />

                <span className="w-7 shrink-0 text-center text-[15px] font-semibold tabular-nums text-faint/70">
                  {od + i}
                </span>

                <span className="h-12 w-12 shrink-0 rounded-full border border-dashed border-flame/25" />

                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-faint">wolne miejsce</span>
                  <span className="block text-[13px] text-faint/70">
                    dodaj boisko, żeby tu wejść
                  </span>
                </span>

                <Link
                  href="/dodaj"
                  className="shrink-0 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium text-muted transition hover:border-flame/50 hover:text-flame"
                >
                  Dodaj boisko
                </Link>
              </div>
            </li>
          )
        )}
      </ol>
    </section>
  );
}
