"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapCourt, toMapCourt } from "@/lib/types";
import { toApprovedCourts, useSubmissions } from "@/lib/submissions";
import { prefetchCourtPhotos } from "@/lib/galeria";
import { useSesja } from "@/lib/sesja";
import { supabaseEnabled } from "@/lib/supabase/config";
import { DEFAULT_FILTERS, Filters, applyFilters, countByType } from "@/lib/filters";
import {
  SZUKANIE_W_BAZIE_OD,
  czytajFiltry,
  filtryDoAdresu,
  szukajWBazie,
  useZapytanieFiltrow,
  wedlugTrafnosci,
  zapiszAdres,
} from "@/lib/adres";
/*
  Kandydatów z OpenStreetMap widzi wyłącznie administrator (przycisk renderujemy tylko dla
  niego, a tabela w bazie ma politykę „tylko admin"). Modułu nie importujemy statycznie:
  wtedy jego kod - razem z zapytaniami do Overpass - trafiałby do paczki JS każdego
  odwiedzającego. Dociągamy go dopiero w chwili kliknięcia przycisku.
*/
import type { LeadPoint } from "@/lib/leads";
/*
  Mapa (MapLibre) to 912 kB paczki JS - najcięższy element całego serwisu. Wczytujemy ją
  dynamicznie, po hydracji: szkielet i lista boisk pojawiają się od razu, a mapa dojeżdża
  chwilę później. Bez tego przeglądarka musiała najpierw pobrać i sparsować cały MapLibre,
  zanim cokolwiek dało się kliknąć.
*/
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-void">
      <div className="w-[min(560px,72vw)] opacity-25">
        <CourtOutline uid="mapa-szkielet" />
      </div>
    </div>
  ),
});
import { Sidebar } from "./Sidebar";
import { CourtOutline } from "./CourtOutline";

export function Explorer({ courts }: { courts: MapCourt[] }) {
  /* uprawnienia dociągamy w przeglądarce - inaczej cała mapa musiałaby powstawać na żądanie */
  const sesja = useSesja();
  const isAdmin = Boolean(sesja?.user?.isAdmin);

  const router = useRouter();

  /*
    Filtry: adres na wejściu, stan po pierwszej zmianie.

    Link „mapa Krakowa, tylko oświetlone" ma działać, więc filtry startowe czytamy z adresu -
    ale przez `useZapytanieFiltrow`, nie w `useState`. Odczyt adresu w stanie startowym dawał
    pierwszy render inny niż HTML z serwera i React wyrzucał całe poddrzewo mapy, żeby złożyć
    je od nowa (szczegóły przy samej funkcji w `lib/adres.ts`).

    Po pierwszej zmianie robionej przez człowieka rządzi już `zmiany`, a nie adres. To nie
    komplikacja na zapas: gdyby adres był jedynym źródłem, wracałby przez `filtryDoAdresu`
    obcięty - spacja wpisana w szukajkę ginęłaby w `trim()` w połowie wyrazu, a suwak
    podpaleń przeskakiwał do liczb całkowitych, bo do adresu trafia próg zaokrąglony w górę.
  */
  const zapytanieFiltrow = useZapytanieFiltrow();
  const zAdresu = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...czytajFiltry(new URLSearchParams(zapytanieFiltrow)) }),
    [zapytanieFiltrow]
  );
  const [zmiany, setZmiany] = useState<Filters | null>(null);
  const filters = zmiany ?? zAdresu;
  const setFilters = useCallback((f: Filters) => setZmiany(f), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Na telefonie panel z filtrami startuje zwinięty, żeby mapa miała cały ekran. */
  const [sheetOpen, setSheetOpen] = useState(false);

  /*
    Wizytówka boiska (na dotyku) żyje w MapView, a arkusz z filtrami w Sidebarze.
    Przy otwarciu arkusza jedno nachodziło na drugie, więc mapa udostępnia tu swoją
    funkcję gaszenia wizytówki, a Explorer woła ją w momencie rozwinięcia panelu.
  */
  const clearMapCard = useRef<() => void>(() => undefined);
  const registerClearCard = useCallback((fn: () => void) => {
    clearMapCard.current = fn;
  }, []);

  const openSheet = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (open) clearMapCard.current();
  }, []);

  /* Kandydaci z OSM: szare punkty widoczne tylko dla administratora po kliknięciu. */
  const [showLeads, setShowLeads] = useState(false);
  const [leads, setLeads] = useState<LeadPoint[] | null>(null);
  const [leadsBusy, setLeadsBusy] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<LeadPoint | null>(null);

  // Tryb testowy: boiska zaakceptowane w panelu admina siedzą w localStorage.
  // Po podpięciu bazy wszystko przychodzi już z serwera.
  const submissions = useSubmissions();
  const all = useMemo(
    () =>
      supabaseEnabled
        ? courts
        : [...toApprovedCourts(submissions).map(toMapCourt), ...courts],
    [submissions, courts]
  );
  /*
    Górna granica suwaka podpaleń bierze się z danych, a nie z okrągłej liczby wpisanej
    na sztywno. Przy stałym maksimum 400 wystarczyło ruszyć suwak, żeby wyczyścić całą
    mapę - bo takiej liczby podpaleń nie ma jeszcze żadne boisko.
  */
  const maksLajki = useMemo(
    () => all.reduce((n, c) => Math.max(n, c.likes), 0),
    [all]
  );

  /*
    Powyżej progu SZUKANIE_W_BAZIE_OD zapytanie tekstowe wykonuje baza (indeks trigramowy,
    bez znaków diakrytycznych, sortowanie po trafności). Poniżej filtrujemy w przeglądarce -
    przy kilkunastu wpisach to szybsze niż uderzenie po sieci.
  */
  const duzaBaza = all.length >= SZUKANIE_W_BAZIE_OD;
  const zapytanie = filters.q.trim();
  const [znalezione, setZnalezione] = useState<{ q: string; ids: string[] } | null>(null);

  useEffect(() => {
    if (!duzaBaza || zapytanie.length < 2) return;
    let alive = true;
    szukajWBazie(zapytanie)
      .then((ids) => {
        if (alive) setZnalezione({ q: zapytanie, ids });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [duzaBaza, zapytanie]);

  const results = useMemo(() => {
    const lokalne = applyFilters(all, filters);
    if (!duzaBaza || zapytanie.length < 2) return lokalne;
    // dopóki baza nie odpowie na aktualne zapytanie, pokazujemy wynik lokalny
    if (znalezione?.q !== zapytanie) return lokalne;
    // trafność z bazy + pozostałe filtry (typ, nawierzchnia, oświetlenie) po naszej stronie
    return wedlugTrafnosci(applyFilters(all, { ...filters, q: "" }), znalezione.ids);
  }, [all, filters, duzaBaza, zapytanie, znalezione]);

  const counts = useMemo(() => countByType(all), [all]);

  /*
    Miniatury do wizytówek ściągamy z góry, w bezczynnym momencie po wczytaniu strony:
    jedno zapytanie po wszystkie boiska plus rozgrzanie obrazków. Bez tego pierwsze
    najechanie na pinezkę czekało na bibliotekę Supabase, zapytanie do bazy i pobranie
    zdjęć - czyli widocznie migało.

    Limit 300 boisk to ten sam próg, od którego mapa przechodzi na klastry: przy większej
    bazie rozgrzewanie wszystkiego byłoby droższe niż zysk, a wtedy i tak nie widać
    pojedynczych pinezek.
  */
  useEffect(() => {
    if (!all.length || all.length > SZUKANIE_W_BAZIE_OD) return;

    // na dotyku nie ma najeżdżania - tam wizytówka pojawia się po świadomym dotknięciu
    // pinezki i może dociągnąć swoje trzy miniatury sama; nie ma po co zużywać danych
    const dotyk = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const oszczedzanie = (
      navigator as unknown as { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (dotyk || oszczedzanie) return;

    const ids = all.map((c) => c.id);

    const start = () => {
      void prefetchCourtPhotos(ids).catch(() => undefined);
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) idle(start);
    else setTimeout(start, 600);
  }, [all]);

  /*
    Filtry lądują w adresie, więc widok da się wysłać linkiem i przetrwa odświeżenie.

    Zapisujemy dopiero po zmianie zrobionej przez człowieka. Zapis przy samym wejściu na
    stronę wycierał z adresu to, czego jeszcze nie zdążyliśmy z niego odczytać: pierwszy
    render idzie po stanie serwerowym, czyli po domyślnych filtrach, i taki zapis kasował
    z paska adresu `woj` przyniesione ze stopki.
  */
  useEffect(() => {
    if (!zmiany) return;
    zapiszAdres(filtryDoAdresu(zmiany));
  }, [zmiany]);

  const onSelect = useCallback(
    (c: MapCourt) => router.push(`/boisko/${c.slug}`),
    [router]
  );

  const toggleLeads = useCallback(async () => {
    if (showLeads) {
      setShowLeads(false);
      setActiveLead(null);
      return;
    }
    setShowLeads(true);
    if (leads) return;
    setLeadsBusy(true);
    setLeadsError(null);
    try {
      const { listLeadPoints } = await import("@/lib/leads");
      setLeads(await listLeadPoints());
    } catch (e) {
      setLeadsError((e as Error).message);
    } finally {
      setLeadsBusy(false);
    }
  }, [showLeads, leads]);

  const rejectLead = useCallback(async (id: string) => {
    setLeads((list) => (list ?? []).filter((l) => l.id !== id));
    setActiveLead(null);
    try {
      const { setLeadStatus } = await import("@/lib/leads");
      await setLeadStatus(id, "rejected");
    } catch (e) {
      setLeadsError((e as Error).message);
    }
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        courts={results}
        activeId={activeId}
        highlightVoivodeship={filters.voivodeship}
        onHoverCourt={setActiveId}
        onSelectCourt={onSelect}
        leads={showLeads ? leads ?? [] : []}
        onSelectLead={setActiveLead}
        registerClearCard={registerClearCard}
        sheetOpen={sheetOpen}
      />
      <Sidebar
        filters={filters}
        setFilters={setFilters}
        maksLajki={maksLajki}
        results={results}
        counts={counts}
        sheetOpen={sheetOpen}
        setSheetOpen={openSheet}
      />

      {isAdmin && (
        <div className="absolute right-4 top-20 z-20 flex flex-col items-end gap-2 md:right-6 md:top-24">
          <button
            onClick={toggleLeads}
            className={`rounded-2xl px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition ${
              showLeads
                ? "bg-white/85 text-black"
                : "glass text-muted hover:text-ink"
            }`}
          >
            {leadsBusy
              ? "wczytuję kandydatów…"
              : showLeads
                ? `kandydaci OSM: ${leads?.length ?? 0}`
                : "kandydaci OSM"}
          </button>
          {leadsError && (
            <p className="max-w-[240px] rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-right text-[11px] text-ember">
              {leadsError}
            </p>
          )}
        </div>
      )}

      {activeLead && (
        <div className="glass absolute bottom-[184px] left-1/2 z-30 w-[300px] -translate-x-1/2 rounded-[22px] p-4 rise md:bottom-8 md:left-auto md:right-6 md:translate-x-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
                kandydat z OpenStreetMap
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold">
                {activeLead.name || "Boisko bez nazwy"}
              </p>
              <p className="text-[12px] tabular-nums text-muted">
                {activeLead.lat.toFixed(5)}, {activeLead.lng.toFixed(5)}
              </p>
            </div>
            <button
              onClick={() => setActiveLead(null)}
              className="shrink-0 text-[16px] text-faint transition hover:text-ink"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/admin?nowe=${activeLead.id}`}
              className="flex-1 rounded-xl flame-gradient px-3 py-2.5 text-center text-[12px] font-bold text-black"
            >
              Dodaj to boisko
            </Link>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activeLead.lat},${activeLead.lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-hairline bg-white/5 px-3 py-2.5 text-[12px] text-muted transition hover:text-ink"
            >
              podejrzyj
            </a>
            <button
              onClick={() => void rejectLead(activeLead.id)}
              className="rounded-xl px-2 py-2.5 text-[12px] text-faint transition hover:text-ember"
            >
              odrzuć
            </button>
          </div>
        </div>
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 hidden text-center text-[11px] tracking-wide text-faint md:block">
        © 2026 PODKOSZ.PL
      </p>
    </main>
  );
}
