import { wyroznienia, type Wyroznienie, type StatystykiGracza } from "@/lib/odznaczenia";
import { plural } from "@/lib/site";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";

/**
 * Wyróżnienia - odznaczenia bez stopni.
 *
 * Świadomie wyglądają inaczej niż odznaczenia progowe. Tam cztery kropki mówią, na którym
 * stopniu ktoś jest; tutaj nie ma czego mierzyć, więc kropek nie ma, a każda odznaka ma
 * własną barwę przypisaną na stałe - jednakową dla wszystkich, którzy ją zdobyli.
 *
 * Sekcja jest wyłącznie na własnym koncie. Na publicznym profilu zdobyte krążą wokół
 * zdjęcia (patrz WyroznieniaLatajace), a lista „czego jeszcze nie mam" to zadanie do
 * odhaczenia - sprawa właściciela, nie odwiedzającego.
 *
 * Domyślnie widać tylko zdobyte; reszta pokazuje się po rozwinięciu, z kreskowaną obwódką
 * i warunkiem zdobycia w dymku. Rozwijanie robi `details`/`summary`, więc komponent
 * zostaje serwerowy: żadnego JavaScriptu po stronie przeglądarki.
 */
export function Wyroznienia({
  statystyki,
  tytul = "Wyróżnienia",
}: {
  statystyki: StatystykiGracza;
  tytul?: string;
}) {
  const lista = wyroznienia(statystyki);
  const zdobyte = lista.filter((w) => w.zdobyte);
  const reszta = lista.filter((w) => !w.zdobyte);

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">{tytul}</h2>

        <p className="ml-auto rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          zdobyte <b className="text-ink">{zdobyte.length}</b> z {lista.length}
        </p>
      </div>

      {zdobyte.length > 0 && (
        <div className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8">
          {zdobyte.map((w) => (
            <Stempel key={w.id} w={w} />
          ))}
        </div>
      )}

      {zdobyte.length === 0 && (
        <p className="mt-4 text-[13px] text-faint">
          Jeszcze żadnego wyróżnienia - są za jednorazowe wyczyny, nie za liczby.
        </p>
      )}

      {reszta.length > 0 && (
        <details className="rozwin mt-4">
          <summary className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] transition hover:text-ink">
            <span className="rozwin-pokaz">
              pokaż {reszta.length}{" "}
              {plural(reszta.length, ["pozostałe", "pozostałe", "pozostałych"])} do zdobycia
            </span>
            <span className="rozwin-zwin">zwiń</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="rozwin-strzalka h-3.5 w-3.5 transition-transform duration-200"
            >
              <path d="M6 9.5l6 6 6-6" />
            </svg>
          </summary>

          <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8">
            {reszta.map((w) => (
              <Stempel key={w.id} w={w} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Stempel({ w }: { w: Wyroznienie }) {
  return (
    /* barwa siedzi na wrapperze, żeby zmienną `--b` widział też dymek */
    <div className={`group relative barwa-${w.barwa}`}>
      <div className={`stempel ${w.zdobyte ? "stempel-zdobyty" : "stempel-brak"}`}>
        <span className="stempel-krazek">
          <IkonaOdznaczenia id={w.id} className="stempel-ikona h-[19px] w-[19px]" />
        </span>

        <span
          className={`text-[10.5px] font-medium leading-tight ${
            w.zdobyte ? "text-ink" : "text-faint"
          }`}
        >
          {w.nazwa}
        </span>
      </div>

      {/*
        Dymek zamiast podpisu pod nazwą: przy szesnastu stemplach opisy zrobiłyby z siatki
        ścianę tekstu. Otwiera się w dół, jak przy odznaczeniach pod nickiem.
      */}
      <span className="dymek pointer-events-none left-1/2 top-full z-20 mt-2.5 w-max max-w-[240px] -translate-x-1/2 scale-95 px-4 py-3 text-left opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">
        <span className="block text-[13px] font-semibold leading-tight">{w.nazwa}</span>
        <span className="mt-1 block text-[12.5px] leading-snug text-muted">
          {w.zdobyte ? w.opis : w.warunek}
        </span>
        <span
          className={`mt-1.5 block text-[11px] uppercase tracking-[0.12em] ${
            w.zdobyte ? "text-ink" : "text-faint"
          }`}
          style={w.zdobyte ? { color: "rgb(var(--b))" } : undefined}
        >
          {w.zdobyte ? "zdobyte" : "jeszcze nie zdobyte"}
        </span>
      </span>
    </div>
  );
}
