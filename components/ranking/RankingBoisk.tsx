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
 * Trzy pasy o malejącej wadze, bo tak się czyta ranking: kto wygrał, kto goni, kto jeszcze
 * jest w stawce. Każdy pas ma inną gęstość i inny rozmiar kadru, więc kolejność widać
 * układem, zanim ktokolwiek przeczyta numer.
 *
 *   1. Podium (1-3) - jedna wielka karta i dwie mniejsze obok. Asymetria jest tu celem,
 *      nie ozdobą: trzy równe kafelki mówiłyby, że te miejsca są równorzędne.
 *   2. Miejsca 4-10 - siatka kart średniej wielkości, do czterech w rzędzie.
 *   3. Miejsca 11-25 - zwarte wiersze w dwóch kolumnach, bo przy tej gęstości zdjęcie jest
 *      już tylko znacznikiem, a nie treścią.
 *
 * Wszystko jest zwykłym HTML-em bez stanu - żadna z tych rzeczy nie wymaga JavaScriptu,
 * więc strona renderuje się na serwerze i wyszukiwarka widzi pełną listę.
 */

/** Ile boisk trafia do siatki środkowej, a ile do listy na dole. */
const SIATKA_DO = 10;
const LISTA_DO = 25;

export function RankingBoisk({ courts }: { courts: Court[] }) {
  const podium = courts.slice(0, 3);
  const siatka = courts.slice(3, SIATKA_DO);
  const lista = courts.slice(SIATKA_DO, LISTA_DO);

  if (!podium.length) {
    return (
      <p className="szklo-pro rounded-[26px] p-10 text-center text-[15px] text-muted">
        Baza jest jeszcze pusta - dodaj pierwsze boisko.
      </p>
    );
  }

  return (
    <div className="space-y-20">
      <Podium courts={podium} />

      {siatka.length > 0 && (
        <section>
          <Naglowek tytul="Goniący" opis={`Miejsca 4-${3 + siatka.length}`} />
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {siatka.map((c, i) => (
              <KartaBoiska key={c.id} court={c} miejsce={i + 4} />
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
            wąska wstęga tekstu z pustką po bokach - dokładnie to, co sprawiało, że
            poprzednia wersja wyglądała na zawieszoną w próżni.
          */}
          <ol className="mt-7 grid gap-2.5 xl:grid-cols-2 xl:gap-x-5">
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
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-3">
      <h2 className="text-[clamp(19px,2vw,24px)] font-semibold tracking-[-0.01em]">{tytul}</h2>
      <p className="text-[12px] uppercase tracking-[0.18em] text-faint">{opis}</p>
    </div>
  );
}

/**
 * Podium.
 *
 * Na dużym ekranie dwanaście kolumn: zwycięzca bierze siedem i pełną wysokość, drugie
 * i trzecie dzielą pozostałe pięć, jedno pod drugim. Proporcja siedem do pięciu jest
 * bliska złotemu podziałowi i czyta się jako „ten jest ważniejszy", a nie „ten jest
 * przypadkowo większy".
 */
function Podium({ courts }: { courts: Court[] }) {
  const [pierwszy, ...reszta] = courts;

  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <KartaBoiska court={pierwszy} miejsce={1} wariant="zwyciezca" />
      </div>

      {reszta.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {reszta.map((c, i) => (
            <KartaBoiska key={c.id} court={c} miejsce={i + 2} wariant="podium" />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Karta boiska.
 *
 * Trzy warianty różnią się wyłącznie proporcją kadru i wielkością pisma - reszta (szkło,
 * numer, plakietki, dolna listwa) jest wspólna, żeby cała strona czytała się jako jedna
 * rodzina, a nie trzy osobne pomysły.
 */
function KartaBoiska({
  court,
  miejsce,
  wariant = "siatka",
}: {
  court: Court;
  miejsce: number;
  wariant?: "zwyciezca" | "podium" | "siatka";
}) {
  const zwyciezca = wariant === "zwyciezca";
  const proporcje = wariant === "podium" ? "16 / 9" : "4 / 3";

  return (
    <Link
      href={`/boisko/${court.slug}`}
      className="karta-rankingu szklo-pro group relative flex h-full flex-col overflow-hidden rounded-[26px]"
    >
      {/*
        U zwycięzcy kadr rozciąga się na całą wolną wysokość zamiast trzymać stałe
        proporcje. Karta stoi obok kolumny z dwiema mniejszymi i musi sięgnąć jej dna;
        gdyby wysokość dobierał opis, między nazwą a listwą faktów zostawała pusta dziura
        na jedną trzecią karty. Szczegóły w `.karta-zwyciezcy-kadr` w globals.css - na
        wąskim ekranie wraca zwykła proporcja, bo tam nic się obok nie układa.
      */}
      <span
        className={`relative block overflow-hidden ${zwyciezca ? "karta-zwyciezcy-kadr" : ""}`}
        style={zwyciezca ? undefined : { aspectRatio: proporcje }}
      >
        <CourtPhoto
          photo={court.photos[0]}
          seed={court.seed}
          sizes={zwyciezca ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 1280px) 24vw, 50vw"}
          priority={miejsce <= 3}
        />

        {/* wygaszenie dołu kadru - bez niego numer i podpalenia gubią się na jasnym zdjęciu */}
        <span className="karta-rankingu-zaslona pointer-events-none absolute inset-0" />

        {/*
          Numer miejsca jako znak wodny w kadrze. Duży, ale wtopiony - ma być widoczny
          kątem oka przy przewijaniu, a nie konkurować ze zdjęciem boiska.
        */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -bottom-2 right-3 flame-text font-bold leading-none tabular-nums opacity-60 transition-opacity duration-500 group-hover:opacity-90 ${
            zwyciezca
              ? "text-[clamp(88px,11vw,168px)]"
              : wariant === "podium"
                ? "text-[clamp(64px,7vw,104px)]"
                : "text-[clamp(48px,5vw,76px)]"
          }`}
        >
          {miejsce}
        </span>

        {(court.basketApproved || court.funny) && (
          <span className="absolute left-4 top-4 flex flex-wrap gap-1.5">
            {court.basketApproved && <BasketApprovedBadge />}
            {court.funny && <FunnyBadge />}
          </span>
        )}

        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[13px] font-bold text-glow backdrop-blur">
          <FireBallIcon className="h-4 w-4" /> {court.likes}
        </span>
      </span>

      <span className="flex flex-col gap-3 p-5">
        <span className="block">
          <span
            className={`block truncate font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-glow ${
              zwyciezca ? "text-[clamp(20px,2.4vw,30px)]" : "text-[clamp(15px,1.4vw,19px)]"
            }`}
          >
            {court.name}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
            <PinIcon className="h-3.5 w-3.5 shrink-0 text-flame" />
            {court.city}
          </span>
        </span>

        {/* trzy fakty w jednej linii - tyle, ile trzeba, żeby zdecydować, czy tam iść */}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-faint">
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
        className="wiersz-rankingu group flex items-center gap-4 rounded-[20px] p-2.5 pr-5"
      >
        <span className="w-9 shrink-0 text-center text-[15px] font-semibold tabular-nums text-faint transition-colors group-hover:text-flame">
          {miejsce}
        </span>

        <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[14px]">
          <CourtPhoto photo={court.photos[0]} seed={court.seed} sizes="96px" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{court.name}</span>
            {court.basketApproved && <BasketApprovedBadge />}
            {court.funny && <FunnyBadge />}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {court.city} · {TYPE_LABEL[court.type]}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-bold text-glow">
          <FireBallIcon className="h-4 w-4" /> {court.likes}
        </span>
      </Link>
    </li>
  );
}
