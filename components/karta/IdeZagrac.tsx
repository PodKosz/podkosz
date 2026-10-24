"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DNI_NAPRZOD,
  MAX_GODZIN,
  dodajDni,
  odwolajDeklaracje,
  opisDnia,
  opisGodzin,
  zapiszDeklaracje,
} from "@/lib/checkins";
import { terazWPolsce } from "@/lib/godziny-otwarcia";
import { plural } from "@/lib/site";
import { supabaseEnabled } from "@/lib/supabase/config";
import { useBramka } from "../BramkaLogowania";
import { useGra } from "./KartaKontekst";
import { usePoHydracji } from "./Arkusz";
import { IkZamknij } from "./ikony";
import { useSesja } from "@/lib/sesja";
import { PanelNaBoisku, podpisNaBoisku, useMeldunek } from "./NaBoisku";

/** Godziny do wyboru - od rana do zamknięcia parków. */
const GODZINY = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PIERWSZA = GODZINY[0];
const OSTATNIA = GODZINY[GODZINY.length - 1];

const godzinaTeraz = () => Math.floor(terazWPolsce().minuta / 60);
/** najbliższa pełna godzina, mieszcząca się w siatce */
const nastepna = (g: number) => Math.min(OSTATNIA, Math.max(PIERWSZA, g + 1));
const zakres = (od: number, doG: number) => Array.from({ length: doG - od + 1 }, (_, i) => od + i);

/**
 * Wybór dnia i godzin gry. Dzień jest jeden na całą kartę (`useGra`), więc wybór dnia
 * w słupkach „Kto dziś gra" przestawia go także tutaj.
 *
 * Domyślnie dziś i najbliższa pełna godzina, bo tak najczęściej się umawia („wpadam za
 * godzinę"). Kto jest już zapisany na wybrany dzień, widzi swój zakres.
 */
function useWyborGry(courtId: string, aktywny: boolean) {
  const { dzien, wybierzDzien, panel, zalogowany, odswiez } = useGra();
  const { wymagaj } = useBramka();

  const [od, setOd] = useState(18);
  const [doG, setDoG] = useState(18);
  /* godziny ruszone ręcznie - wtedy odpowiedź z bazy nie nadpisuje wyboru */
  const [dotkniete, setDotkniete] = useState(false);
  const [teraz, setTeraz] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [komunikat, setKomunikat] = useState<string | null>(null);

  const opis = opisDnia(dzien, panel.dzis);
  const panelDnia = panel.dzien === dzien;
  const moje = panelDnia ? panel.moje : [];
  const zajete = panelDnia ? panel.zajete : [];
  const blokada = panelDnia ? panel.blokada : null;
  const osoby = panelDnia ? panel.osoby : 0;

  /** zakres startowy: własna deklaracja albo najbliższa godzina (wieczorem - jutro) */
  const ustawStart = () => {
    const g = godzinaTeraz();
    setTeraz(g);
    setBlad(null);
    setDotkniete(false);
    if (opis.dzis && g + 1 > OSTATNIA) {
      wybierzDzien(dodajDni(panel.dzis, 1));
      setOd(18);
      setDoG(18);
    } else if (moje.length) {
      setOd(moje[0]);
      setDoG(moje[moje.length - 1]);
    } else {
      setOd(nastepna(g));
      setDoG(nastepna(g));
    }
  };

  /*
    Własna deklaracja na wybrany dzień przychodzi z bazy dopiero po jego zmianie albo po
    zalogowaniu - wtedy pokazujemy ją w siatce, o ile nikt jeszcze nie ruszał godzin.
    `setTimeout`, bo stan ustawiony wprost w ciele efektu wywołałby od razu drugi render.
  */
  const pokazanyPanel = useRef("");
  useEffect(() => {
    const klucz = `${panel.dzien}|${panel.moje.join(",")}`;
    if (!aktywny || dotkniete || panel.dzien !== dzien || pokazanyPanel.current === klucz) return;
    pokazanyPanel.current = klucz;
    if (!panel.moje.length) return;
    const [pierwsza, ostatnia] = [panel.moje[0], panel.moje[panel.moje.length - 1]];
    const t = window.setTimeout(() => {
      setOd(pierwsza);
      setDoG(ostatnia);
    }, 0);
    return () => window.clearTimeout(t);
  }, [aktywny, dotkniete, panel.dzien, panel.moje, dzien]);

  const zmienDzien = (d: string) => {
    if (d === dzien) return;
    wybierzDzien(d);
    setBlad(null);
    setDotkniete(false);
    /* zakres zostaje, jeśli w nowym dniu ma sens; dziś po fakcie przesuwamy go na najbliższą godzinę */
    if (opisDnia(d, panel.dzis).dzis && od < teraz) {
      const start = nastepna(teraz);
      setOd(start);
      setDoG(Math.max(start, Math.min(doG, start + MAX_GODZIN - 1)));
    }
  };

  /*
    Zakres wybiera się dotknięciami, bez trybów: godzina przed początkiem przestawia początek,
    po nim - koniec, a dotknięcie brzegu skraca zakres o godzinę. Zawsze jest coś wybrane, więc
    „Potwierdź" nigdy nie wisi nieaktywny bez powodu.
  */
  const klik = (h: number) => {
    setDotkniete(true);
    setBlad(null);
    if (h < od) {
      setOd(h);
      if (doG - h + 1 > MAX_GODZIN) setDoG(h + MAX_GODZIN - 1);
    } else if (h === od) {
      if (doG > od) setOd(od + 1);
    } else if (h === doG) {
      setDoG(doG - 1);
    } else {
      setDoG(Math.min(h, od + MAX_GODZIN - 1));
    }
  };

  const kolizja = zajete.some((g) => g >= od && g <= doG);
  const zaPozno = opis.dzis && od < teraz;

  const zegarKomunikatu = useRef<number | undefined>(undefined);
  const pokazKomunikat = (tekst: string) => {
    window.clearTimeout(zegarKomunikatu.current);
    setKomunikat(tekst);
    zegarKomunikatu.current = window.setTimeout(() => setKomunikat(null), 2600);
  };

  /** `true` po udanym zapisie */
  const potwierdz = async (): Promise<boolean> => {
    if (busy) return false;
    if (!(await wymagaj(`zapisać się na grę ${opis.kiedy}`))) return false;
    if (!supabaseEnabled) {
      setBlad("Zapisy ruszą po podpięciu bazy.");
      return false;
    }
    setBusy(true);
    setBlad(null);
    try {
      await zapiszDeklaracje(courtId, dzien, od, doG, zajete);
      odswiez();
      pokazKomunikat(`Zapisano · ${opis.kiedy} ${opisGodzin(zakres(od, doG))}`);
      return true;
    } catch (e) {
      setBlad((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const odwolaj = async (): Promise<boolean> => {
    setBusy(true);
    try {
      await odwolajDeklaracje(courtId, dzien);
      odswiez();
      pokazKomunikat(`Odwołano ${opis.naKiedy}`);
      return true;
    } finally {
      setBusy(false);
    }
  };

  return {
    dzien, panel, zalogowany, opis, moje, zajete, blokada, osoby,
    od, doG, teraz, busy, blad, komunikat, kolizja, zaPozno,
    ustawStart, zmienDzien, klik, potwierdz, odwolaj, setTeraz, setOd, setDoG, wybierzDzien,
    zablokowany: busy || Boolean(blokada) || kolizja || zaPozno,
  };
}

type Wybor = ReturnType<typeof useWyborGry>;

/** Dni, godziny i komunikaty - wnętrze rozwijanego wyboru. */
function WyborGry({ w }: { w: Wybor }) {
  const dni =
    w.panel.tydzien ??
    Array.from({ length: DNI_NAPRZOD }, (_, i) => ({ day: dodajDni(w.panel.dzis, i), osoby: 0 }));
  const dlugosc = w.doG - w.od + 1;

  return (
    <>
      {/* dni: ten sam wybór co w słupkach „Kto dziś gra" */}
      <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Dzień">
        {dni.map((d) => {
          const o = opisDnia(d.day, w.panel.dzis);
          return (
            <button
              key={d.day}
              type="button"
              role="radio"
              aria-checked={d.day === w.dzien}
              aria-label={o.pelna}
              onClick={() => w.zmienDzien(d.day)}
              className="kb-dzien"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">{o.krotko}</span>
              <span className="text-[17px] font-semibold leading-tight tabular-nums">{o.numer}</span>
              {d.osoby > 0 && <span className="kb-dzien-ile tabular-nums">{d.osoby}</span>}
            </button>
          );
        })}
      </div>

      {w.blokada ? (
        <p className="mt-4 rounded-[14px] bg-[var(--k-wyp)] px-4 py-3 text-[13px] leading-snug text-muted">{w.blokada}</p>
      ) : (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-3 px-1">
            <p className="text-[13px] capitalize text-muted">{w.opis.pelna}</p>
            <p className="text-[15px] font-semibold tabular-nums">
              {opisGodzin(zakres(w.od, w.doG))}
              <span className="ml-1.5 text-[12.5px] font-medium text-muted">
                {dlugosc} {plural(dlugosc, ["godzina", "godziny", "godzin"])}
              </span>
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {GODZINY.map((h) => {
              const minela = w.opis.dzis && h < w.teraz;
              const zajeta = w.zajete.includes(h);
              const wZakresie = h >= w.od && h <= w.doG;
              return (
                <button
                  key={h}
                  type="button"
                  disabled={minela || zajeta || w.busy}
                  onClick={() => w.klik(h)}
                  aria-pressed={wZakresie}
                  title={zajeta ? "O tej godzinie jesteś już na innym boisku" : undefined}
                  className="kb-godzina tabular-nums"
                  data-stan={wZakresie ? (h === w.od || h === w.doG ? "brzeg" : "srodek") : zajeta ? "zajeta" : undefined}
                >
                  {h}:00
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[12px] text-faint">Dotknij godziny, żeby wydłużyć albo skrócić zakres.</p>
        </>
      )}

      {w.zaPozno && !w.blokada && (
        <p className="mt-2 px-1 text-[12.5px] text-muted">Na dziś już za późno - wybierz inny dzień.</p>
      )}
      {w.kolizja && !w.blokada && (
        <p className="mt-2 px-1 text-[12.5px] text-muted">W tym zakresie jesteś już na innym boisku.</p>
      )}
      {w.blad && <p className="mt-2 px-1 text-[12.5px] leading-snug text-ink">{w.blad}</p>}
    </>
  );
}

/** Podpis pod „Idę zagrać": „dziś, 23.10 · 3 osoby idą". */
function podpisDnia(w: Wybor) {
  const data = w.opis.pelna.split(" ").pop();
  const ludzie =
    w.osoby > 0 ? `${w.osoby} ${plural(w.osoby, ["osoba idzie", "osoby idą", "osób idzie"])}` : "nikt jeszcze";
  return `${w.opis.kiedy}, ${data} · ${ludzie}`;
}

/**
 * „Idę zagrać" przyklejony na dole ekranu, na środku (prototyp 10) - na telefonie i na
 * komputerze. Dotknięcie rozwija nad nim wybór, a zapis robi „Potwierdź" - ten sam przycisk,
 * który rozwinął menu, więc palec (i kursor) nie musi szukać nowego miejsca.
 *
 * Na boisku ten sam przycisk zmienia się w „Jesteś na boisku" (meldunek GPS-em, patrz
 * `NaBoisku.tsx`) i rozwija rysunek boiska z innymi zameldowanymi - props i 1 na 1
 * (prototyp 08 z F:\CLAUDE\podkosz-karty\rywalizacja). W domu planujesz, na miejscu
 * grasz - jedno miejsce na ekranie na obie rzeczy.
 */
export function IdeZagrac({ courtId, lat, lng }: { courtId: string; lat: number; lng: number }) {
  const [otwarte, setOtwarte] = useState(false);
  /* co rozwija przycisk: wybór dnia i godzin albo boisko z ludźmi na nim */
  const [tryb, setTryb] = useState<"gra" | "boisko">("gra");
  const w = useWyborGry(courtId, otwarte && tryb === "gra");
  const poHydracji = usePoHydracji();
  const sesja = useSesja();
  const pin = useMemo(() => ({ lat, lng }), [lat, lng]);
  const m = useMeldunek(courtId, pin, w.zalogowany);
  const { setTeraz, setOd, setDoG, wybierzDzien } = w;

  /* zapisany na dziś na godzinę blisko teraz, a jeszcze niezameldowany - podpowiadamy meldunek */
  const godzina = godzinaTeraz();
  const pora = !m.jestem && w.dzien === w.panel.dzis && w.moje.some((h) => h >= godzina - 1 && h <= godzina + 1);

  /* wejście z kodu QR (`?zagraj=1`) od razu rozwija wybór; parametr znika z adresu */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("zagraj") !== "1") return;
    sp.delete("zagraj");
    const q = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    const t = window.setTimeout(() => {
      const g = godzinaTeraz();
      setTeraz(g);
      if (g + 1 > OSTATNIA) {
        wybierzDzien(dodajDni(new Date().toISOString().slice(0, 10), 1));
        setOd(18);
        setDoG(18);
      } else {
        setOd(nastepna(g));
        setDoG(nastepna(g));
      }
      setOtwarte(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [setTeraz, setOd, setDoG, wybierzDzien]);

  /* Escape zamyka wybór */
  useEffect(() => {
    if (!otwarte) return;
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtwarte(false);
    };
    document.addEventListener("keydown", klawisz);
    return () => document.removeEventListener("keydown", klawisz);
  }, [otwarte]);

  /*
    Przycisk żyje w `<body>`, nie w treści strony: treść leży w warstwie `z-10`, a pasek
    nawigacji nad nią (`z-40`), więc rozwinięty wybór i przyciemnienie tła chowałyby się pod
    paskiem. Portal powstaje dopiero po hydracji - serwer nie ma `document`.
  */
  if (!poHydracji) return null;

  return createPortal(
    <>
      {(w.komunikat || m.blad) && (
        <p role="status" className="kb-komunikat">
          {m.blad ?? w.komunikat}
        </p>
      )}

      <div className="kb-dok" data-otwarte={otwarte}>
        <button
          type="button"
          tabIndex={otwarte ? 0 : -1}
          aria-hidden={!otwarte}
          aria-label="Zamknij wybór godzin"
          onClick={() => setOtwarte(false)}
          className="kb-dok-tlo"
        />

        <div
          className="kb-dok-karta"
          role={otwarte ? "dialog" : undefined}
          aria-label={otwarte ? (tryb === "boisko" ? "Na boisku" : "Idę zagrać") : undefined}
        >
          {/* na boisku: rysunek boiska z ludźmi (prototyp 08) */}
          <div className="kb-rozwin" data-otwarte={otwarte && tryb === "boisko"}>
            <div className="min-h-0 overflow-hidden">
              <div className="px-4 pb-3 pt-4" inert={!(otwarte && tryb === "boisko")}>
                <div className="mb-2 flex items-start justify-between gap-3 px-1">
                  <div>
                    <p className="text-[17px] font-semibold tracking-[-0.01em]">Na boisku teraz</p>
                    <p className="kb-zywo mt-0.5">
                      {m.stan?.pokaz ? `Ty i ${m.stan.gracze.length} ${m.stan.gracze.length === 1 ? "osoba" : m.stan.gracze.length < 5 && m.stan.gracze.length > 1 ? "osoby" : "osób"}` : "jesteś zameldowany"}
                    </p>
                  </div>
                  <button type="button" onClick={() => setOtwarte(false)} aria-label="Zamknij" className="kb-kolko">
                    <IkZamknij className="h-4 w-4" />
                  </button>
                </div>
                <PanelNaBoisku m={m} nick={sesja?.user?.name ?? "Ty"} />
              </div>
            </div>
          </div>

          <div className="kb-rozwin" data-otwarte={otwarte && tryb === "gra"}>
            <div className="min-h-0 overflow-hidden">
              <div className="px-4 pb-3 pt-4" inert={!(otwarte && tryb === "gra")}>
                <div className="mb-4 flex items-start justify-between gap-3 px-1">
                  <div>
                    <p className="text-[17px] font-semibold tracking-[-0.01em]">Kiedy grasz?</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">To nie rezerwacja - dajesz znać, że będziesz.</p>
                  </div>
                  <button type="button" onClick={() => setOtwarte(false)} aria-label="Zamknij" className="kb-kolko">
                    <IkZamknij className="h-4 w-4" />
                  </button>
                </div>

                {/* już na miejscu? meldunek GPS-em zamiast wybierania godzin */}
                {w.dzien === w.panel.dzis && !m.jestem && (
                  <button type="button" className="kb-meldunek-wiersz" onClick={() => m.sprobuj(true)} disabled={m.szukam}>
                    <span>
                      <b>Jesteś już na boisku?</b>
                      <small>Zamelduj się - zobaczysz, kto jeszcze gra</small>
                    </span>
                    <span className="kb-meldunek-akcja">{m.szukam ? "Sprawdzam…" : "Jestem tu"}</span>
                  </button>
                )}

                <WyborGry w={w} />

                {w.moje.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void w.odwolaj().then((ok) => ok && setOtwarte(false))}
                    disabled={w.busy}
                    className="mt-3 w-full rounded-full py-2.5 text-[13.5px] font-semibold text-muted"
                  >
                    Odwołaj {w.opis.naKiedy} ({opisGodzin(w.moje)})
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (otwarte && tryb === "boisko") {
                setOtwarte(false);
                return;
              }
              if (!otwarte && m.jestem) {
                setTryb("boisko");
                setOtwarte(true);
                void m.odswiez();
                return;
              }
              if (!otwarte && pora) {
                m.sprobuj(true);
                return;
              }
              if (!otwarte) {
                setTryb("gra");
                w.ustawStart();
                setOtwarte(true);
                return;
              }
              void w.potwierdz().then((ok) => ok && setOtwarte(false));
            }}
            disabled={otwarte && tryb === "gra" && w.zablokowany}
            className="kb-dok-cta"
            data-jest={(!otwarte && (w.moje.length > 0 || m.jestem)) || (otwarte && tryb === "boisko")}
          >
            {otwarte && tryb === "boisko" ? (
              <>
                <b>Gotowe</b>
                <small>zostajesz zameldowany do wyjścia</small>
              </>
            ) : !otwarte && m.jestem ? (
              <>
                <b>Jesteś na boisku</b>
                <small>{podpisNaBoisku(m.stan)}</small>
              </>
            ) : !otwarte && pora ? (
              <>
                <b>{m.szukam ? "Sprawdzam lokalizację…" : "Jesteś już na boisku?"}</b>
                <small>dotknij, żeby się zameldować</small>
              </>
            ) : otwarte ? (
              <>
                <b>{w.busy ? "Zapisuję…" : w.moje.length ? "Zmień godziny" : "Potwierdź"}</b>
                <small>
                  {w.opis.kiedy} {opisGodzin(zakres(w.od, w.doG))}
                </small>
              </>
            ) : w.moje.length ? (
              <>
                <b>Idziesz {w.opis.kiedy}</b>
                <small>{opisGodzin(w.moje)} · dotknij, żeby zmienić</small>
              </>
            ) : (
              <>
                <b>Idę zagrać</b>
                <small>{podpisDnia(w)}</small>
              </>
            )}
          </button>
          {!w.zalogowany && otwarte && tryb === "gra" && (
            <p className="pb-1 pt-2 text-center text-[11.5px] text-faint">
              Zapis wymaga konta - zalogujesz się jednym dotknięciem.
            </p>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
