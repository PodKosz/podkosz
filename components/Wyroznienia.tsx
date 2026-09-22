import { wyroznienia, type StatystykiGracza } from "@/lib/odznaczenia";
import { StojakWyroznien } from "./StojakWyroznien";

/**
 * Wyróżnienia - odznaczenia bez stopni.
 *
 * Świadomie wyglądają inaczej niż odznaczenia progowe. Tam cztery stopnie mówią, jak
 * wysoko ktoś zaszedł; tutaj nie ma czego mierzyć - albo się ma, albo nie - więc każde ma
 * własną barwę przypisaną na stałe, jednakową dla wszystkich, którzy je zdobyli.
 *
 * Całą siedemnastkę pokazuje stojak z piłkami (`StojakWyroznien`). Zdobyte leżą na nim
 * w swoich barwach, niezdobyte jako wygaszone grafitowe piłki - więc widać naraz i to,
 * co ktoś ma, i ile zostało, bez rozwijania czegokolwiek. Wcześniej stała tu siatka
 * stempli, w której niezdobyte chowały się za przyciskiem „pokaż pozostałe".
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

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">{tytul}</h2>

        <p className="ml-auto rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          zdobyte <b className="text-ink">{zdobyte.length}</b> z {lista.length}
        </p>
      </div>

      <StojakWyroznien lista={lista} />
    </section>
  );
}
