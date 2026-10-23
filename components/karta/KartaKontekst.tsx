"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckinSlot, PanelDeklaracji, dzisiaj, fetchPanel } from "@/lib/checkins";
import { ListaOpinii, pobierzOpinie } from "@/lib/opinie";
import { useSesja } from "@/lib/sesja";
import { Lightbox, type LightboxItem } from "../Lightbox";

/**
 * Stan karty boiska na telefonie, wspólny dla kilku miejsc naraz.
 *
 * Te same dane rysują się na karcie w dwóch-trzech punktach i muszą się zgadzać:
 *  - deklaracje gry - słupki „Kto dziś gra" i dolny przycisk „Idę zagrać" (wybór dnia
 *    w słupkach przestawia dzień w przycisku i odwrotnie),
 *  - opinie - komórka „Opinie" w pasku pod nazwą i sekcja opinii niżej,
 *  - galeria - przycisk ze zdjęciami na kadrze tytułowym i pasek zdjęć.
 *
 * Jedno zapytanie na rzecz, nie jedno na miejsce. Karta leci z pamięci podręcznej, więc
 * wszystko, co zależy od patrzącego, dociąga się tutaj, po zamontowaniu.
 */

const PUSTY_PANEL = (dzien: string): PanelDeklaracji => ({
  dzien,
  dzis: dzien,
  slots: [],
  osoby: 0,
  moje: [],
  zajete: [],
  blokada: null,
  tydzien: null,
  mojeDni: [],
});

interface Gra {
  dzien: string;
  wybierzDzien: (d: string) => void;
  panel: PanelDeklaracji;
  /** `false`, dopóki pierwsza odpowiedź nie wróciła - słupki stoją wtedy płasko */
  gotowe: boolean;
  zalogowany: boolean;
  odswiez: () => void;
  /** ile osób o której godzinie danego dnia - dla kart dni w „Kto dziś gra" */
  godzinyDnia: (day: string) => CheckinSlot[];
}

interface Opinie extends ListaOpinii {
  gotowe: boolean;
  odswiez: () => void;
}

interface Kontekst {
  gra: Gra;
  opinie: Opinie;
  otworzZdjecie: (i: number) => void;
}

const K = createContext<Kontekst | null>(null);

function useKarta(): Kontekst {
  const k = useContext(K);
  if (!k) throw new Error("Element karty boiska poza <KartaDostawca>.");
  return k;
}

export const useGra = () => useKarta().gra;
export const useOpinie = () => useKarta().opinie;
export const useGaleria = () => useKarta().otworzZdjecie;

export function KartaDostawca({
  courtId,
  zdjecia,
  children,
}: {
  courtId: string;
  zdjecia: LightboxItem[];
  children: ReactNode;
}) {
  const sesja = useSesja();
  /* do czasu odpowiedzi sesji pytamy jak gość; po zalogowaniu panel przychodzi jeszcze raz z „moimi" godzinami */
  const zalogowany = Boolean(sesja?.user);

  /* ---------- deklaracje ---------- */
  const [dzien, setDzien] = useState(dzisiaj);
  const [panel, setPanel] = useState<PanelDeklaracji>(() => PUSTY_PANEL(dzisiaj()));
  const [gotowe, setGotowe] = useState(false);
  const [licznik, setLicznik] = useState(0);
  /* godziny dni pobrane osobno (patrz niżej) - wypełnia je też każda odpowiedź panelu */
  const [dociagniete, setDociagniete] = useState<Record<string, CheckinSlot[]>>({});

  useEffect(() => {
    let aktualne = true;
    fetchPanel(courtId, dzien)
      .catch(() => null)
      .then((p) => {
        if (!aktualne) return;
        const wynik = p ?? PUSTY_PANEL(dzien);
        setPanel(wynik);
        setGotowe(true);
        setDociagniete((d) => ({ ...d, [wynik.dzien]: wynik.slots }));
        /* baza ma inny „dziś" niż zegar telefonu (koło północy) - trzymamy się bazy */
        if (wynik.dzien !== dzien) setDzien(wynik.dzien);
      });
    return () => {
      aktualne = false;
    };
  }, [courtId, dzien, zalogowany, licznik]);

  const odswiezGre = useCallback(() => setLicznik((n) => n + 1), []);

  /*
    Godziny pozostałych dni tygodnia. Baza po `migration-tydzien-godziny.sql` oddaje je
    w `tydzien` razem z panelem; bez tej migracji dociągamy je tu osobno - tylko dla dni,
    w które ktoś się wybiera, bo pusty dzień i tak nie ma czego pokazać.
  */
  useEffect(() => {
    const brak = (panel.tydzien ?? [])
      .filter((t) => t.osoby > 0 && !t.godziny && !(t.day in dociagniete))
      .map((t) => t.day);
    if (!brak.length) return;
    let aktualne = true;
    Promise.all(brak.map((d) => fetchPanel(courtId, d).catch(() => null))).then((wyniki) => {
      if (!aktualne) return;
      setDociagniete((stare) => {
        const nowe = { ...stare };
        wyniki.forEach((p, i) => {
          nowe[brak[i]] = p?.slots ?? [];
        });
        return nowe;
      });
    });
    return () => {
      aktualne = false;
    };
  }, [courtId, panel, dociagniete]);

  const godzinyDnia = useCallback(
    (day: string): CheckinSlot[] =>
      day === panel.dzien ? panel.slots : panel.tydzien?.find((t) => t.day === day)?.godziny ?? dociagniete[day] ?? [],
    [panel, dociagniete]
  );

  /* ---------- opinie ---------- */
  const [opinie, setOpinie] = useState<ListaOpinii>({ dostepne: false, lista: [] });
  const [opinieGotowe, setOpinieGotowe] = useState(false);
  const [licznikOpinii, setLicznikOpinii] = useState(0);

  useEffect(() => {
    let aktualne = true;
    pobierzOpinie(courtId)
      .catch(() => ({ dostepne: false, lista: [] }))
      .then((o) => {
        if (!aktualne) return;
        setOpinie(o);
        setOpinieGotowe(true);
      });
    return () => {
      aktualne = false;
    };
  }, [courtId, zalogowany, licznikOpinii]);

  const odswiezOpinie = useCallback(() => setLicznikOpinii((n) => n + 1), []);

  /* ---------- galeria ---------- */
  const [zdjecie, setZdjecie] = useState<number | null>(null);

  const wartosc = useMemo<Kontekst>(
    () => ({
      gra: { dzien, wybierzDzien: setDzien, panel, gotowe, zalogowany, odswiez: odswiezGre, godzinyDnia },
      opinie: { ...opinie, gotowe: opinieGotowe, odswiez: odswiezOpinie },
      otworzZdjecie: setZdjecie,
    }),
    [dzien, panel, gotowe, zalogowany, odswiezGre, godzinyDnia, opinie, opinieGotowe, odswiezOpinie]
  );

  return (
    <K.Provider value={wartosc}>
      {children}
      {zdjecie !== null && zdjecia.length > 0 && (
        <Lightbox items={zdjecia} index={zdjecie} onIndex={setZdjecie} onClose={() => setZdjecie(null)} />
      )}
    </K.Provider>
  );
}
