import Link from "next/link";
import type { KadrOdkrywcy, OdkrywcaRanking } from "@/lib/repo";
import { plural } from "@/lib/site";
import { CourtPhoto } from "@/components/CourtPhoto";
import { IkonaOdznaczenia } from "@/components/IkonaOdznaczenia";
import { FireBallIcon } from "@/components/icons";

/**
 * Ranking graczy - ludzie, którzy dodali boiska.
 *
 * Ranking boisk pokazuje miejsca, więc jego walutą jest zdjęcie. Tutaj walutą jest osoba -
 * ale to nie znaczy, że zdjęcia znikają. Karta ma w TLE kadry jej własnych boisk: to
 * najkrótsza możliwa odpowiedź na pytanie, kto to jest. Nie liczba, nie opis, tylko
 * miejsca, które ta osoba wniosła do serwisu. Na wierzchu zostaje twarz i dwie liczby.
 *
 * Poziomy odpowiadają jeden do jednego rankingowi boisk, żeby obie strony czytały się jak
 * jedna rzecz: zwycięzca na całą szerokość, potem trójka w rzędzie, potem sześć kart
 * (dwa pełne rzędy po trzy), na końcu włosowe wiersze. Podział 1 + 3 + 6 jest wyborem
 * arytmetycznym: przy trzech kolumnach każdy rząd wychodzi pełny, bez osieroconej karty
 * w ostatnim. Puste miejsca zostają w układzie jako przerywane kształty - ranking
 * z trzema osobami wygląda na porzucony, a ranking z trzema osobami i dwudziestoma dwoma
 * wolnymi miejscami wygląda na zaproszenie.
 */

const SIATKA_DO = 10;
const LISTA_DO = 25;

export function RankingGraczy({ odkrywcy }: { odkrywcy: OdkrywcaRanking[] }) {
  const [pierwszy, ...reszta] = odkrywcy;
  const trojka = reszta.slice(0, 3);
  const siatka = odkrywcy.slice(4, SIATKA_DO);
  const lista = odkrywcy.slice(SIATKA_DO, LISTA_DO);
  /* trójka i siatka mogą być niepełne - dopisujemy puste miejsca, żeby rzędy się domykały */
  const wolneWTrojce = Math.max(0, 3 - trojka.length);
  const wolneWSiatce = Math.max(0, SIATKA_DO - 4 - siatka.length);
  const wolneWLiscie = Math.max(0, LISTA_DO - Math.max(odkrywcy.length, SIATKA_DO));

  if (!pierwszy) {
    return (
      <p className="szklo-pro rounded-[28px] p-10 text-center text-[15px] text-muted">
        Nikt jeszcze nie dodał boiska. Pierwsze miejsce stoi wolne.
      </p>
    );
  }

  return (
    <div className="space-y-24">
      <section className="wjazd">
        <KartaGracza odkrywca={pierwszy} miejsce={1} wariant="zwyciezca" />
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {trojka.map((o, i) => (
          <div key={o.slug} className="wjazd">
            <KartaGracza odkrywca={o} miejsce={i + 2} wariant="trojka" />
          </div>
        ))}
        {Array.from({ length: wolneWTrojce }, (_, i) => (
          <div key={`wolna-trio-${i}`} className="wjazd">
            <WolnaKarta miejsce={2 + trojka.length + i} duza />
          </div>
        ))}
      </section>

      <section>
        <Naglowek tytul="Goniący" opis={`Miejsca 5-${SIATKA_DO}`} />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {siatka.map((o, i) => (
            <div key={o.slug} className="wjazd">
              <KartaGracza odkrywca={o} miejsce={i + 5} />
            </div>
          ))}
          {Array.from({ length: wolneWSiatce }, (_, i) => (
            <div key={`wolna-${i}`} className="wjazd">
              <WolnaKarta miejsce={5 + siatka.length + i} />
            </div>
          ))}
        </div>
      </section>

      {(lista.length > 0 || wolneWLiscie > 0) && (
        <section>
          <Naglowek tytul="W stawce" opis={`Miejsca ${SIATKA_DO + 1}-${LISTA_DO}`} />
          <ol className="mt-6 grid xl:grid-cols-2 xl:gap-x-12">
            {lista.map((o, i) => (
              <WierszGracza key={o.slug} odkrywca={o} miejsce={SIATKA_DO + 1 + i} />
            ))}
            {Array.from({ length: wolneWLiscie }, (_, i) => (
              <WolneMiejsce key={`wolne-${i}`} miejsce={SIATKA_DO + lista.length + 1 + i} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Naglowek({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className="wjazd-boczny flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-4">
      <h2 className="text-[clamp(20px,2.2vw,28px)] font-semibold tracking-[-0.02em]">{tytul}</h2>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">{opis}</p>
    </div>
  );
}

/**
 * Mozaika kadrów w tle karty.
 *
 * Liczba zdjęć decyduje o podziale: jedno wypełnia całość, dwa dzielą kadr na pół, trzy
 * dają szeroki plus dwa węższe, cztery - siatkę dwa na dwa. Bez tego przy jednym zdjęciu
 * zostawałyby trzy puste prostokąty, a przy czterech powstałby pasek cienkich słupków.
 *
 * Wygaszenie i odbarwienie robi CSS (`.mozaika-gracza`), tu jest tylko geometria.
 */
function Mozaika({ kadry, sizes }: { kadry: KadrOdkrywcy[]; sizes: string }) {
  if (!kadry.length) return null;

  const uklad =
    kadry.length === 1
      ? "grid-cols-1"
      : kadry.length === 2
        ? "grid-cols-2"
        : kadry.length === 3
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-2 grid-rows-2";

  return (
    <span aria-hidden className={`mozaika-gracza grid ${uklad}`}>
      {kadry.map((k, i) => (
        <span
          key={k.slug}
          className={`relative block overflow-hidden ${
            kadry.length === 3 && i === 0 ? "row-span-2" : ""
          }`}
        >
          <CourtPhoto photo={k.photo} seed={k.seed} sizes={sizes} />
        </span>
      ))}
    </span>
  );
}

/**
 * Karta gracza - kadry jej boisk w tle, twarz i liczby na wierzchu.
 *
 * Wariant zmienia wysokość i skalę pisma, nie kompozycję. Treść jest wyśrodkowana w pionie,
 * a nie przyklejona do dołu jak w rankingu boisk: tam dolna krawędź jest naturalnym
 * miejscem podpisu pod zdjęciem, tu środek jest naturalnym miejscem dla portretu.
 */
function KartaGracza({
  odkrywca,
  miejsce,
  wariant = "siatka",
}: {
  odkrywca: OdkrywcaRanking;
  miejsce: number;
  wariant?: "zwyciezca" | "trojka" | "siatka";
}) {
  const zwyciezca = wariant === "zwyciezca";
  const trojka = wariant === "trojka";
  const kadry = odkrywca.kadry.slice(0, zwyciezca ? 4 : trojka ? 3 : 2);

  const wysokosc = zwyciezca
    ? "clamp(380px, 42vw, 620px)"
    : trojka
      ? "clamp(300px, 29vw, 440px)"
      : "clamp(240px, 21vw, 320px)";

  return (
    <Link
      href={`/gracz/${odkrywca.slug}`}
      className="karta-rankingu szklo-pro group relative flex overflow-hidden rounded-[28px]"
      style={{ height: wysokosc }}
    >
      <Mozaika
        kadry={kadry}
        sizes={zwyciezca ? "(min-width: 1600px) 800px, 50vw" : "(min-width: 1024px) 18vw, 50vw"}
      />
      <span aria-hidden className="mozaika-szyba" />
      <span aria-hidden className="karta-rankingu-blysk" />

      <span
        aria-hidden
        className={`numer-rankingu pointer-events-none absolute right-5 top-2 z-[2] font-bold leading-none tabular-nums ${
          zwyciezca
            ? "text-[clamp(76px,9vw,150px)]"
            : trojka
              ? "text-[clamp(54px,5.5vw,92px)]"
              : "numer-rankingu-maly text-[clamp(40px,4vw,64px)]"
        }`}
      >
        {String(miejsce).padStart(2, "0")}
      </span>

      <span className="relative z-[2] flex w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <span
          className={`avatar-rankingu relative grid place-items-center overflow-hidden rounded-full ${
            zwyciezca
              ? "h-[clamp(104px,11vw,168px)] w-[clamp(104px,11vw,168px)]"
              : trojka
                ? "h-[clamp(80px,7.5vw,110px)] w-[clamp(80px,7.5vw,110px)]"
                : "h-[70px] w-[70px]"
          }`}
        >
          {odkrywca.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={odkrywca.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flame-gradient grid h-full w-full place-items-center text-[26px] font-bold text-black">
              {odkrywca.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>

        <span className="block max-w-full">
          <span
            className={`block truncate font-semibold leading-[1.05] tracking-[-0.025em] transition-colors group-hover:text-glow ${
              zwyciezca
                ? "text-[clamp(24px,3vw,44px)]"
                : trojka
                  ? "text-[clamp(18px,1.9vw,27px)]"
                  : "text-[16px]"
            }`}
          >
            @{odkrywca.name}
          </span>

          <span className="mt-3 flex items-center justify-center gap-4">
            <span className="flex items-baseline gap-1.5">
              <b
                className={`flame-text tabular-nums ${
                  zwyciezca ? "text-[clamp(22px,2.2vw,32px)]" : "text-[20px]"
                }`}
              >
                {odkrywca.courts}
              </b>
              <span className="text-[11px] uppercase tracking-[0.16em] text-kadr/45">
                {plural(odkrywca.courts, ["boisko", "boiska", "boisk"])}
              </span>
            </span>
            <span className="h-5 w-px bg-white/12" />
            <span className="flex items-center gap-1.5 text-glow">
              <FireBallIcon className={zwyciezca ? "h-5 w-5" : "h-4 w-4"} />
              <b className={`tabular-nums ${zwyciezca ? "text-[clamp(19px,1.9vw,26px)]" : "text-[17px]"}`}>
                {odkrywca.likes}
              </b>
            </span>
          </span>
        </span>

        {odkrywca.plakietki.length > 0 && (
          <span className="flex flex-wrap items-center justify-center gap-1.5">
            {odkrywca.plakietki.slice(0, zwyciezca ? 5 : trojka ? 3 : 2).map((p) => (
              <span key={p.id} title={p.nazwa} className={`medal medal-${p.poziom} h-8 w-8`}>
                <IkonaOdznaczenia id={p.id} className="h-[17px] w-[17px]" />
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Wolne miejsce w siatce - ten sam komunikat co w wierszach, tylko w kształcie karty. */
function WolnaKarta({ miejsce, duza = false }: { miejsce: number; duza?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-white/10 p-6 text-center"
      style={{ height: duza ? "clamp(300px, 29vw, 440px)" : "clamp(240px, 21vw, 320px)" }}
    >
      <span className="text-[26px] font-semibold tabular-nums text-white/15">
        {String(miejsce).padStart(2, "0")}
      </span>
      <span className="h-16 w-16 rounded-full border border-dashed border-white/12" />
      <span className="text-[13px] text-faint">
        wolne miejsce -{" "}
        <Link href="/dodaj" className="text-muted transition hover:text-flame">
          dodaj boisko
        </Link>
      </span>
    </div>
  );
}

function WierszGracza({ odkrywca, miejsce }: { odkrywca: OdkrywcaRanking; miejsce: number }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/gracz/${odkrywca.slug}`}
        className="wiersz-rankingu group flex items-center gap-4 py-3 pr-2"
      >
        <span className="w-10 shrink-0 text-center text-[14px] font-semibold tabular-nums text-faint transition-colors group-hover:text-flame">
          {String(miejsce).padStart(2, "0")}
        </span>

        <span className="avatar-rankingu relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full">
          {odkrywca.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={odkrywca.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flame-gradient grid h-full w-full place-items-center text-[15px] font-bold text-black">
              {odkrywca.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">@{odkrywca.name}</span>
          <span className="block truncate text-[13px] text-faint">
            {odkrywca.courts} {plural(odkrywca.courts, ["boisko", "boiska", "boisk"])}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-glow">
          <FireBallIcon className="h-4 w-4" /> {odkrywca.likes}
        </span>
      </Link>
    </li>
  );
}

/** Wolne miejsce - przerywany wiersz, który mówi wprost, ile jest do wzięcia. */
function WolneMiejsce({ miejsce }: { miejsce: number }) {
  return (
    <li className="min-w-0">
      <div className="flex items-center gap-4 border-b border-white/[0.04] py-3 pr-2">
        <span className="w-10 shrink-0 text-center text-[14px] font-semibold tabular-nums text-white/12">
          {String(miejsce).padStart(2, "0")}
        </span>
        <span className="h-12 w-12 shrink-0 rounded-full border border-dashed border-white/10" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-white/25">wolne miejsce</span>
          <Link href="/dodaj" className="text-[13px] text-faint transition hover:text-flame">
            dodaj boisko, żeby tu wejść
          </Link>
        </span>
      </div>
    </li>
  );
}
