import { odznaczenia, POZIOMY, type StatystykiGracza } from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";

/**
 * Odznaczenia progowe pod nickiem na publicznym profilu.
 *
 * Pokazujemy tylko zdobyte stopnie - profil ma być wizytówką, nie listą zadań do
 * odhaczenia (tę widzi właściciel na swoim koncie). Wyróżnienia mają niżej własną sekcję,
 * więc nie powtarzamy ich tutaj.
 *
 * Stopień pokazuje piłka do koszykówki z płynnego szkła, a to, co się w niej pali, mówi
 * jak wysoko: złote iskry, ciemny żar, płomień i błękitny ogień na szczycie. Piłka stoi
 * bez kafelka - szklana kula jest już przedmiotem sama w sobie, a obwódka dookoła tylko
 * ją zamykała i robiła z rzędu odznaczeń rząd pudełek.
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
    /* układ flexowy, nie gridowy: zdobytych stopni bywa mniej niż kolumn, a niepełny rząd
       w gridzie przykleiłby się do lewej krawędzi pod wyśrodkowaną wizytówką */
    <div className="mt-9 flex w-full flex-wrap justify-center gap-x-7 gap-y-7">
      {progowe.map((o) => (
        <div
          key={o.id}
          className={`odznaka group relative flex w-[96px] flex-col items-center stopien-${o.poziom!.id}`}
        >
          <span className="odznaka-pilka medal h-[76px] w-[76px]">
            <IkonaOdznaczenia id={o.id} />
          </span>

          <span className="mt-3 text-center text-[11px] font-medium leading-tight text-ink">
            {o.nazwa}
          </span>

          {/*
            Postęp w cienkiej linii pod nazwą: `postepPelny` to cała droga do najwyższego
            stopnia razem z kawałkiem przebytym w obrębie obecnego, więc pasek rośnie także
            wtedy, gdy do kolejnego progu jeszcze daleko.
          */}
          <span className="pasek-stopnia mt-2.5">
            <span
              style={{
                width: `${Math.round(o.postepPelny * 100)}%`,
                ["--w" as string]: Math.max(o.postepPelny, 0.04).toFixed(3),
              }}
            />
          </span>

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
