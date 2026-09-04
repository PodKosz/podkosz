import { SCENE_LABEL, WeatherHour, playableHours, weatherScene, weatherVerdict } from "@/lib/pogoda";
import { WeatherArt } from "./WeatherArt";

/**
 * Pasek pogody na karcie boiska odkrytego. Renderowany na serwerze - prognoza jest
 * wspólna dla wszystkich odwiedzających, więc nie ma po co pytać z przeglądarki.
 *
 * Każda godzina to mały obrazek stanu nieba, a liczby leżą na nim. Dzięki temu pogodę
 * czyta się jednym spojrzeniem, bez porównywania cyfr.
 */
export function Pogoda({ hours, nowHour }: { hours: WeatherHour[]; nowHour: number }) {
  const wybrane = playableHours(hours, nowHour);
  if (!wybrane.length) return null;

  const ocena = weatherVerdict(wybrane);

  return (
    <section className="glass mt-4 rounded-[24px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Pogoda na dziś</h2>
        <p className="text-[13px] text-muted">{ocena}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {wybrane.map((h, i) => {
          const scene = weatherScene(h.code);
          return (
            <div
              key={h.hour}
              className="relative overflow-hidden rounded-2xl border border-hairline"
            >
              {/* grafika stanu nieba wypełnia kafelek */}
              <div className="absolute inset-0">
                <WeatherArt scene={scene} day={h.day} seed={i + h.hour} />
              </div>
              {/* przygaszenie pod tekstem: mocne u dołu, żeby liczby były czytelne na każdej scenie */}
              <div className="absolute inset-0 bg-gradient-to-t from-void/92 via-void/45 to-void/10" />

              <div className="relative flex h-[176px] flex-col justify-between p-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-kadr/70">
                  {String(h.hour).padStart(2, "0")}:00
                </p>

                <div>
                  <p
                    className="text-[30px] font-semibold leading-none tabular-nums"
                    style={{ textShadow: "0 2px 12px rgba(0,0,0,.8)" }}
                  >
                    {h.temp}°
                  </p>
                  <p className="mt-1.5 text-[11px] leading-tight text-kadr/80">
                    {SCENE_LABEL[scene]}
                  </p>
                  <p className="mt-1 text-[10px] leading-tight text-kadr/55">
                    {h.rain >= 0.2 ? `${h.rain.toFixed(1)} mm` : "bez opadów"} · {h.wind} km/h
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
