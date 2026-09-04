"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSesja } from "@/lib/sesja";
import { slugifyPlace } from "@/lib/site";
import type { IdMiejsca, MiejsceGry } from "@/lib/minigra";
import { ArrowLeftIcon } from "@/components/icons";
import { RzutDoKosza } from "./RzutDoKosza";
import { TloBoiska } from "./TlaBoisk";

/**
 * Cała minigra na pełnym ekranie: plansza, ekran tytułowy, licznik i tablica wyników.
 *
 * Gra zajmuje całe okno, bo jest miejscem, w którym się jest - nie kafelkiem w artykule.
 * Poprzednia wersja stała w kolumnie obok rankingu, pod nagłówkiem i akapitem instrukcji,
 * na stronie z paskiem nawigacji i stopką. Rzucało się do kosza wielkości znaczka, a
 * połowa uwagi szła na czytanie, co właściwie trzeba zrobić.
 *
 * Zostaje więc jedna rzecz na ekranie naraz:
 *   - ekran tytułowy z nazwą gry i rozmytą planszą pod spodem,
 *   - po kliknięciu plansza się wyostrza, kosz sam się rysuje kreską i pojawia się piłka,
 *   - w narożnikach tylko to, co konieczne: powrót na mapę, licznik serii i ranking.
 *
 * Tablica wyników wchodzi na wierzch jako szyba z rozmyciem pod spodem, a nie jako druga
 * kolumna. Ranking jest tu rzeczą, po którą się sięga między seriami - nie tłem do gry.
 */

export interface WpisRankingu {
  nick: string;
  avatar: string | null;
  seria: number;
}

/** Błękit pinezki minigry - ten sam, którym świecą oba miejsca na mapie. */
const BLEKIT = "#56acff";

export function EkranGry({
  miejsce,
  ranking,
  drugie,
}: {
  miejsce: MiejsceGry;
  ranking: WpisRankingu[];
  /** drugie miejsce z mapy - osobna tablica wyników, odnośnik w tablicy */
  drugie: MiejsceGry | null;
}) {
  const [zaczeta, setZaczeta] = useState(false);
  const [seria, setSeria] = useState(0);
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [tablica, setTablica] = useState(false);
  const [lista, setLista] = useState(ranking);
  const [rekord, setRekord] = useState(0);

  const sesja = useSesja();
  const zalogowany = Boolean(sesja?.user);
  const mojNick = sesja?.user?.name ?? null;

  /*
    Własny rekord czytamy raz i tylko dla zalogowanego: tabela wyników jest zamknięta
    politykami, więc pytanie o nią bez sesji kończy się odmową i błędem w konsoli.
  */
  useEffect(() => {
    if (!sesja?.user) return;
    let aktualne = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase
        .from("minigra_wyniki")
        .select("seria")
        .eq("miejsce", miejsce.id)
        .maybeSingle();
      if (aktualne && data?.seria) setRekord(data.seria);
    })();

    return () => {
      aktualne = false;
    };
  }, [miejsce.id, sesja?.user]);

  const odswiez = useCallback(
    async (wynik: number) => {
      setRekord((r) => Math.max(r, wynik));

      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase.rpc("minigra_ranking", {
        p_miejsce: miejsce.id,
        p_ile: 20,
      });
      if (Array.isArray(data)) setLista(data as WpisRankingu[]);
    },
    [miejsce.id]
  );

  const naSerie = useCallback((s: number, k: string | null) => {
    setSeria(s);
    setKomunikat(k);
    /* rekord rośnie już w trakcie serii - liczba w tle planszy ma być prawdziwa teraz,
       a nie dopiero po pierwszym pudle */
    setRekord((r) => Math.max(r, s));
  }, []);

  /* spacja i Enter zaczynają grę - klawiatura nie powinna być tu gorsza od myszki */
  useEffect(() => {
    if (zaczeta) return;
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setZaczeta(true);
      }
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [zaczeta]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-void">
      {/*
        Rozmycie pod ekranem tytułowym obejmuje planszę RAZEM z rysunkiem miasta, bo to
        jedna scena. Filtr siedzi na opakowaniu, nie na kanwie: gdyby rozmywała się sama
        kanwa, kontur miasta zostałby ostry i tytuł leżałby na dwóch różnych warstwach.
      */}
      <div
        className="absolute inset-0"
        style={{
          filter: zaczeta ? "blur(0px)" : "blur(20px)",
          transition: "filter 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <TloBoiska miejsce={miejsce.id} />
        </div>

        <RzutDoKosza
          miejsce={miejsce.id as IdMiejsca}
          rekord={rekord}
          zaczeta={zaczeta}
          onWynik={(w) => void odswiez(w)}
          onSeria={naSerie}
        />
      </div>

      {/* ---------------------------------------------------------- ekran tytułowy */}
      {/*
        Nakładka zostaje w drzewie po zniknięciu (`pointer-events: none` i zero
        przezroczystości), bo tak wygaszenie jest przejściem, a nie cięciem. Kliknięcie
        gdziekolwiek zaczyna grę - nie ma tu przycisku do wycelowania.
      */}
      <div
        onPointerDown={() => setZaczeta(true)}
        className={`absolute inset-0 grid place-items-center px-6 text-center transition-all duration-700 ${
          zaczeta ? "pointer-events-none opacity-0" : "cursor-pointer opacity-100"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* przygaszenie planszy pod tytułem - sam blur nie daje dość kontrastu na napis */}
        <div className="absolute inset-0 bg-void/55" />

        <div
          className={`relative transition-all duration-700 ${
            zaczeta ? "scale-[0.96] opacity-0" : "scale-100 opacity-100"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.42em]"
            style={{ color: BLEKIT }}
          >
            {miejsce.miasto}
          </p>
          {/*
            Nazwa gry w jednym stopniu pisma, bez gradientu i bez cienia. Cała stylistyka
            tego ekranu to typografia i światło wokół niej - dlatego litery są ciasno
            zestawione (`tracking`), a wielkość idzie z szerokości okna.
          */}
          <h1 className="mt-5 text-[clamp(44px,11vw,132px)] font-semibold leading-[0.94] tracking-[-0.045em] text-ink">
            Rzut do kosza
          </h1>
          <p className="mx-auto mt-7 max-w-[46ch] text-[15px] leading-relaxed text-muted">
            {miejsce.opis}
          </p>
          <p className="mt-10 text-[12px] uppercase tracking-[0.28em] text-faint">
            kliknij, żeby zacząć
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------- narożniki */}
      <Link
        href="/"
        className="szklo-pro absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> wróć na mapę
      </Link>

      {/*
        Licznik serii pojawia się dopiero po starcie i tylko wtedy, gdy jest co liczyć.
        Pusta plakietka „seria 0" nad świeżo narysowanym koszem nie mówi nic, a zabiera
        ekranowi spokój.
      */}
      <div
        className={`absolute right-5 top-5 z-20 flex items-center gap-2 transition-opacity duration-500 ${
          zaczeta ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="szklo-pro rounded-full px-4 py-2.5 text-[13px] text-ink">
          seria <b className="ml-1 text-[17px] tabular-nums">{seria}</b>
        </span>
        {rekord > 0 && (
          <span className="szklo-pro rounded-full px-4 py-2.5 text-[13px] text-muted">
            rekord <b className="ml-1 text-ink tabular-nums">{rekord}</b>
          </span>
        )}
      </div>

      {komunikat && zaczeta && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
          <span className="szklo-pro rounded-full px-5 py-3 text-center text-[13px] text-ink">
            {komunikat} &middot; dotknij planszy, żeby zacząć od nowa
          </span>
        </div>
      )}

      {!zalogowany && zaczeta && (
        <p className="pointer-events-none absolute inset-x-0 bottom-7 z-20 px-6 text-center text-[12px] text-faint">
          Grasz bez konta - wynik nie wejdzie do rankingu.
        </p>
      )}

      {/* ---------------------------------------------------------- ranking */}
      <button
        onClick={() => setTablica(true)}
        className={`absolute bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-black transition duration-500 hover:brightness-110 active:scale-[0.98] ${
          zaczeta ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: `linear-gradient(135deg, #a8d7ff, ${BLEKIT} 55%, #1d5fd0)`,
          boxShadow: `0 10px 30px -8px rgb(86 172 255 / calc(.8 * var(--moc-poswiaty, 1)))`,
        }}
      >
        Ranking
      </button>

      {tablica && (
        <TablicaWynikow
          miejsce={miejsce}
          drugie={drugie}
          lista={lista}
          mojNick={mojNick}
          onZamknij={() => setTablica(false)}
        />
      )}
    </main>
  );
}

/**
 * Tablica wyników na wierzchu planszy.
 *
 * Szyba z rozmyciem pod spodem: gra zostaje widoczna, tylko nieostra, więc nie ma wrażenia
 * wyjścia z niej do osobnego widoku. Zamyka się kliknięciem w tło, krzyżykiem i Escape -
 * trzy drogi, bo to okno pojawia się w środku rozgrywki i nie może więzić.
 */
function TablicaWynikow({
  miejsce,
  drugie,
  lista,
  mojNick,
  onZamknij,
}: {
  miejsce: MiejsceGry;
  drugie: MiejsceGry | null;
  lista: WpisRankingu[];
  mojNick: string | null;
  onZamknij: () => void;
}) {
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZamknij();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [onZamknij]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center px-5 py-8">
      {/* rozmycie pod szybą - to ono odcina okno od planszy, nie sama przezroczystość */}
      <div
        onClick={onZamknij}
        className="absolute inset-0 bg-void/45 backdrop-blur-xl"
        style={{ animation: "rise 320ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />

      <div
        className="szklo-pro relative max-h-full w-full max-w-[440px] overflow-hidden rounded-[30px]"
        style={{ animation: "rise 420ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="flex items-start justify-between gap-4 px-7 pt-7">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Najdłuższe serie</h2>
            <p className="mt-1 text-[12px] uppercase tracking-[0.14em]" style={{ color: BLEKIT }}>
              {miejsce.nazwa}
            </p>
          </div>
          <button
            onClick={onZamknij}
            aria-label="Zamknij ranking"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-white/6 text-[15px] text-muted transition hover:text-ink"
          >
            &times;
          </button>
        </div>

        <div className="scroll-thin max-h-[52vh] overflow-y-auto px-4 py-5">
          {lista.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted">
              Nikt tu jeszcze nie trafił. Pierwszy wynik jest do wzięcia.
            </p>
          ) : (
            <ol className="space-y-1">
              {lista.map((w, i) => {
                const ja = mojNick !== null && w.nick === mojNick;
                return (
                  <li
                    key={`${w.nick}-${i}`}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                      ja ? "bg-white/[0.07]" : ""
                    }`}
                  >
                    <span
                      className="w-6 text-right text-[13px] font-semibold tabular-nums"
                      style={{ color: i < 3 ? BLEKIT : undefined }}
                    >
                      {i + 1}
                    </span>

                    {w.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.avatar}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] text-muted">
                        {w.nick.slice(0, 1).toUpperCase()}
                      </span>
                    )}

                    <Link
                      href={`/gracz/${slugifyPlace(w.nick)}`}
                      className="min-w-0 flex-1 truncate text-[14px] text-ink transition hover:text-flame"
                    >
                      {w.nick}
                    </Link>

                    <span className="text-[16px] font-semibold tabular-nums text-ink">
                      {w.seria}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-hairline px-7 py-5">
          <p className="text-[12px] leading-relaxed text-faint">
            Liczy się najdłuższa seria trafień pod rząd. Jedno pudło kończy serię - rekord
            zostaje.
          </p>
          {drugie && (
            <Link
              href={`/gra/${drugie.slug}`}
              className="mt-3 inline-flex text-[12px] uppercase tracking-[0.14em] transition hover:brightness-125"
              style={{ color: BLEKIT }}
            >
              drugie boisko: {drugie.nazwa} &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
