import { odznaczenia, POZIOMY, type StatystykiGracza } from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";
import { TloStopnia } from "./TloStopnia";

/**
 * Odznaczenia progowe pod nickiem na publicznym profilu.
 *
 * Pokazujemy tylko zdobyte stopnie - profil ma być wizytówką, nie listą zadań do
 * odhaczenia (tę widzi właściciel na swoim koncie). Wyróżnienia mają niżej własną sekcję,
 * więc nie powtarzamy ich tutaj.
 *
 * Kafelek jest ten sam co w sekcji wyróżnień, bo to ma być jedna rodzina znaków. Różnica
 * jest w tym, co dokładają odznaczenia progowe: ogień podnoszący się od dołu, którego
 * wysokość to droga do najwyższego stopnia, a barwa na jego czubku mówi, jak wysoko już
 * jest - od ciemnej czerwieni po błękit na szczycie.
 *
 * Dymek jest czystym CSS-em (`group-hover` i `focus-within`), więc komponent zostaje
 * serwerowy - żadnego JavaScriptu po stronie przeglądarki.
 */
export function PlakietkiZaslug({ statystyki }: { statystyki: StatystykiGracza }) {
  const progowe = odznaczenia(statystyki).filter((o) => o.poziom !== null);

  if (!progowe.length) {
    return (
      <p className="mt-5 text-[13px] text-faint">
        Jeszcze bez odznaczeń - pierwsze dodane boisko od razu daje stopień „Iskra”.
      </p>
    );
  }

  return (
    /*
      Kafelki mają tę samą szerokość co w siatce wyróżnień niżej, ale układ jest flexowy,
      a nie gridowy: zdobytych stopni bywa mniej niż kolumn, a niepełny rząd w gridzie
      przykleiłby się do lewej krawędzi pod wyśrodkowaną wizytówką.
    */
    <div className="mt-7 flex w-full flex-wrap justify-center gap-2.5">
      {progowe.map((o) => (
        <div
          key={o.id}
          className={`group relative w-[calc((100%-1.875rem)/4)] sm:w-[calc((100%-3.125rem)/6)] lg:w-[calc((100%-4.375rem)/8)] stopien-${o.poziom!.id}`}
        >
          <div className="stempel stempel-zdobyty stempel-ogien">
            {/*
              Ogień pod treścią, nie za nią: wysokość to `postepPelny`, czyli cała droga
              do szczytu razem z kawałkiem przebytym w obrębie obecnego stopnia. Dzięki
              temu kafelek rośnie także wtedy, gdy do kolejnego progu jeszcze daleko.
            */}
            <span
              className="plomien-tla"
              style={{ ["--w" as string]: Math.max(o.postepPelny, 0.06).toFixed(3) }}
            />

            <span className="medal h-[38px] w-[38px]">
              <TloStopnia poziom={o.poziom!.id} />
              <IkonaOdznaczenia id={o.id} />
            </span>

            <span className="nazwa-odznaki text-[10.5px] font-medium leading-tight text-ink">
              {o.nazwa}
            </span>

          </div>

          {/*
            Dymek ma własną klasę `dymek`, a nie `szklo-pro`: tamta ustawia `position:
            relative` i `overflow: hidden` oraz dokłada skośną smugę w `::after` - w dymku
            wypychało to tekst poza kartę i pokazywało smugę jako dziwny kleks.

            Wychodzi w dół, nie w górę: nad plakietkami stoi nick, a dymek go zasłaniał.
          */}
          <span className="dymek pointer-events-none left-1/2 top-full z-20 mt-2.5 w-max max-w-[230px] -translate-x-1/2 scale-95 px-4 py-3 text-left opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">
            <span className="block text-[13px] font-semibold leading-tight">{o.nazwa}</span>
            <span
              className="mt-0.5 block text-[11px] uppercase tracking-[0.12em]"
              style={{ color: "rgb(var(--b))" }}
            >
              {o.poziom!.nazwa} - stopień {o.stopien} z {POZIOMY.length}
            </span>
            <span className="mt-1.5 block text-[13px] text-ink">
              {o.wartosc} {o.licznik}
            </span>
            <span className="mt-0.5 block text-[11px] text-faint">
              {o.nastepny
                ? `jeszcze ${o.nastepny.brakuje} do stopnia „${o.nastepny.poziom.nazwa}”`
                : "wszystkie stopnie zdobyte"}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
