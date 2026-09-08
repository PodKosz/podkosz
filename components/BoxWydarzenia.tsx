import { photoUrl } from "@/lib/supabase/config";
import {
  godziny,
  kiedy,
  plakietka,
  stanWydarzenia,
  wysokiPlakat,
  type Wydarzenie,
} from "@/lib/wydarzenia";
import { ClockIcon } from "./icons";
import { PlakatTla } from "./PlakatTla";

/**
 * Box wydarzenia na karcie boiska - w dwóch układach, wybieranych proporcją plakatu.
 *
 * Biało-czerwony, bo tak samo wygląda pinezka na mapie i wizytówka nad nią: kto kliknął
 * płonącą, biało-czerwoną pinezkę, ma zobaczyć tę samą rzecz w całości. Kolor jest tu
 * identyfikatorem, nie dekoracją - to jedyne miejsce w serwisie bez pomarańczu marki.
 *
 * ------------------------------------------------------------------ dlaczego dwa układy
 *
 * Plakat wydarzenia bywa czymkolwiek: pionowa grafika z telefonu 9:16, kadr z aparatu
 * 3:2, kwadrat z Instagrama. Jeden układ nie obsłuży wszystkich - i to było widać:
 *
 *   - szeroki pas z pionowym plakatem zostawiał 70% czarnej pustki obok tekstu,
 *   - wysoka karta z poziomym zdjęciem zostawiałaby pasy nad i pod nim.
 *
 * Dlatego proporcja pliku (zapisywana przy wgrywaniu, patrz `zdjecie_proporcje`) wybiera
 * układ:
 *
 *   PION albo kwadrat  -> WYSOKA KARTA w prawej kolumnie karty boiska, obok kafelków
 *                         z parametrami. Plakat jest tłem całej karty, tekst leży na jego
 *                         dolnej części.
 *   POZIOM             -> SZEROKI PAS nad kafelkami. Plakat wypełnia prawą część pasa,
 *                         tekst wchodzi na jego lewą krawędź.
 *
 * W obu układach zdjęcie jest TŁEM, nie osobnym kafelkiem obok tekstu - dzięki temu
 * wypełnia swoje pole przy każdych proporcjach (`object-cover`), a napisy leżą na nim
 * i są czytelne dzięki gradientowi. Kadrowanie tła nie boli, bo pełny plakat jest jednym
 * kliknięciem dalej.
 */

const CZERWIEN = "#e8112d";

/* Gradient pod tekstem. Dwa osobne, bo w wysokiej karcie tekst leży na dole, a w szerokim
   pasie - po lewej: kierunek przejścia musi iść za układem, nie odwrotnie. */
const GRADIENT_PION =
  "linear-gradient(0deg, #07070a 0%, rgba(7,7,10,0.97) 34%, rgba(7,7,10,0.72) 52%, rgba(7,7,10,0.12) 78%, rgba(7,7,10,0) 100%)";
const GRADIENT_POZIOM =
  "linear-gradient(90deg, #07070a 0%, rgba(7,7,10,0.96) 38%, rgba(7,7,10,0.7) 56%, rgba(7,7,10,0.15) 82%, rgba(7,7,10,0) 100%)";

export function BoxWydarzenia({ wydarzenie }: { wydarzenie: Wydarzenie }) {
  const stan = stanWydarzenia(wydarzenie);
  if (stan === "minelo") return null;

  const plakat = wydarzenie.zdjecie ? photoUrl(wydarzenie.zdjecie) : null;
  const pion = wysokiPlakat(wydarzenie);

  return (
    <section
      className={`relative overflow-hidden rounded-[26px] p-[2px] ${
        pion ? "h-full" : "z-10 -mt-6 mb-3"
      }`}
      style={{
        background: `linear-gradient(135deg, #ffffff 0%, #ffffff 42%, ${CZERWIEN} 58%, #8a0614 100%)`,
        boxShadow: `0 24px 60px -30px ${CZERWIEN}`,
      }}
    >
      {pion ? (
        <KartaPionowa wydarzenie={wydarzenie} plakat={plakat} stan={stan} />
      ) : (
        <PasPoziomy wydarzenie={wydarzenie} plakat={plakat} stan={stan} />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- wspólne części */

function Plakietki({
  wydarzenie,
  stan,
}: {
  wydarzenie: Wydarzenie;
  stan: ReturnType<typeof stanWydarzenia>;
}) {
  const trwa = stan === "trwa";
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span
        className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
        style={{ background: CZERWIEN }}
      >
        wydarzenie
      </span>
      <span
        className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur"
        style={{
          borderColor: "rgb(232 17 45 / .5)",
          color: trwa ? "#fff" : "#ff8593",
          background: trwa ? CZERWIEN : "rgb(232 17 45 / .12)",
        }}
      >
        {plakietka(wydarzenie)}
      </span>
    </div>
  );
}

function Termin({ wydarzenie, stan }: { wydarzenie: Wydarzenie; stan: string }) {
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium">
      <ClockIcon className="h-4 w-4 shrink-0" style={{ color: "#ff8593" }} />
      <span>{kiedy(wydarzenie)}</span>
      {stan !== "trwa" && (
        <span className="text-[13px] font-normal text-white/45">{`· ${godziny(wydarzenie)}`}</span>
      )}
    </p>
  );
}

/** Odnośnik do plakatu w pełnym rozmiarze - kadrowane tło jest podglądem, nie jedyną wersją. */
function LinkPlakatu({ plakat, nazwa }: { plakat: string; nazwa: string }) {
  return (
    <a
      href={plakat}
      target="_blank"
      rel="noreferrer"
      className="absolute right-4 top-4 z-20 rounded-full border border-white/20 bg-void/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
      aria-label={`Otwórz plakat wydarzenia w pełnym rozmiarze: ${nazwa}`}
    >
      plakat
    </a>
  );
}

/* ---------------------------------------------------------------- układ pionowy */

/**
 * Wysoka karta do prawej kolumny.
 *
 * `h-full` na całej karcie i na tle: karta dostaje wysokość z sąsiedniej kolumny (kafelki
 * plus box z opisem), a plakat ją wypełnia. Na telefonie kolumny nie ma, więc karta bierze
 * własne proporcje 3:4 - inaczej pionowy plakat rozciągnąłby ją na dwa ekrany.
 */
function KartaPionowa({
  wydarzenie,
  plakat,
  stan,
}: {
  wydarzenie: Wydarzenie;
  plakat: string | null;
  stan: ReturnType<typeof stanWydarzenia>;
}) {
  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[24px] bg-void">
      {plakat && (
        <>
          {/* na dużym ekranie karta stoi w wąskiej kolumnie, na telefonie zajmuje całą szerokość */}
          <PlakatTla
            plakat={plakat}
            nazwa={wydarzenie.nazwa}
            bazowa={720}
            szerokosci={[480, 720, 1080]}
            sizes="(min-width: 1024px) 360px, 100vw"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: GRADIENT_PION }}
          />
          {/* ciepły odblask w barwie wydarzenia - żeby zdjęcie i ramka były z jednego świata */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background: `radial-gradient(120% 80% at 20% 100%, rgb(232 17 45 / .22), transparent 70%)`,
            }}
          />
          <LinkPlakatu plakat={plakat} nazwa={wydarzenie.nazwa} />
        </>
      )}

      <div className="relative flex h-full min-h-[420px] flex-col justify-end p-6 sm:p-7">
        <Plakietki wydarzenie={wydarzenie} stan={stan} />
        <h2 className="mt-3.5 text-[clamp(21px,2.2vw,28px)] font-semibold leading-[1.12] tracking-[-0.02em]">
          {wydarzenie.nazwa}
        </h2>
        <Termin wydarzenie={wydarzenie} stan={stan} />
        {wydarzenie.opis && (
          <p className="mt-3.5 line-clamp-4 text-[14px] leading-relaxed text-white/70">
            {wydarzenie.opis}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- układ poziomy */

/**
 * Szeroki pas nad kafelkami.
 *
 * Zdjęcie wypełnia cały pas i jest przykryte gradientem od lewej, więc tekst wchodzi na
 * jego krawędź bez ostrej granicy między kolumnami. Wysokość pasa jest stała (z zakresem
 * od 230 do 320 px) - żadne zdjęcie jej nie rozpycha, bo to ono się wpasowuje, nie odwrotnie.
 */
function PasPoziomy({
  wydarzenie,
  plakat,
  stan,
}: {
  wydarzenie: Wydarzenie;
  plakat: string | null;
  stan: ReturnType<typeof stanWydarzenia>;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] bg-void"
      style={{ minHeight: "clamp(230px, 24vw, 320px)" }}
    >
      {plakat && (
        <>
          {/*
            Zdjęcie zaczyna się od 34% szerokości - lewa część pasa zostaje na tekst.
            Na telefonie zajmuje całe tło, bo tam nie ma miejsca na dwie kolumny obok siebie.
          */}
          <PlakatTla
            plakat={plakat}
            nazwa={wydarzenie.nazwa}
            bazowa={960}
            szerokosci={[640, 960, 1440]}
            sizes="(min-width: 640px) 66vw, 100vw"
            className="absolute inset-y-0 right-0 h-full w-full object-cover object-center sm:w-[66%]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: GRADIENT_POZIOM }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-2/3"
            style={{
              background: `radial-gradient(90% 120% at 0% 60%, rgb(232 17 45 / .18), transparent 72%)`,
            }}
          />
          <LinkPlakatu plakat={plakat} nazwa={wydarzenie.nazwa} />
        </>
      )}

      <div className="relative flex min-h-[inherit] max-w-[min(60ch,62%)] flex-col justify-center p-6 sm:p-8">
        <Plakietki wydarzenie={wydarzenie} stan={stan} />
        <h2 className="mt-4 text-[clamp(22px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.02em]">
          {wydarzenie.nazwa}
        </h2>
        <Termin wydarzenie={wydarzenie} stan={stan} />
        {wydarzenie.opis && (
          <p className="mt-4 line-clamp-3 text-[14px] leading-relaxed text-white/70">
            {wydarzenie.opis}
          </p>
        )}
      </div>
    </div>
  );
}
