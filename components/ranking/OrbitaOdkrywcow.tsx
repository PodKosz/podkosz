import Link from "next/link";
import type { OdkrywcaRanking } from "@/lib/repo";
import { plural } from "@/lib/site";
import { CourtPhoto } from "../CourtPhoto";
import { FireBallIcon } from "../icons";

/**
 * Top 5 odkrywców jako konstelacja.
 *
 * Każda osoba to okrągły avatar, a wokół niego - dotykając jego krawędzi - okrągłe zdjęcia
 * tytułowe boisk, które dodała. Wielkość układu wynika z liczby boisk, więc pierwsze miejsce
 * jest największe. Pierścień obraca się leniwie i staje pod kursorem, a zdjęcia obracają się
 * w drugą stronę, żeby stały prosto.
 *
 * Miejsca bez właściciela zostają jako przerywane kręgi - od razu widać, ile jest jeszcze
 * do wzięcia.
 */

/** Ile miejsc pokazuje konstelacja. */
export const MIEJSC_W_KONSTELACJI = 5;

/** Najmniejszy udział w rozmiarze - nawet jedno boisko ma być widoczne. */
const MIN_SKALA = 0.52;

/** Kolejność na dużym ekranie: największy w środku, dalsze coraz bardziej na zewnątrz. */
const KOLEJNOSC = ["lg:order-3", "lg:order-2", "lg:order-4", "lg:order-1", "lg:order-5"];

export function OrbitaOdkrywcow({ odkrywcy }: { odkrywcy: OdkrywcaRanking[] }) {
  const maks = Math.max(...odkrywcy.map((o) => o.courts), 1);
  const miejsca = Array.from({ length: MIEJSC_W_KONSTELACJI }, (_, i) => odkrywcy[i] ?? null);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-12 sm:gap-x-10 lg:flex-nowrap lg:gap-x-4">
      {miejsca.map((o, i) =>
        o ? (
          <Gwiazda
            key={o.slug}
            odkrywca={o}
            miejsce={i + 1}
            skala={MIN_SKALA + (1 - MIN_SKALA) * (o.courts / maks)}
            klasa={KOLEJNOSC[i] ?? ""}
            /* kadry pierwszego miejsca wczytujemy od razu - to one witają na stronie */
            odRazu={i === 0}
          />
        ) : (
          <WolneMiejsce key={`wolne-${i}`} miejsce={i + 1} klasa={KOLEJNOSC[i] ?? ""} />
        )
      )}
    </div>
  );
}

function Gwiazda({
  odkrywca,
  miejsce,
  skala,
  klasa,
  odRazu = false,
}: {
  odkrywca: OdkrywcaRanking;
  miejsce: number;
  skala: number;
  klasa: string;
  odRazu?: boolean;
}) {
  const kadry = odkrywca.kadry.slice(0, 8);
  const krok = kadry.length ? 360 / kadry.length : 0;

  return (
    <div
      className={`orbita group relative flex shrink-0 flex-col items-center ${klasa}`}
      style={{ ["--f" as string]: skala.toFixed(3) }}
    >
      <div className="relative h-[var(--pole)] w-[var(--pole)]">
        {/* poświata pod avatarem - rozjaśnia się pod kursorem */}
        <span
          className="orbita-blask pointer-events-none absolute left-1/2 top-1/2 h-[var(--avatar)] w-[var(--avatar)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[30px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,77,10,.5) 0%, rgba(255,122,24,.16) 58%, transparent 100%)",
          }}
        />

        {/* pierścień ze zdjęciami boisk - kręci się, pod kursorem staje */}
        <div className="orbita-pierscien absolute inset-0">
          {kadry.map((k, i) => (
            <Link
              key={k.slug}
              href={`/boisko/${k.slug}`}
              title={k.name}
              className="orbita-kadr absolute left-1/2 top-1/2 block h-[var(--kadr)] w-[var(--kadr)] overflow-hidden rounded-full"
              style={{ ["--kat" as string]: `${-90 + i * krok}deg` }}
            >
              <span className="orbita-kadr-obraz block h-full w-full overflow-hidden rounded-full">
                <CourtPhoto photo={k.photo} seed={k.seed} sizes="120px" priority={odRazu} />
              </span>
            </Link>
          ))}
        </div>

        {/* avatar w środku */}
        <Link
          href={`/gracz/${odkrywca.slug}`}
          className="orbita-avatar absolute left-1/2 top-1/2 z-[2] grid h-[var(--avatar)] w-[var(--avatar)] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full"
        >
          {odkrywca.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={odkrywca.avatar} alt={odkrywca.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flame-gradient grid h-full w-full place-items-center text-[calc(var(--avatar)*0.34)] font-bold text-black">
              {odkrywca.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
      </div>

      <div className="max-w-[200px] text-center">
        {/*
          Numer miejsca stoi przy nicku, a nie na avatarze: zdjęcia krążą po całym obwodzie,
          więc każde miejsce na kole raz na jakiś czas zasłaniałaby okrągła miniatura.
        */}
        <span className="flex items-center justify-center gap-2">
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums ${
              miejsce === 1 ? "flame-gradient text-black" : "glass-dim text-glow"
            }`}
          >
            {miejsce}
          </span>
          <Link
            href={`/gracz/${odkrywca.slug}`}
            className="min-w-0 truncate text-[15px] font-semibold transition hover:text-flame sm:text-[17px]"
          >
            @{odkrywca.name}
          </Link>
        </span>
        <p className="mt-1 flame-text pb-0.5 text-[22px] font-bold leading-none tabular-nums sm:text-[26px]">
          {odkrywca.courts}
        </p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-faint">
          {plural(odkrywca.courts, ["boisko", "boiska", "boisk"])}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-glow">
          <FireBallIcon className="h-4 w-4" /> {odkrywca.likes}
        </p>
      </div>
    </div>
  );
}

/** Miejsce, które jeszcze czeka na właściciela. */
function WolneMiejsce({ miejsce, klasa }: { miejsce: number; klasa: string }) {
  return (
    <div
      className={`orbita relative flex shrink-0 flex-col items-center ${klasa}`}
      style={{ ["--f" as string]: (MIN_SKALA + 0.06).toFixed(3) }}
    >
      <div className="relative h-[var(--pole)] w-[var(--pole)]">
        <span className="orbita-wolne absolute left-1/2 top-1/2 grid h-[var(--avatar)] w-[var(--avatar)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[calc(var(--avatar)*0.3)] font-bold text-faint">
          {miejsce}
        </span>
      </div>

      <div className="text-center">
        <p className="text-[13px] text-faint">wolne miejsce</p>
        <Link
          href="/dodaj"
          className="mt-1 inline-block text-[13px] font-medium text-muted transition hover:text-flame"
        >
          dodaj boisko
        </Link>
      </div>
    </div>
  );
}
