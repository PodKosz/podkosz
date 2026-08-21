import {
  odznaczenia,
  podsumowanie,
  POZIOMY,
  wyroznienia,
  type IdPoziomu,
  type StatystykiGracza,
} from "@/lib/odznaczenia";

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

/* Kolory płomyka na medalu - od przygaszonej iskry do bieli rozgrzanego metalu. */
const PLOMYK: Record<IdPoziomu, [string, string, string]> = {
  iskra: ["#7a3f16", "#c2703a", "#e8b184"],
  zar: ["#a12c05", "#ff6a12", "#ffb066"],
  plomien: ["#ff3d00", "#ff7a18", "#ffd08a"],
  "bialy-zar": ["#ff8a3d", "#ffe9c9", "#ffffff"],
};

function Plomyk({ poziom, uid }: { poziom: IdPoziomu | null; uid: string }) {
  const stops = poziom ? PLOMYK[poziom] : ["#3a3a42", "#4c4c56", "#6a6a76"];
  const id = `plomyk-${uid}`;

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0.35" y2="0">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.55" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <path
        d="M12 1.4c.5 2.2-.4 3.6-1.7 4.8-1.6 1.5-2.4 2.6-2.2 4.1.1.8.5 1.4.5 1.4s-1.4-.2-2-1.4c-1.3 1.6-1.7 3.2-1.7 4.6C4.9 19.6 8.1 22.6 12 22.6s7.1-3 7.1-7.7c0-4.6-3.2-6.6-4.4-9.1-.7-1.5-.9-3.1-2.7-4.4Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

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
            <span className={`medal medal-${p.id} h-6 w-6`}>
              <Plomyk poziom={p.id} uid={`legenda-${p.id}`} />
            </span>
            {p.nazwa}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((o) => (
          <article
            key={o.id}
            className={`rounded-[22px] border p-4 ${
              o.stopien > 0 ? "glass" : "border-hairline bg-white/[0.025]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`medal ${o.poziom ? `medal-${o.poziom.id}` : "medal-brak"} h-11 w-11`}
              >
                <Plomyk poziom={o.poziom?.id ?? null} uid={o.id} />
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

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <span
                className="block h-full rounded-full flame-gradient"
                style={{ width: `${Math.round(o.postep * 100)}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-faint">
                {o.nastepny
                  ? `jeszcze ${o.nastepny.brakuje} do stopnia „${o.nastepny.poziom.nazwa}”`
                  : "wszystkie stopnie zdobyte"}
              </p>
              <span className="flex shrink-0 gap-1">
                {POZIOMY.map((p, i) => (
                  <span
                    key={p.id}
                    title={p.nazwa}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < o.stopien ? `pip pip-${p.id}` : "bg-white/14"
                    }`}
                  />
                ))}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* wyróżnienia bez stopni - jednorazowe, więc wystarczy pastylka */}
      <div className="mt-4 flex flex-wrap gap-2">
        {extra.map((w) => (
          <span
            key={w.id}
            title={w.opis}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold ${
              w.zdobyte
                ? "medal-plomien text-ink"
                : "border border-hairline bg-white/[0.025] text-faint"
            }`}
          >
            <Plomyk poziom={w.zdobyte ? "plomien" : null} uid={`w-${w.id}`} />
            {w.nazwa}
          </span>
        ))}
      </div>
    </section>
  );
}
