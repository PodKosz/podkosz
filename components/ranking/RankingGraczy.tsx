import Link from "next/link";
import type { OdkrywcaRanking } from "@/lib/repo";
import { plural } from "@/lib/site";
import { CourtPhoto } from "@/components/CourtPhoto";
import { IkonaOdznaczenia } from "@/components/IkonaOdznaczenia";
import { FireBallIcon } from "@/components/icons";

/**
 * Ranking graczy - ludzie, którzy dodali boiska.
 *
 * Ranking boisk pokazuje MIEJSCA, więc jego walutą jest zdjęcie. Tutaj walutą jest osoba,
 * więc pierwsze skrzypce gra twarz, a boiska schodzą do roli dowodu: pasek kadrów pod
 * nickiem mówi „to jest jego robota" jednym spojrzeniem, bez wchodzenia w profil.
 *
 * Trzy pasy o malejącej wadze, jak w rankingu boisk - to celowe, obie strony mają się
 * czytać tak samo, mimo że pokazują co innego:
 *
 *   1. Podium (1-3) - trzy karty ułożone schodkiem, pierwsza wyraźnie większa.
 *   2. Miejsca 4-10 - karty z avatarem i trzema kadrami.
 *   3. Miejsca 11-25 - zwarte wiersze w dwóch kolumnach.
 *
 * Puste miejsca zostają w liście jako przerywane wiersze. Ranking z pięcioma osobami
 * wygląda na porzucony; ranking z pięcioma osobami i dwudziestoma wolnymi miejscami
 * wygląda na zaproszenie.
 */

const SIATKA_DO = 10;
const LISTA_DO = 25;

export function RankingGraczy({ odkrywcy }: { odkrywcy: OdkrywcaRanking[] }) {
  const podium = odkrywcy.slice(0, 3);
  const siatka = odkrywcy.slice(3, SIATKA_DO);
  const lista = odkrywcy.slice(SIATKA_DO, LISTA_DO);
  /* ile wolnych miejsc dopisać na końcu, żeby lista sięgała pełnej dwudziestki piątki */
  const wolne = Math.max(0, LISTA_DO - Math.max(odkrywcy.length, SIATKA_DO));

  if (!podium.length) {
    return (
      <p className="szklo-pro rounded-[26px] p-10 text-center text-[15px] text-muted">
        Nikt jeszcze nie dodał boiska. Pierwsze miejsce stoi wolne.
      </p>
    );
  }

  return (
    <div className="space-y-20">
      <Podium odkrywcy={podium} />

      <section>
        <Naglowek tytul="Goniący" opis={`Miejsca 4-${SIATKA_DO}`} />
        {/*
          Siatka zawsze pełna: brakujące miejsca dopisujemy jako puste karty. Ranking,
          który skacze z trzeciego miejsca prosto na jedenaste, wygląda na zepsuty -
          a to po prostu stawka, która się jeszcze nie zebrała.
        */}
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {siatka.map((o, i) => (
            <KartaGracza key={o.slug} odkrywca={o} miejsce={i + 4} />
          ))}
          {Array.from({ length: SIATKA_DO - 3 - siatka.length }, (_, i) => (
            <WolnaKarta key={`wolna-${i}`} miejsce={4 + siatka.length + i} />
          ))}
        </div>
      </section>

      {(lista.length > 0 || wolne > 0) && (
        <section>
          <Naglowek tytul="W stawce" opis={`Miejsca ${SIATKA_DO + 1}-${LISTA_DO}`} />
          <ol className="mt-7 grid gap-2.5 xl:grid-cols-2 xl:gap-x-5">
            {lista.map((o, i) => (
              <WierszGracza key={o.slug} odkrywca={o} miejsce={SIATKA_DO + 1 + i} />
            ))}
            {Array.from({ length: wolne }, (_, i) => (
              <WolneMiejsce
                key={`wolne-${i}`}
                miejsce={SIATKA_DO + lista.length + 1 + i}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Naglowek({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-3">
      <h2 className="text-[clamp(19px,2vw,24px)] font-semibold tracking-[-0.01em]">{tytul}</h2>
      <p className="text-[12px] uppercase tracking-[0.18em] text-faint">{opis}</p>
    </div>
  );
}

/**
 * Podium graczy - schodek zamiast trzech równych kafelków.
 *
 * Pierwsze miejsce dostaje szerszą kolumnę i stoi najwyżej, trzecie najniżej. Przesunięcia
 * są wyłączone poniżej progu `lg`: na telefonie karty i tak idą jedna pod drugą, więc
 * schodek zamieniłby się w przypadkowe dziury.
 */
function Podium({ odkrywcy }: { odkrywcy: OdkrywcaRanking[] }) {
  /* schodek: pierwszy najwyżej, trzeci najniżej - kolejność widać, zanim padnie numer */
  const zjazd = ["lg:mt-0", "lg:mt-12", "lg:mt-24"];

  return (
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12 lg:items-start">
      {odkrywcy.map((o, i) => (
        <div
          key={o.slug}
          className={`${i === 0 ? "sm:col-span-2 lg:col-span-6" : "lg:col-span-3"} ${zjazd[i]}`}
        >
          <KartaGracza odkrywca={o} miejsce={i + 1} wariant={i === 0 ? "zwyciezca" : "podium"} />
        </div>
      ))}
    </section>
  );
}

/**
 * Karta gracza.
 *
 * Avatar jest okrągły i duży, bo to on ma być pierwszym, co widać. Pod nim liczby, a na
 * dole pasek kadrów - trzy zdjęcia jego boisk, przycięte na kwadrat i sklejone bez odstępu,
 * żeby czytały się jako jeden dowód, a nie trzy osobne miniatury.
 */
function KartaGracza({
  odkrywca,
  miejsce,
  wariant = "siatka",
}: {
  odkrywca: OdkrywcaRanking;
  miejsce: number;
  wariant?: "zwyciezca" | "podium" | "siatka";
}) {
  const zwyciezca = wariant === "zwyciezca";
  const kadry = odkrywca.kadry.slice(0, zwyciezca ? 4 : 3);

  return (
    <Link
      href={`/gracz/${odkrywca.slug}`}
      className="karta-rankingu szklo-pro group relative flex h-full flex-col overflow-hidden rounded-[26px]"
    >
      {/* poświata za avatarem - jedyny mocny akcent koloru na karcie */}
      <span
        aria-hidden
        className="karta-gracza-zar pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
      />

      {/*
        Bez paska kadrów karta kończy się tuż pod liczbami i przy sąsiadce ze zdjęciami
        wygląda na uciętą. Dodatkowy oddech u dołu robi z niej kartę krótszą, a nie
        niedokończoną. Kadrów brakuje tym osobom, których boiska trafiły do bazy z panelu:
        mają wtedy sam podpis autora, bez powiązania z kontem.
      */}
      <span
        className={`relative flex flex-col items-center px-5 text-center ${
          zwyciezca ? "pt-10" : "pt-8"
        } ${kadry.length ? (zwyciezca ? "pb-6" : "pb-5") : "pb-9"}`}
      >
        <span
          aria-hidden
          className={`absolute right-4 top-3 flame-text font-bold leading-none tabular-nums opacity-45 transition-opacity duration-500 group-hover:opacity-75 ${
            zwyciezca ? "text-[clamp(56px,6vw,92px)]" : "text-[clamp(40px,4vw,64px)]"
          }`}
        >
          {miejsce}
        </span>

        <span
          className={`avatar-rankingu relative grid place-items-center overflow-hidden rounded-full ${
            zwyciezca ? "h-[clamp(96px,10vw,140px)] w-[clamp(96px,10vw,140px)]" : "h-[84px] w-[84px]"
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

        <span
          className={`mt-4 block max-w-full truncate font-semibold tracking-[-0.01em] transition-colors group-hover:text-glow ${
            zwyciezca ? "text-[clamp(20px,2.2vw,28px)]" : "text-[17px]"
          }`}
        >
          @{odkrywca.name}
        </span>

        {odkrywca.plakietki.length > 0 && (
          <span className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {odkrywca.plakietki.slice(0, zwyciezca ? 4 : 3).map((p) => (
              <span key={p.id} title={p.nazwa} className={`medal medal-${p.poziom} h-8 w-8`}>
                <IkonaOdznaczenia id={p.id} className="h-[17px] w-[17px]" />
              </span>
            ))}
          </span>
        )}

        <span className="mt-4 flex items-center justify-center gap-5">
          <span className="flex items-baseline gap-1.5">
            <b className={`flame-text tabular-nums ${zwyciezca ? "text-[26px]" : "text-[20px]"}`}>
              {odkrywca.courts}
            </b>
            <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
              {plural(odkrywca.courts, ["boisko", "boiska", "boisk"])}
            </span>
          </span>
          <span className="h-6 w-px bg-white/10" />
          <span className="flex items-center gap-1.5 text-glow">
            <FireBallIcon className={zwyciezca ? "h-5 w-5" : "h-4 w-4"} />
            <b className={`tabular-nums ${zwyciezca ? "text-[22px]" : "text-[17px]"}`}>
              {odkrywca.likes}
            </b>
          </span>
        </span>
      </span>

      {/*
        Pasek kadrów przyklejony do dolnej krawędzi (`mt-auto`), żeby karty w jednym rzędzie
        kończyły się równo także wtedy, gdy jedna ma plakietki, a druga nie.
      */}
      {kadry.length > 0 && (
        <span className="mt-auto grid grid-flow-col auto-cols-fr">
          {kadry.map((k) => (
            <span key={k.slug} className="relative block aspect-square overflow-hidden">
              <CourtPhoto photo={k.photo} seed={k.seed} sizes="140px" />
              <span className="karta-rankingu-zaslona pointer-events-none absolute inset-0" />
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

function WierszGracza({ odkrywca, miejsce }: { odkrywca: OdkrywcaRanking; miejsce: number }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/gracz/${odkrywca.slug}`}
        className="wiersz-rankingu group flex items-center gap-4 rounded-[20px] p-2.5 pr-5"
      >
        <span className="w-9 shrink-0 text-center text-[15px] font-semibold tabular-nums text-faint transition-colors group-hover:text-flame">
          {miejsce}
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
          <span className="block truncate text-[15px] font-semibold">@{odkrywca.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {odkrywca.courts} {plural(odkrywca.courts, ["boisko", "boiska", "boisk"])}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-bold text-glow">
          <FireBallIcon className="h-4 w-4" /> {odkrywca.likes}
        </span>
      </Link>
    </li>
  );
}

/** Wolne miejsce w siatce - ten sam komunikat co w wierszach, tylko w kształcie karty. */
function WolnaKarta({ miejsce }: { miejsce: number }) {
  return (
    <div className="flex min-h-[212px] flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-white/10 p-6 text-center">
      <span className="text-[28px] font-semibold tabular-nums text-white/15">{miejsce}</span>
      <span className="h-16 w-16 rounded-full border border-dashed border-white/10" />
      <span className="text-[13px] text-faint">
        wolne miejsce -{" "}
        <Link href="/dodaj" className="text-muted transition hover:text-flame">
          dodaj boisko
        </Link>
      </span>
    </div>
  );
}

/** Wolne miejsce - przerywany wiersz, który mówi wprost, ile jest do wzięcia. */
function WolneMiejsce({ miejsce }: { miejsce: number }) {
  return (
    <li className="min-w-0">
      <div className="flex items-center gap-4 rounded-[20px] border border-dashed border-white/10 p-2.5 pr-5">
        <span className="w-9 shrink-0 text-center text-[15px] font-semibold tabular-nums text-white/15">
          {miejsce}
        </span>
        <span className="h-12 w-12 shrink-0 rounded-full border border-dashed border-white/10" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-faint">wolne miejsce</span>
          <Link
            href="/dodaj"
            className="text-[13px] text-muted transition hover:text-flame"
          >
            dodaj boisko, żeby tu wejść
          </Link>
        </span>
      </div>
    </li>
  );
}
