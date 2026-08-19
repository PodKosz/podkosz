import { WeatherHour, playableHours, weatherVerdict } from "@/lib/pogoda";

/**
 * Pasek pogody na karcie boiska odkrytego. Renderowany na serwerze - prognoza jest
 * wspólna dla wszystkich odwiedzających, więc nie ma po co pytać z przeglądarki.
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

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {wybrane.map((h) => (
          <div
            key={h.hour}
            className={`rounded-2xl border p-3 text-center ${
              h.rain >= 0.2 ? "border-hairline bg-white/4" : "border-flame/25 bg-flame/8"
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-faint">
              {String(h.hour).padStart(2, "0")}:00
            </p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums">{h.temp}°</p>
            <p className="text-[11px] text-muted">
              {h.rain >= 0.2 ? `${h.rain.toFixed(1)} mm` : "bez opadów"}
            </p>
            <p className="text-[11px] text-faint">{h.wind} km/h</p>
          </div>
        ))}
      </div>
    </section>
  );
}
