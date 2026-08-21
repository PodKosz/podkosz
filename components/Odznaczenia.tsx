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
 * Siatka odznaczeń na koncie właściciela.
 *
 * Trzy warstwy informacji, każda na swoim poziomie hałasu:
 *  - drabinka stopni na górze mówi, jaka jest skala (raz, nie na każdym kafelku),
 *  - karta pokazuje jedną liczbę i barwę zdobytego stopnia,
 *  - pasek pod nią - całą drogę do szczytu, z nacięciami w miejscach progów.
 *
 * Kolor pojawia się tylko tam, gdzie coś znaczy: w medalu, w narożniku karty i na pasku.
 * Reszta jest szkłem, żeby dziewięć kafelków nie zamieniło się w witraż.
 *
 * Komponent jest serwerowy i bezstanowy: liczby przychodzą z `statystyki_gracza`,
 * a stopnie wylicza `lib/odznaczenia`.
 */
export function Odznaczenia({ statystyki }: { statystyki: StatystykiGracza }) {
  const lista = odznaczenia(statystyki);
  const extra = wyroznienia(statystyki);
  const { zdobyte, wszystkie } = podsumowanie(statystyki);

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Odznaczenia</h2>
        <p className="rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          zdobyte <b className="text-ink">{zdobyte}</b> z {wszystkie}
        </p>
      </div>

      {/* drabinka stopni - skala wyjaśniona raz, na górze */}
      <div className="drabina mt-4 overflow-x-auto">
        {POZIOMY.map((p) => (
          <span key={p.id} className="drabina-stopien">
            <span className={`medal medal-${p.id} h-8 w-8`}>
              <TloStopnia poziom={p.id} />
            </span>
            <span className="whitespace-nowrap">{p.nazwa}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((o) => {
          const stopien = o.poziom?.id ?? null;

          return (
            <article
              key={o.id}
              className={`karta-odznaki p-5 ${stopien ? `karta-${stopien}` : "opacity-[0.72]"}`}
            >
              <div className="flex items-center gap-3.5">
                <span className={`medal ${stopien ? `medal-${stopien}` : "medal-brak"} h-12 w-12`}>
                  <TloStopnia poziom={stopien} />
                  <IkonaOdznaczenia id={o.id} className="h-[23px] w-[23px]" />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">
                    {o.nazwa}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-faint">
                    {o.poziom ? o.poziom.nazwa : "bez stopnia"}
                  </p>
                </div>

                <p className="ml-auto pb-0.5 text-right text-[28px] font-semibold leading-none tabular-nums text-ink">
                  {o.wartosc}
                  <span className="mt-1 block text-[10px] font-normal uppercase tracking-[0.12em] text-faint">
                    {o.licznik}
                  </span>
                </p>
              </div>

              <p className="mt-4 text-[12.5px] leading-snug text-muted">{o.opis}</p>

              {/*
                Wypełnienie i gradient dostają tę samą wartość: `--p` przesuwa też
                `background-size`, dzięki czemu barwa na końcu paska odpowiada wysokości
                zdobytego stopnia, a nie długości widocznego kawałka.
              */}
              <div className="tor mt-4">
                <span
                  className="tor-wypelnienie"
                  style={{
                    width: `${Math.round(o.postepPelny * 100)}%`,
                    ["--p" as string]: Math.max(o.postepPelny, 0.02).toFixed(3),
                  }}
                />
              </div>

              <p className="mt-2.5 text-[11.5px] text-faint">
                {o.nastepny
                  ? `jeszcze ${o.nastepny.brakuje} do stopnia „${o.nastepny.poziom.nazwa}”`
                  : "wszystkie stopnie zdobyte"}
              </p>
            </article>
          );
        })}
      </div>

      {/* wyróżnienia bez stopni - jednorazowe, więc wystarczy pastylka */}
      <div className="mt-4 flex flex-wrap gap-2">
        {extra.map((w) => (
          <span
            key={w.id}
            title={w.opis}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${
              w.zdobyte ? "wyroznienie" : "border border-hairline bg-white/[0.02] text-faint"
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
