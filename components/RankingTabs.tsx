"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Court, TYPE_LABEL } from "@/lib/types";
import { slugifyPlace, plural } from "@/lib/site";
import { CourtPhoto } from "./CourtPhoto";
import {
  ArrowLeftIcon,
  BasketApprovedBadge,
  FireBallIcon,
  FunnyBadge,
  PinIcon,
} from "./icons";

type Author = { name: string; courts: number; likes: number };

/** Ile boisk pokazujemy w karuzeli okładek, a ile w liście pod nią. */
const TOP = 10;
const LISTA_DO = 25;

export function RankingTabs({ courts, authors }: { courts: Court[]; authors: Author[] }) {
  const [tab, setTab] = useState<"boiska" | "gracze">("boiska");

  return (
    <>
      {/* przełącznik w szkle - ta sama faktura co panele na mapie */}
      <div className="glass mb-10 inline-flex gap-1 rounded-full p-1">
        {(["boiska", "gracze"] as const).map((t) => (
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

      {tab === "boiska" ? (
        <>
          <Karuzela courts={courts.slice(0, TOP)} />
          <Lista courts={courts.slice(TOP, LISTA_DO)} od={TOP + 1} />
        </>
      ) : (
        <Odkrywcy authors={authors} />
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
function Karuzela({ courts }: { courts: Court[] }) {
  const [aktywny, setAktywny] = useState(0);
  /** początek gestu - zapamiętany, żeby po puszczeniu palca poznać kierunek */
  const dotyk = useRef<number | null>(null);

  /* stos jest zapętlony: po ostatniej okładce wraca pierwsza i odwrotnie */
  const przesun = (kierunek: 1 | -1) =>
    setAktywny((i) => (i + kierunek + courts.length) % courts.length);

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
          className="okladki-scena relative -mx-6 h-[calc(var(--w)+150px)] sm:mx-0"
          onTouchStart={(e) => {
            dotyk.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const start = dotyk.current;
            dotyk.current = null;
            if (start === null) return;
            const przesuniecie = e.changedTouches[0].clientX - start;
            if (Math.abs(przesuniecie) > 40) przesun(przesuniecie < 0 ? 1 : -1);
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
                onClick={(e) => {
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

/** Miejsca 11-25: szklane wiersze z ciepłą smugą wjeżdżającą pod kursorem. */
function Lista({ courts, od }: { courts: Court[]; od: number }) {
  if (!courts.length) return null;

  return (
    <section className="relative mt-14">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Miejsca {od}-{od + courts.length - 1}
      </h2>

      {/* rozmyta pomarańczowa poświata pod wierszami - zamyka sekcję i wtapia ją w tło */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[4%] -bottom-28 h-[300px] blur-[90px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,77,10,.34) 0%, rgba(255,122,24,.13) 52%, transparent 100%)",
        }}
      />

      <ol className="mt-4 space-y-2">
        {courts.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/boisko/${c.slug}`}
              className="glass row-glow flex items-center gap-4 rounded-[20px] p-3"
            >
              {/* pionowy akcent w kolorze marki - porządkuje wiersz od lewej */}
              <span className="h-12 w-[3px] shrink-0 rounded-full flame-gradient opacity-70" />

              <span className="w-7 shrink-0 text-center text-[15px] font-semibold tabular-nums text-faint">
                {od + i}
              </span>

              <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl">
                <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="96px" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">{c.name}</span>
                  {c.basketApproved && <BasketApprovedBadge />}
                  {c.funny && <FunnyBadge />}
                </span>
                <span className="block truncate text-[13px] text-muted">
                  {c.city} · {TYPE_LABEL[c.type]}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-bold text-glow">
                <FireBallIcon className="h-4 w-4" /> {c.likes}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Ranking odkrywców - ta sama szklana faktura co lista boisk. */
function Odkrywcy({ authors }: { authors: Author[] }) {
  return (
    <ol className="space-y-2">
      {authors.map((a, i) => (
        <li key={a.name} className="glass row-glow flex items-center gap-4 rounded-[20px] px-4 py-3.5">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
              i < 3 ? "flame-gradient text-black" : "glass-dim text-muted"
            }`}
          >
            {i + 1}
          </span>
          <Link href={`/gracz/${slugifyPlace(a.name)}`} className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold transition hover:text-flame">
              @{a.name}
            </span>
            <span className="block text-[13px] text-muted">
              {a.courts} {plural(a.courts, ["boisko", "boiska", "boisk"])} w bazie
            </span>
          </Link>
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-glow">
            <FireBallIcon className="h-4 w-4" /> {a.likes}
          </span>
        </li>
      ))}
    </ol>
  );
}
