import {
  odznaczenia,
  podsumowanie,
  POZIOMY,
  wyroznienia,
  type StatystykiGracza,
} from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";
import { TloStopnia } from "./TloStopnia";

/**
 * Siatka odznaczeń na profilu.
 *
 * Każdy kafelek to jedna liczba, zdobyty stopień i pasek do następnego - bez tabelek
 * i bez legendy do studiowania. Cztery kropki pod paskiem pokazują całą drogę, więc od
 * razu widać, czy do szczytu zostały trzy stopnie, czy jeden.
 *
 * Komponent jest serwerowy i bezstanowy: liczby przychodzą z `statystyki_gracza`,
 * a stopnie wylicza `lib/odznaczenia`. Ten sam kod obsługuje profil publiczny i „moje konto".
 */

export function Odznaczenia({ statystyki }: { statystyki: StatystykiGracza }) {
  const lista = odznaczenia(statystyki);
  const extra = wyroznienia(statystyki);
  const { zdobyte, wszystkie } = podsumowanie(statystyki);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Odznaczenia</h2>
        <p className="text-[13px] text-muted">
          zdobyte <b className="text-ink">{zdobyte}</b> z {wszystkie}
        </p>
      </div>

      {/* legenda stopni - raz, na górze, żeby nie powtarzać jej na każdym kafelku */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
        {POZIOMY.map((p, i) => (
          <span key={p.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/20">→</span>}
            {/* w legendzie liczy się sam stopień, więc medal pokazuje tylko jego motyw */}
            <span className={`medal medal-${p.id} h-7 w-7`}>
              <TloStopnia poziom={p.id} />
            </span>
            {p.nazwa}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((o) => (
          <article
            key={o.id}
            className={`kafel p-4 ${o.stopien > 0 ? "" : "opacity-[0.82]"}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`medal ${o.poziom ? `medal-${o.poziom.id}` : "medal-brak"} h-11 w-11`}
              >
                <TloStopnia poziom={o.poziom?.id ?? null} />
                <IkonaOdznaczenia id={o.id} className="h-[22px] w-[22px]" />
              </span>

              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{o.nazwa}</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-faint">
                  {o.poziom ? o.poziom.nazwa : "jeszcze nie zdobyte"}
                </p>
              </div>

              <p className="ml-auto flame-text pb-0.5 text-[24px] font-bold leading-none tabular-nums">
                {o.wartosc}
              </p>
            </div>

            <p className="mt-2.5 text-[12px] leading-snug text-muted">{o.opis}</p>

            {/*
              Skala z czterech odcinków - po jednym na stopień. Wypełnienie liczymy globalnie:
              odcinek `i` zapełnia się, gdy postęp minie `i/4` całej drogi. Wcześniej był jeden
              pasek z gradientem i nie dawało się z niego odczytać, ile stopni już za nami.
            */}
            <div className="mt-3 flex gap-1">
              {POZIOMY.map((p, i) => {
                const wypelnienie = Math.min(
                  1,
                  Math.max(0, o.postepPelny * POZIOMY.length - i)
                );
                return (
                  <span key={p.id} title={p.nazwa} className="pasek-tor flex-1">
                    <span
                      className={`pasek-segment pasek-${p.id}`}
                      style={{ width: `${Math.round(wypelnienie * 100)}%` }}
                    />
                  </span>
                );
              })}
            </div>

            <p className="mt-2 text-center text-[11px] text-faint">
              {o.nastepny
                ? `jeszcze ${o.nastepny.brakuje} do stopnia „${o.nastepny.poziom.nazwa}”`
                : "wszystkie stopnie zdobyte"}
            </p>
          </article>
        ))}
      </div>

      {/* wyróżnienia bez stopni - jednorazowe, więc wystarczy pastylka */}
      <div className="mt-4 flex flex-wrap gap-2">
        {extra.map((w) => (
          <span
            key={w.id}
            title={w.opis}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${
              w.zdobyte ? "wyroznienie" : "border border-hairline bg-white/[0.025] text-faint"
            }`}
          >
            <IkonaOdznaczenia id={w.id} className="h-[18px] w-[18px]" />
            {w.nazwa}
          </span>
        ))}
      </div>
    </section>
  );
}
