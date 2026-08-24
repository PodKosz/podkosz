import { wyroznienia, type StatystykiGracza } from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";

/**
 * Wyróżnienia - odznaczenia bez stopni.
 *
 * Świadomie wyglądają inaczej niż kafelki odznaczeń progowych. Tam kolor medalu i pasek
 * mówią „na jakim jesteś stopniu"; tutaj nie ma czego mierzyć, więc pasek byłby kłamstwem,
 * a paleta ognia sugerowałaby skalę, której nie ma. Zamiast tego jest stempel: kwadrat
 * z obwódką, jedna barwa przypisana na stałe do odznaki i nic poza ikoną i nazwą.
 *
 * Niezdobyte zostają widoczne - z kreskowaną obwódką i przygaszoną ikoną. Pusty stempel
 * jest zaproszeniem, a lista, na której widać tylko zdobyte, nie mówi, czego szukać.
 * Zdobyte idą pierwsze, żeby profil nie zaczynał się od rzędu pustych pól.
 */
export function Wyroznienia({
  statystyki,
  tytul = "Wyróżnienia",
}: {
  statystyki: StatystykiGracza;
  tytul?: string;
}) {
  const lista = wyroznienia(statystyki);
  const zdobyte = lista.filter((w) => w.zdobyte).length;

  /* sort jest stabilny, więc w obu grupach zostaje kolejność z lib/odznaczenia */
  const posortowane = [...lista].sort((a, b) => Number(b.zdobyte) - Number(a.zdobyte));

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">{tytul}</h2>
        <p className="text-[12px] text-faint">bez stopni - albo je masz, albo nie</p>

        <p className="ml-auto rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          zdobyte <b className="text-ink">{zdobyte}</b> z {lista.length}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {posortowane.map((w) => (
          /* barwa siedzi na wrapperze, żeby zmienną `--b` widział też dymek */
          <div key={w.id} className={`group relative barwa-${w.barwa}`}>
            <div className={`stempel ${w.zdobyte ? "stempel-zdobyty" : "stempel-brak"}`}>
              <span className="stempel-krazek">
                <IkonaOdznaczenia id={w.id} className="stempel-ikona h-[22px] w-[22px]" />
              </span>

              <span
                className={`text-[11.5px] font-medium leading-tight ${
                  w.zdobyte ? "text-ink" : "text-faint"
                }`}
              >
                {w.nazwa}
              </span>
            </div>

            {/*
              Dymek zamiast podpisu pod nazwą: przy szesnastu stemplach opisy zrobiłyby
              z siatki ścianę tekstu. Otwiera się w dół, jak przy plakietkach w rankingu.
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
                style={w.zdobyte ? { color: `rgb(var(--b))` } : undefined}
              >
                {w.zdobyte ? "zdobyte" : "jeszcze nie zdobyte"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
