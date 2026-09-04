import Link from "next/link";
import { Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { CourtPhoto } from "@/components/CourtPhoto";
import {
  BasketApprovedBadge,
  FireBallIcon,
  FunnyBadge,
  HoopIcon,
  PinIcon,
  SurfaceIcon,
} from "@/components/icons";

/**
 * Ranking boisk.
 *
 * Wszystkie karty są kadrem z treścią NA nim, a nie kadrem z panelem pod spodem. To jedna
 * decyzja, która przesądza o reszcie: karta staje się plakatem, wysokość dobiera zdjęcie,
 * a nie długość opisu, i znika problem pustych pól przy krótkich nazwach. Ten sam język
 * obowiązuje na wszystkich trzech poziomach, więc strona czyta się jak jedna rzecz.
 *
 * Poziomy różnią się wyłącznie skalą i gęstością - i to ona niesie kolejność:
 *
 *   1. Zwycięzca - jeden kadr na całą szerokość, panoramiczny. Nie da się go pomylić z niczym.
 *   2. Miejsca 2-4 - trzy kadry w rzędzie, wciąż duże.
 *   3. Miejsca 5-10 - sześć kadrów, czyli dokładnie dwa pełne rzędy po trzy.
 *   4. Miejsca 11-25 - włosowe wiersze w dwóch kolumnach; przy tej gęstości zdjęcie jest
 *      już tylko znacznikiem, a nie treścią.
 *
 * Podział 1 + 3 + 6 jest tu wyborem arytmetycznym, nie estetycznym: przy trzech kolumnach
 * każdy rząd wychodzi pełny. Poprzedni układ 1 + 2 + 7 zostawiał w ostatnim rzędzie
 * pojedynczą kartę i pustkę obok niej - a nic nie psuje siatki tak, jak niedomknięty rząd.
 *
 * Całość jest zwykłym HTML-em bez stanu. Pojawianie się przy przewijaniu, reakcje na
 * kursor i potwierdzenie kliknięcia robi CSS (patrz `.wjazd`, `.karta-rankingu`), więc
 * strona renderuje się na serwerze, wyszukiwarka widzi pełną listę, a przeglądarka nie
 * dostaje ani jednego nasłuchu przewijania.
 */

const SIATKA_DO = 10;
const LISTA_DO = 25;

export function RankingBoisk({ courts }: { courts: Court[] }) {
  const [pierwszy, ...reszta] = courts;
  const trojka = reszta.slice(0, 3);
  const siatka = courts.slice(4, SIATKA_DO);
  const lista = courts.slice(SIATKA_DO, LISTA_DO);

  if (!pierwszy) {
    return (
      <p className="szklo-pro rounded-[28px] p-10 text-center text-[15px] text-muted">
        Baza jest jeszcze pusta - dodaj pierwsze boisko.
      </p>
    );
  }

  return (
    <div className="space-y-24">
      <section className="wjazd">
        <KartaBoiska court={pierwszy} miejsce={1} wariant="zwyciezca" />
      </section>

      {trojka.length > 0 && (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {trojka.map((c, i) => (
            <div key={c.id} className="wjazd">
              <KartaBoiska court={c} miejsce={i + 2} wariant="trojka" />
            </div>
          ))}
        </section>
      )}

      {siatka.length > 0 && (
        <section>
          <Naglowek tytul="Goniący" opis={`Miejsca 5-${4 + siatka.length}`} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {siatka.map((c, i) => (
              <div key={c.id} className="wjazd">
                <KartaBoiska court={c} miejsce={i + 5} />
              </div>
            ))}
          </div>
        </section>
      )}

      {lista.length > 0 && (
        <section>
          <Naglowek
            tytul="W stawce"
            opis={`Miejsca ${SIATKA_DO + 1}-${SIATKA_DO + lista.length}`}
          />
          {/*
            Dwie kolumny od dużego ekranu. Jedna kolumna wierszy przez pół monitora to
            wąska wstęga z pustką po bokach - dokładnie to, co sprawiało, że poprzednia
            wersja wyglądała na zawieszoną w próżni.
          */}
          <ol className="mt-6 grid xl:grid-cols-2 xl:gap-x-12">
            {lista.map((c, i) => (
              <WierszBoiska key={c.id} court={c} miejsce={SIATKA_DO + 1 + i} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Naglowek({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className="wjazd-boczny flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-4">
      <h2 className="text-[clamp(20px,2.2vw,28px)] font-semibold tracking-[-0.02em]">{tytul}</h2>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">{opis}</p>
    </div>
  );
}

/**
 * Karta boiska - kadr z treścią na nim.
 *
 * Trzy warianty różnią się wysokością kadru i skalą pisma. Wszystko poza tym jest wspólne:
 * ten sam gradient u dołu, ten sam wydrążony numer, ta sama listwa faktów. Wariant nie
 * zmienia więc KOMPOZYCJI, tylko jej głośność.
 */
function KartaBoiska({
  court,
  miejsce,
  wariant = "siatka",
}: {
  court: Court;
  miejsce: number;
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
        priority={miejsce <= 3}
      />

      <span className="karta-rankingu-zaslona pointer-events-none absolute inset-0" />
      <span aria-hidden className="karta-rankingu-blysk" />

      {/* włosowa obwódka od środka - szkło ma krawędź, ale nie ramkę */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.14)]"
      />

      {(court.basketApproved || court.funny) && (
        <span className="absolute left-5 top-5 z-[2] flex flex-wrap gap-1.5">
          {court.basketApproved && <BasketApprovedBadge />}
          {court.funny && <FunnyBadge />}
        </span>
      )}

      {/* numer w prawym górnym rogu - czyta się jak paginacja, nie jak nalepka */}
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

      <span
        className={`relative z-[2] mt-auto flex w-full flex-col gap-3 ${
          zwyciezca ? "p-7 sm:p-9" : "p-6"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[13px] font-bold text-glow backdrop-blur">
            <FireBallIcon className="h-4 w-4" /> {court.likes}
          </span>
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

/**
 * Zwarty wiersz - dla miejsc, przy których liczy się już tylko nazwa i liczba podpaleń.
 *
 * `min-w-0` na elemencie listy jest tu konieczne, nie kosmetyczne: element siatki ma
 * domyślnie `min-width: auto`, więc nie kurczy się poniżej szerokości własnej treści.
 * Długa nazwa boiska rozpychała wtedy wiersz na osiemset pikseli i cała strona dostawała
 * poziomy pasek przewijania na telefonie - mimo `truncate` w środku.
 */
function WierszBoiska({ court, miejsce }: { court: Court; miejsce: number }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/boisko/${court.slug}`}
        className="wiersz-rankingu group flex items-center gap-4 py-3 pr-2"
      >
        <span className="w-10 shrink-0 text-center text-[14px] font-semibold tabular-nums text-faint transition-colors group-hover:text-flame">
          {String(miejsce).padStart(2, "0")}
        </span>

        <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[14px]">
          <CourtPhoto photo={court.photos[0]} seed={court.seed} sizes="96px" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">{court.name}</span>
            {court.basketApproved && <BasketApprovedBadge />}
            {court.funny && <FunnyBadge />}
          </span>
          <span className="block truncate text-[13px] text-faint">
            {court.city} · {TYPE_LABEL[court.type]}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-glow">
          <FireBallIcon className="h-4 w-4" /> {court.likes}
        </span>
      </Link>
    </li>
  );
}
