import {
  odznaczenia,
  podsumowanie,
  POZIOMY,
  type IdPoziomu,
  type StatystykiGracza,
} from "@/lib/odznaczenia";
import { Wyroznienia } from "./Wyroznienia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";
import { TloStopnia } from "./TloStopnia";

/**
 * Siatka odznaczeń na koncie właściciela.
 *
 * Trzy warstwy informacji, każda na swoim poziomie hałasu:
 *  - mała skala stopni przy nagłówku (cztery kropki, nazwy pod kursorem),
 *  - karta z jedną liczbą i barwą zdobytego stopnia,
 *  - pasek pod nią - cała droga do szczytu, z nacięciami w miejscach progów.
 *
 * Kolor pojawia się tylko tam, gdzie coś znaczy: w medalu, w obwódce karty i na pasku.
 * Reszta jest szkłem, żeby dziewięć kafelków nie zamieniło się w witraż.
 *
 * Komponent jest serwerowy i bezstanowy: liczby przychodzą z `statystyki_gracza`, stopnie
 * wylicza `lib/odznaczenia`, a dymki są czystym CSS-em (`group-hover`).
 */
export function Odznaczenia({ statystyki }: { statystyki: StatystykiGracza }) {
  const lista = odznaczenia(statystyki);
  const { zdobyte, wszystkie } = podsumowanie(statystyki);

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Odznaczenia</h2>

        {/*
          Skala stopni siedzi przy nagłówku, a nie w osobnej listwie nad siatką: to legenda,
          czyli przypis, więc ma zajmować tyle miejsca co przypis. Nazwę pokazuje dymek.
        */}
        <span className="flex items-center gap-1.5">
          {POZIOMY.map((p, i) => (
            <SkalaStopnia key={p.id} id={p.id} nazwa={p.nazwa} numer={i + 1} />
          ))}
        </span>

        <p className="ml-auto rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          zdobyte <b className="text-ink">{zdobyte}</b> z {wszystkie}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((o) => {
          const stopien = o.poziom?.id ?? null;

          return (
            <article
              key={o.id}
              className={`karta-odznaki p-5 ${stopien ? `karta-${stopien}` : "karta-bez opacity-[0.78]"}`}
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

      <Wyroznienia statystyki={statystyki} />
    </section>
  );
}

/** Kropka skali stopni przy nagłówku - nazwę i numer pokazuje dopiero dymek. */
function SkalaStopnia({
  id,
  nazwa,
  numer,
}: {
  id: IdPoziomu;
  nazwa: string;
  numer: number;
}) {
  return (
    <span className="group relative">
      {/*
        Legenda to pełna kropka w barwie stopnia, nie miniaturka emblematu: przy 18 px
        krążek z włosową obwódką był ledwo widoczny i cała skala gubiła się w nagłówku.
      */}
      <span className={`stopien-${id} kropka-stopnia kropka-stopnia-pelna block h-[9px] w-[9px] cursor-help`} />

      <span className="dymek pointer-events-none left-1/2 top-full z-20 mt-2.5 w-max -translate-x-1/2 scale-95 px-3 py-2 text-center opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100">
        <span className="block text-[12.5px] font-semibold leading-tight">{nazwa}</span>
        <span className="mt-0.5 block text-[11px] text-faint">
          stopień {numer} z {POZIOMY.length}
        </span>
      </span>
    </span>
  );
}
