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
 * Kolejność treści jest odpowiedzią na pytania w kolejności, w jakiej się je zadaje:
 * co (nazwa), kiedy (dzień i godziny), gdzie już wiadomo - to ta strona - i dopiero potem
 * po co (opis). Plakat, jeśli jest, stoi obok, a nie nad tekstem: na telefonie zdjęcie nad
 * treścią zjadłoby cały pierwszy ekran i „kiedy" trafiłoby pod zagięcie.
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
        <div className="rounded-[24px] bg-void/92 backdrop-blur">
          <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="p-6 sm:p-7">
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

              <h2 className="mt-4 text-[clamp(22px,3.4vw,32px)] font-semibold leading-[1.1] tracking-[-0.02em]">
                {wydarzenie.nazwa}
              </h2>

              <p className="mt-3 flex items-center gap-2 text-[15px] font-medium">
                <ClockIcon className="h-4 w-4 shrink-0" style={{ color: CZERWIEN }} />
                <span>{kiedy(wydarzenie)}</span>
              </p>
              <p className="mt-1 text-[13px] text-faint">{`godziny trwania: ${godziny(wydarzenie)}`}</p>

              {wydarzenie.opis && (
                <p className="mt-5 max-w-[62ch] whitespace-pre-line text-[14px] leading-relaxed text-muted">
                  {wydarzenie.opis}
                </p>
              )}
            </div>

            {plakat && (
              <div className="relative min-h-[180px] sm:min-h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={plakat}
                  alt={`Plakat wydarzenia: ${wydarzenie.nazwa}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/*
                  Zdjęcie wchodzi w treść od lewej - bez tego przejścia plakat kończy się
                  ostrą krawędzią w środku boxu i wygląda jak wklejka z innego układu.
                */}
                <div className="absolute inset-0 bg-gradient-to-r from-void/95 via-void/25 to-transparent sm:from-void/90" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
