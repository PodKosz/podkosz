import { odznaczenia, wyroznienia, type StatystykiGracza } from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";
import { TloStopnia } from "./TloStopnia";

/**
 * Rząd plakietek „za zasługi" pod nickiem na publicznym profilu.
 *
 * Pokazujemy tylko to, co ktoś naprawdę zdobył - profil ma być wizytówką, nie listą
 * zadań do odhaczenia (tę widzi właściciel na swoim koncie). Po najechaniu wysuwa się
 * dymek z dokładną liczbą w danej kategorii.
 *
 * Dymek jest czystym CSS-em (`group-hover` i `focus-within`), więc komponent zostaje
 * serwerowy - żadnego JavaScriptu po stronie przeglądarki.
 */
export function PlakietkiZaslug({ statystyki }: { statystyki: StatystykiGracza }) {
  const progowe = odznaczenia(statystyki).filter((o) => o.poziom !== null);
  const extra = wyroznienia(statystyki).filter((w) => w.zdobyte);

  if (!progowe.length && !extra.length) {
    return (
      <p className="mt-5 text-[13px] text-faint">
        Jeszcze bez odznaczeń - pierwsze dodane boisko od razu daje stopień „Iskra”.
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
      {progowe.map((o) => (
        <Plakietka
          key={o.id}
          id={o.id}
          poziom={o.poziom?.id ?? null}
          tytul={o.nazwa}
          stopien={o.poziom?.nazwa ?? ""}
          opis={`${o.wartosc} ${o.licznik}`}
          dalej={
            o.nastepny
              ? `jeszcze ${o.nastepny.brakuje} do stopnia „${o.nastepny.poziom.nazwa}”`
              : "wszystkie stopnie zdobyte"
          }
        />
      ))}

      {extra.map((w) => (
        <Plakietka
          key={w.id}
          id={w.id}
          poziom="plomien"
          tytul={w.nazwa}
          stopien="wyróżnienie"
          opis={w.opis}
        />
      ))}
    </div>
  );
}

function Plakietka({
  id,
  poziom,
  tytul,
  stopien,
  opis,
  dalej,
}: {
  id: string;
  poziom: "iskra" | "zar" | "plomien" | "bialy-zar" | null;
  tytul: string;
  stopien: string;
  opis: string;
  dalej?: string;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={`${tytul} - ${opis}`}
        className={`medal ${poziom ? `medal-${poziom}` : "medal-brak"} h-12 w-12 cursor-help transition-transform duration-200 group-hover:-translate-y-0.5`}
      >
        <TloStopnia poziom={poziom} />
        <IkonaOdznaczenia id={id} className="h-[23px] w-[23px]" />
      </button>

      {/* dymek: wychodzi w górę, wyśrodkowany na plakietce, nieklikalny */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-max max-w-[220px] -translate-x-1/2 scale-95 rounded-2xl px-3.5 py-2.5 text-left opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 szklo-pro">
        <span className="block text-[13px] font-semibold leading-tight">{tytul}</span>
        <span className="mt-0.5 block text-[11px] uppercase tracking-[0.12em] text-flame">
          {stopien}
        </span>
        <span className="mt-1.5 block text-[13px] text-ink">{opis}</span>
        {dalej && <span className="mt-0.5 block text-[11px] text-faint">{dalej}</span>}
      </span>
    </span>
  );
}
