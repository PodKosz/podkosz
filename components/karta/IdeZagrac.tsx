"use client";

import { useEffect, useRef, useState } from "react";
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

/** Godziny do wyboru - te same, co w panelu deklaracji na komputerze. */
const GODZINY = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PIERWSZA = GODZINY[0];
const OSTATNIA = GODZINY[GODZINY.length - 1];

const godzinaTeraz = () => Math.floor(terazWPolsce().minuta / 60);
/** najbliższa pełna godzina, mieszcząca się w siatce */
const nastepna = (g: number) => Math.min(OSTATNIA, Math.max(PIERWSZA, g + 1));
const zakres = (od: number, doG: number) => Array.from({ length: doG - od + 1 }, (_, i) => od + i);


/**
 * „Idę zagrać" - przycisk przyklejony na dole ekranu, na środku (prototyp 10).
 *
 * Dotknięcie rozwija nad nim wybór: domyślnie dziś i najbliższa pełna godzina, bo tak
 * najczęściej się umawia („wpadam za godzinę"). Dzień i zakres godzin da się zmienić,
 * a zapis robi dopiero „Potwierdź" - ten sam przycisk, który rozwinął menu, więc palec
 * nie musi szukać nowego miejsca.
 *
 * Kto jest już zapisany na wybrany dzień, widzi swój zakres zamiast „Idę zagrać" i może go
 * zmienić albo odwołać.
 */
export function IdeZagrac({ courtId }: { courtId: string }) {
  const { dzien, wybierzDzien, panel, zalogowany, odswiez } = useGra();
  const { wymagaj } = useBramka();
  const poHydracji = usePoHydracji();

  const [otwarte, setOtwarte] = useState(false);
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
  const data = opis.pelna.split(" ").pop();

  const otworz = () => {
    const g = godzinaTeraz();
    setTeraz(g);
    setBlad(null);
    setDotkniete(false);
    if (opis.dzis && g + 1 > OSTATNIA) {
      /* dziś po ostatniej godzinie nie ma już czego wybrać - jutro wieczorem */
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
    setOtwarte(true);
  };

  /*
    Własna deklaracja na wybrany dzień przychodzi z bazy dopiero po jego zmianie - wtedy
    pokazujemy ją w siatce, o ile nikt jeszcze nie ruszał godzin. `setTimeout`, bo stan
    ustawiony wprost w ciele efektu wywołałby od razu drugi render.
  */
  const pokazanyPanel = useRef("");
  useEffect(() => {
    const klucz = `${panel.dzien}|${panel.moje.join(",")}`;
    if (!otwarte || dotkniete || panel.dzien !== dzien || pokazanyPanel.current === klucz) return;
    pokazanyPanel.current = klucz;
    if (!panel.moje.length) return;
    const [pierwsza, ostatnia] = [panel.moje[0], panel.moje[panel.moje.length - 1]];
    const t = window.setTimeout(() => {
      setOd(pierwsza);
      setDoG(ostatnia);
    }, 0);
    return () => window.clearTimeout(t);
  }, [otwarte, dotkniete, panel.dzien, panel.moje, dzien]);

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
  }, [wybierzDzien]);

  /* Escape zamyka wybór */
  useEffect(() => {
    if (!otwarte) return;
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtwarte(false);
    };
    document.addEventListener("keydown", klawisz);
    return () => document.removeEventListener("keydown", klawisz);
  }, [otwarte]);

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

  const potwierdz = async () => {
    if (busy) return;
    if (!(await wymagaj(`zapisać się na grę ${opis.kiedy}`))) return;
    if (!supabaseEnabled) {
      setBlad("Zapisy ruszą po podpięciu bazy.");
      return;
    }
    setBusy(true);
    setBlad(null);
    try {
      await zapiszDeklaracje(courtId, dzien, od, doG, zajete);
      odswiez();
      setOtwarte(false);
      pokazKomunikat(`Zapisano · ${opis.kiedy} ${opisGodzin(zakres(od, doG))}`);
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const odwolaj = async () => {
    setBusy(true);
    try {
      await odwolajDeklaracje(courtId, dzien);
      odswiez();
      setOtwarte(false);
      pokazKomunikat(`Odwołano ${opis.naKiedy}`);
    } finally {
      setBusy(false);
    }
  };

  const dni =
    panel.tydzien ?? Array.from({ length: DNI_NAPRZOD }, (_, i) => ({ day: dodajDni(panel.dzis, i), osoby: 0 }));
  const godzinDlugosc = doG - od + 1;

  /*
    Przycisk żyje w `<body>`, nie w treści strony: treść leży w warstwie `z-10`, a pasek
    nawigacji nad nią (`z-40`), więc rozwinięty wybór i przyciemnienie tła chowałyby się pod
    paskiem. Portal powstaje dopiero po hydracji - serwer nie ma `document`.
  */
  if (!poHydracji) return null;

  return createPortal(
    <>
      {komunikat && (
        <p role="status" className="kb-komunikat md:hidden">
          {komunikat}
        </p>
      )}

      <div className="kb-dok md:hidden" data-otwarte={otwarte}>
        <button
          type="button"
          tabIndex={otwarte ? 0 : -1}
          aria-hidden={!otwarte}
          aria-label="Zamknij wybór godzin"
          onClick={() => setOtwarte(false)}
          className="kb-dok-tlo"
        />

        <div className="kb-dok-karta" role={otwarte ? "dialog" : undefined} aria-label={otwarte ? "Idę zagrać" : undefined}>
          <div className="kb-rozwin" data-otwarte={otwarte}>
            <div className="min-h-0 overflow-hidden">
              <div className="px-4 pb-3 pt-4" inert={!otwarte}>
                <div className="flex items-start justify-between gap-3 px-1">
                  <div>
                    <p className="text-[17px] font-semibold tracking-[-0.01em]">Kiedy grasz?</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">To nie rezerwacja - dajesz znać, że będziesz.</p>
                  </div>
                  <button type="button" onClick={() => setOtwarte(false)} aria-label="Zamknij" className="kb-kolko">
                    <IkZamknij className="h-4 w-4" />
                  </button>
                </div>

                {/* dni: ten sam wybór co w słupkach „Kto dziś gra" */}
                <div className="mt-4 grid grid-cols-7 gap-1" role="radiogroup" aria-label="Dzień">
                  {dni.map((d) => {
                    const o = opisDnia(d.day, panel.dzis);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        role="radio"
                        aria-checked={d.day === dzien}
                        aria-label={o.pelna}
                        onClick={() => zmienDzien(d.day)}
                        className="kb-dzien"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">{o.krotko}</span>
                        <span className="text-[17px] font-semibold leading-tight tabular-nums">{o.numer}</span>
                        {d.osoby > 0 && <span className="kb-dzien-ile tabular-nums">{d.osoby}</span>}
                      </button>
                    );
                  })}
                </div>

                {blokada ? (
                  <p className="mt-4 rounded-[14px] bg-[var(--k-wyp)] px-4 py-3 text-[13px] leading-snug text-muted">
                    {blokada}
                  </p>
                ) : (
                  <>
                    <div className="mt-4 flex items-baseline justify-between gap-3 px-1">
                      <p className="text-[13px] capitalize text-muted">{opis.pelna}</p>
                      <p className="text-[15px] font-semibold tabular-nums">
                        {opisGodzin(zakres(od, doG))}
                        <span className="ml-1.5 text-[12.5px] font-medium text-muted">
                          {godzinDlugosc} {plural(godzinDlugosc, ["godzina", "godziny", "godzin"])}
                        </span>
                      </p>
                    </div>

                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {GODZINY.map((h) => {
                        const minela = opis.dzis && h < teraz;
                        const zajeta = zajete.includes(h);
                        const wZakresie = h >= od && h <= doG;
                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={minela || zajeta || busy}
                            onClick={() => klik(h)}
                            aria-pressed={wZakresie}
                            title={zajeta ? "O tej godzinie jesteś już na innym boisku" : undefined}
                            className="kb-godzina tabular-nums"
                            data-stan={
                              wZakresie ? (h === od || h === doG ? "brzeg" : "srodek") : zajeta ? "zajeta" : undefined
                            }
                          >
                            {h}:00
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 px-1 text-[12px] text-faint">Dotknij godziny, żeby wydłużyć albo skrócić zakres.</p>
                  </>
                )}

                {zaPozno && !blokada && (
                  <p className="mt-2 px-1 text-[12.5px] text-muted">Na dziś już za późno - wybierz inny dzień.</p>
                )}
                {kolizja && !blokada && (
                  <p className="mt-2 px-1 text-[12.5px] text-muted">W tym zakresie jesteś już na innym boisku.</p>
                )}
                {blad && <p className="mt-2 px-1 text-[12.5px] leading-snug text-ink">{blad}</p>}

                {moje.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void odwolaj()}
                    disabled={busy}
                    className="mt-3 w-full rounded-full py-2.5 text-[13.5px] font-semibold text-muted"
                  >
                    Odwołaj {opis.naKiedy} ({opisGodzin(moje)})
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (otwarte ? void potwierdz() : otworz())}
            disabled={otwarte && (busy || Boolean(blokada) || kolizja || zaPozno)}
            className="kb-dok-cta"
            data-jest={!otwarte && moje.length > 0}
          >
            {otwarte ? (
              <>
                <b>{busy ? "Zapisuję…" : moje.length ? "Zmień godziny" : "Potwierdź"}</b>
                <small>
                  {opis.kiedy} {opisGodzin(zakres(od, doG))}
                </small>
              </>
            ) : moje.length ? (
              <>
                <b>Idziesz {opis.kiedy}</b>
                <small>{opisGodzin(moje)} · dotknij, żeby zmienić</small>
              </>
            ) : (
              <>
                <b>Idę zagrać</b>
                <small>
                  {opis.kiedy}, {data} ·{" "}
                  {osoby > 0 ? `${osoby} ${plural(osoby, ["osoba idzie", "osoby idą", "osób idzie"])}` : "nikt jeszcze"}
                </small>
              </>
            )}
          </button>
          {!zalogowany && otwarte && (
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
