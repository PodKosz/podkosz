import Link from "next/link";
import { Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { CourtPhoto } from "@/components/CourtPhoto";
import { plural } from "@/lib/site";
import {
  BasketApprovedBadge,
  FunnyBadge,
  HoopIcon,
  PinIcon,
  SurfaceIcon,
} from "@/components/icons";
import { TabelaRankingu } from "./TabelaRankingu";

/**
 * Ranking boisk (23.10.2026, propozycje 01 „Podium” + 02 „Tabela” z F:\CLAUDE\podkosz-karty\ranking).
 *
 * Trzy najlepsze stoją na podium - pierwsze na środku i najwyżej, drugie z lewej, trzecie
 * z prawej, jak na zawodach. Pod podium tabela całej stawki z filtrem województw (osobny
 * komponent kliencki, bo filtr zmienia listę bez przeładowania). Język nowej karty boiska:
 * bez ramek, linie z gradientem między wierszami, numery miejsc Antonem.
 *
 * Kolejność to `ranking_wynik` z bazy - średnia ocen ważona liczbą opinii, od 10 opinii.
 */

/** Ile boisk pobieramy - wszystkie z rankingu, bo filtr województw musi mieć z czego wybierać. */
export const RANKING_DO = 500;

/** Ile opinii musi mieć boisko, żeby wejść do rankingu - to samo progowe 10 liczy baza. */
export const RANKING_OD_OPINII = 10;

/* „4,6” - lokalnie, bo `lib/opinie.ts` jest modułem klienta, a ranking renderuje się na serwerze */
const ocenaTekstem = (n: number) => n.toFixed(1).replace(".", ",");

/** Gwiazdka z oceną i liczbą opinii - w miejscu dawnej liczby podpaleń. */
function Ocena({ court, krotko = false }: { court: Court; krotko?: boolean }) {
  const o = court.opinie;
  if (!o?.liczba || o.srednia === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
      </svg>
      {ocenaTekstem(o.srednia)}
      {!krotko && (
        <span className="font-medium opacity-70">
          · {o.liczba} {plural(o.liczba, ["opinia", "opinie", "opinii"])}
        </span>
      )}
    </span>
  );
}

export function RankingBoisk({ courts }: { courts: Court[] }) {
  if (!courts.length) {
    return (
      <p className="rk-pusto">
        Ranking rusza, gdy boisko zbierze {RANKING_OD_OPINII} opinii. Oceń boiska, na których grasz.
      </p>
    );
  }

  return (
    <>
      <Podium courts={courts.slice(0, 3)} />
      <TabelaRankingu boiska={courts} />
    </>
  );
}

/**
 * Podium. W kodzie kolejność 1-2-3 (tak czyta czytnik ekranu), na ekranie 2-1-3 - przestawia
 * ją `order` w arkuszu. Wysokości kadrów maleją z miejscem, więc pierwsze naprawdę stoi wyżej.
 */
function Podium({ courts }: { courts: Court[] }) {
  return (
    <ol className="rk-podium" aria-label="Podium">
      {courts.map((c, i) => (
        <li key={c.id} className="rk-podium-miejsce">
          <Link href={`/boisko/${c.slug}`} className="rk-podium-link">
            <span className="rk-podium-kadr">
              <CourtPhoto
                photo={c.photos[0]}
                seed={c.seed}
                sizes="(min-width: 1024px) 420px, 36vw"
                priority
              />
              <span className="rk-podium-nr font-display" aria-label={`Miejsce ${i + 1}`}>
                {i + 1}
              </span>
              {c.opinie?.srednia != null && (
                <span className="rk-podium-ocena">
                  <Gwiazdka /> {ocenaTekstem(c.opinie.srednia)}
                </span>
              )}
            </span>
            <b>{c.name}</b>
            <small>
              {c.city} · {c.opinie?.liczba ?? 0} {plural(c.opinie?.liczba ?? 0, ["opinia", "opinie", "opinii"])}
            </small>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Gwiazdka() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1em] w-[1em]" fill="currentColor" aria-hidden>
      <path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
    </svg>
  );
}

/**
 * Karta boiska - kadr z treścią na nim.
 *
 * Trzy warianty różnią się wysokością kadru i skalą pisma. Wszystko poza tym jest wspólne:
 * ten sam gradient u dołu, ten sam wydrążony numer, ta sama listwa faktów. Wariant nie
 * zmienia więc KOMPOZYCJI, tylko jej głośność.
 *
 * Tej samej karty używa profil gracza dla boisk, które dodał - bez numeru miejsca, bo tam
 * nie ma kolejności, tylko lista.
 */
export function KartaBoiska({
  court,
  miejsce,
  wariant = "siatka",
}: {
  court: Court;
  miejsce?: number;
  wariant?: "zwyciezca" | "trojka" | "siatka";
}) {
  const zwyciezca = wariant === "zwyciezca";
  const trojka = wariant === "trojka";

  /*
    Wysokość zamiast proporcji. Panoramiczny kadr opisany proporcją potrafi na wąskim
    ekranie schudnąć do paska wysokiego na sto pikseli; `clamp` trzyma dolną granicę,
    a górną wiąże z szerokością okna, więc kadr rośnie razem z ekranem i nigdy nie zjada
    całej strony.
  */
  const wysokosc = zwyciezca
    ? "clamp(380px, 44vw, 660px)"
    : trojka
      ? "clamp(300px, 29vw, 440px)"
      : "clamp(240px, 21vw, 320px)";

  return (
    <Link
      href={`/boisko/${court.slug}`}
      className="karta-rankingu group relative flex overflow-hidden rounded-[28px]"
      style={{ height: wysokosc }}
    >
      <CourtPhoto
        photo={court.photos[0]}
        seed={court.seed}
        sizes={
          zwyciezca
            ? "(min-width: 1600px) 1600px, 100vw"
            : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        }
        priority={miejsce !== undefined && miejsce <= 3}
      />

      <span className="karta-rankingu-zaslona pointer-events-none absolute inset-0" />
      <span aria-hidden className="karta-rankingu-blysk" />

      {/*
        Szkło: dwa jasne rąbki przy górnej i dolnej krawędzi plus włosowa obwódka od środka -
        dokładnie to, co na kafelkach z liczbami na profilu gracza. Kafel boiska i kafelek
        liczby stoją w serwisie obok siebie i mają być z jednego materiału.
      */}
      <span aria-hidden className="szklo-krawedzie pointer-events-none absolute inset-0" />

      {(court.basketApproved || court.funny) && (
        <span className="absolute left-5 top-5 z-[2] flex flex-wrap gap-1.5">
          {court.basketApproved && <BasketApprovedBadge />}
          {court.funny && <FunnyBadge />}
        </span>
      )}

      {/* numer w prawym górnym rogu - czyta się jak paginacja, nie jak nalepka */}
      {miejsce !== undefined && (
        <span
          aria-hidden
          className={`numer-rankingu pointer-events-none absolute right-5 top-2 z-[2] font-bold leading-none tabular-nums ${
            zwyciezca
              ? "text-[clamp(76px,9vw,150px)]"
              : trojka
                ? "text-[clamp(54px,5.5vw,92px)]"
                : "numer-rankingu-maly text-[clamp(40px,4vw,64px)]"
          }`}
        >
          {String(miejsce).padStart(2, "0")}
        </span>
      )}

      <span
        className={`relative z-[2] mt-auto flex w-full flex-col gap-3 ${
          zwyciezca ? "p-7 sm:p-9" : "p-6"
        }`}
      >
        <span className="flex items-center gap-2.5">
          {court.opinie?.liczba ? (
            <span className="inline-flex items-center rounded-full bg-black/45 px-3 py-1.5 text-[13px] font-bold text-kadr backdrop-blur">
              <Ocena court={court} />
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 text-[13px] text-kadr/70">
            <PinIcon className="h-3.5 w-3.5 text-flame" />
            {court.city}
          </span>
        </span>

        <span
          className={`block font-semibold leading-[1.05] tracking-[-0.025em] transition-colors group-hover:text-glow ${
            zwyciezca
              ? "text-[clamp(26px,3.4vw,52px)]"
              : trojka
                ? "text-[clamp(19px,2vw,29px)]"
                : "text-[clamp(16px,1.5vw,21px)]"
          }`}
        >
          {court.name}
        </span>

        <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-kadr/55">
          <span className="inline-flex items-center gap-1.5">
            <HoopIcon className="h-3.5 w-3.5 text-flame/80" />
            {TYPE_LABEL[court.type]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SurfaceIcon className="h-3.5 w-3.5 text-flame/80" />
            {surfaceLabel(court.surface)}
          </span>
        </span>
      </span>
    </Link>
  );
}
