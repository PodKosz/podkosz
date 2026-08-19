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

/**
 * Top 10 jako okładki: kwadratowe kafelki przewijane w poziomie, z zatrzymywaniem
 * na kolejnej pozycji. Kursor na kafelku podnosi go i zapala pomarańczową poświatę.
 */
function Karuzela({ courts }: { courts: Court[] }) {
  const row = useRef<HTMLDivElement | null>(null);

  const przewin = (kierunek: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    // szerokość jednego kafelka wraz z odstępem - przewijamy dokładnie o jedną okładkę
    const kafelek = el.firstElementChild?.getBoundingClientRect().width ?? 260;
    el.scrollBy({ left: kierunek * (kafelek + 16), behavior: "smooth" });
  };

  if (!courts.length) return null;

  return (
    <section className="relative">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Top {courts.length}</h2>
          <p className="mt-1 text-[14px] text-muted">
            Najczęściej podpalane boiska w bazie. Przewiń w prawo.
          </p>
        </div>

        {/* strzałki w szkle - na telefonie wystarcza sam gest przewijania */}
        <div className="hidden shrink-0 gap-2 sm:flex">
          {([-1, 1] as const).map((k) => (
            <button
              key={k}
              onClick={() => przewin(k)}
              aria-label={k === -1 ? "Poprzednie boiska" : "Następne boiska"}
              className="glass grid h-10 w-10 place-items-center rounded-full text-muted transition hover:text-flame"
            >
              <ArrowLeftIcon className={`h-4 w-4 ${k === 1 ? "rotate-180" : ""}`} />
            </button>
          ))}
        </div>
      </div>

      <div
        ref={row}
        className="cover-row -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3"
      >
        {courts.map((c, i) => (
          <Link
            key={c.id}
            href={`/boisko/${c.slug}`}
            className="glass glow-hover group relative aspect-square w-[240px] shrink-0 snap-start overflow-hidden rounded-[26px] sm:w-[268px]"
          >
            <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="280px" />

            {/* przygaszenie dołu pod podpisy */}
            <span className="absolute inset-0 bg-gradient-to-t from-void via-void/45 to-transparent" />

            {/* poświata pod kursorem - płynna plama w kolorze marki */}
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 110%, rgba(255,122,24,.45) 0%, rgba(255,77,10,.16) 45%, transparent 72%)",
              }}
            />

            {/* numer pozycji jako znak wodny */}
            <span
              className="pointer-events-none absolute -bottom-6 right-2 flame-text text-[112px] font-bold leading-none tabular-nums opacity-30 transition-opacity duration-300 group-hover:opacity-60"
              aria-hidden
            >
              {i + 1}
            </span>

            <span className="absolute left-4 top-4 flex items-center gap-2">
              <span className="glass-dim grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-glow">
                {i + 1}
              </span>
              {c.basketApproved && <BasketApprovedBadge />}
              {c.funny && <FunnyBadge />}
            </span>

            <span className="absolute inset-x-4 bottom-4">
              <span className="block truncate text-[17px] font-semibold">{c.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/70">
                <PinIcon className="h-3.5 w-3.5 text-flame" /> {c.city}
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[13px] font-bold text-glow backdrop-blur">
                <FireBallIcon className="h-4 w-4" /> {c.likes}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Miejsca 11-25: szklane wiersze z ciepłą smugą wjeżdżającą pod kursorem. */
function Lista({ courts, od }: { courts: Court[]; od: number }) {
  if (!courts.length) return null;

  return (
    <section className="mt-14">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Miejsca {od}-{od + courts.length - 1}
      </h2>

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
