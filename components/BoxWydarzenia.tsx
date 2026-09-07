import { photoUrl } from "@/lib/supabase/config";
import { godziny, kiedy, plakietka, stanWydarzenia, type Wydarzenie } from "@/lib/wydarzenia";
import { ClockIcon } from "./icons";

/**
 * Box wydarzenia na karcie boiska.
 *
 * Biało-czerwony, bo tak samo wygląda pinezka na mapie i wizytówka nad nią - kto kliknął
 * płonącą, biało-czerwoną pinezkę, ma zobaczyć tę samą rzecz, tylko w całości. Kolor jest
 * tu identyfikatorem, nie dekoracją: to jedyne miejsce w serwisie, gdzie nie obowiązuje
 * pomarańcz marki, i właśnie dlatego wydarzenie widać.
 *
 * ------------------------------------------------------------------ wysokość
 *
 * WYSOKOŚĆ BOXA BIERZE SIĘ Z TREŚCI, NIGDY ZE ZDJĘCIA - i to jest sedno tego układu.
 *
 * Poprzednia wersja miała plakat jako zwykły element obok tekstu. Przy zdjęciu w pionie
 * (a plakaty są w pionie) jego własna wysokość rozpychała wiersz siatki do 570 pikseli,
 * z czego 70% było czarną pustką pod krótkim opisem. Zdjęcie poziome dawało z kolei pasek
 * niższy niż tekst. Format zdjęcia decydował o wyglądzie strony - a nie powinien decydować
 * o niczym.
 *
 * Teraz plakat jest POZYCJONOWANY ABSOLUTNIE w kaflu o stałej szerokości: nie wnosi
 * wysokości do siatki, więc wiersz mierzy się samym tekstem. Kafel dostaje tylko dolną
 * granicę (żeby przy jednozdaniowym opisie nie zrobił się paskiem) i rośnie razem z opisem.
 *
 * ------------------------------------------------------------------ każdy format
 *
 * W kaflu leżą DWIE KOPIE tego samego zdjęcia:
 *   - w tle, rozmyta i skalowana z przycięciem - wypełnia kafel barwą plakatu,
 *   - na wierzchu, wpisana w całości (`object-contain`) - widać każdy centymetr plakatu.
 *
 * Dzięki temu pion, poziom i kwadrat wyglądają dobrze bez ani jednej gałęzi w kodzie
 * i bez pytania serwera o wymiary pliku. Nic nie jest ucięte i nigdzie nie ma czarnych
 * pasów. Kliknięcie otwiera plakat w pełnym rozmiarze - kafel jest podglądem, nie
 * jedynym miejscem, gdzie da się go zobaczyć.
 */

const CZERWIEN = "#e8112d";

export function BoxWydarzenia({ wydarzenie }: { wydarzenie: Wydarzenie }) {
  const stan = stanWydarzenia(wydarzenie);
  if (stan === "minelo") return null;

  const trwa = stan === "trwa";
  const plakat = wydarzenie.zdjecie ? photoUrl(wydarzenie.zdjecie) : null;

  return (
    <section className="relative z-10 -mt-6 mb-3 overflow-hidden rounded-[26px]">
      {/* obwódka w barwach flagi jako podkład pod treścią - jeden gradient, nie dwie ramki */}
      <div
        className="p-[2px]"
        style={{
          background: `linear-gradient(135deg, #ffffff 0%, #ffffff 42%, ${CZERWIEN} 58%, #8a0614 100%)`,
          boxShadow: `0 24px 60px -28px ${CZERWIEN}`,
        }}
      >
        <div className="rounded-[24px] bg-void/92 p-5 backdrop-blur sm:p-6">
          <div
            className={`grid items-stretch gap-5 ${
              plakat ? "sm:grid-cols-[minmax(0,1fr)_minmax(190px,240px)]" : ""
            }`}
          >
            {/* ---------------------------------------------------- treść */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                  style={{ background: CZERWIEN }}
                >
                  wydarzenie
                </span>
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    borderColor: "rgb(232 17 45 / .45)",
                    color: trwa ? "#fff" : CZERWIEN,
                    background: trwa ? CZERWIEN : "transparent",
                  }}
                >
                  {plakietka(wydarzenie)}
                </span>
              </div>

              <h2 className="mt-3.5 text-[clamp(21px,3vw,30px)] font-semibold leading-[1.12] tracking-[-0.02em]">
                {wydarzenie.nazwa}
              </h2>

              {/*
                Godziny w jednym wierszu z terminem, nie w osobnym akapicie pod nim.
                „jutro 18:00-21:00" i pod spodem „godziny trwania: 18:00-21:00" to była ta
                sama informacja dwa razy - i to ona najbardziej rozdymała box.
              */}
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium">
                <ClockIcon className="h-4 w-4 shrink-0" style={{ color: CZERWIEN }} />
                <span>{kiedy(wydarzenie)}</span>
                {plakietka(wydarzenie) !== "trwa teraz" && (
                  <span className="text-[13px] font-normal text-faint">
                    {`· ${godziny(wydarzenie)}`}
                  </span>
                )}
              </p>

              {wydarzenie.opis && (
                <p className="mt-3.5 max-w-[62ch] whitespace-pre-line text-[14px] leading-relaxed text-muted">
                  {wydarzenie.opis}
                </p>
              )}
            </div>

            {/* ---------------------------------------------------- plakat */}
            {plakat && (
              <a
                href={plakat}
                target="_blank"
                rel="noreferrer"
                aria-label={`Otwórz plakat wydarzenia: ${wydarzenie.nazwa}`}
                className="group relative block min-h-[190px] overflow-hidden rounded-[16px] border border-hairline sm:min-h-[210px]"
              >
                {/*
                  Kopia rozmyta i przycięta - wypełnia kafel przy każdych proporcjach zdjęcia.
                  `aria-hidden`, bo to ta sama treść co obrazek na wierzchu.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={plakat}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
                />
                {/*
                  Plakat w całości. Pozycjonowany absolutnie - i to jest ta jedna właściwość,
                  która trzyma cały układ: obrazek nie wnosi wysokości, więc wiersz siatki
                  mierzy się samym tekstem, a nie proporcjami pliku.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={plakat}
                  alt={`Plakat wydarzenia: ${wydarzenie.nazwa}`}
                  className="absolute inset-0 h-full w-full object-contain p-2.5 transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span
                  className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "rgb(7 7 10 / .78)", backdropFilter: "blur(6px)" }}
                >
                  plakat w pełnym rozmiarze
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
