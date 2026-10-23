"use client";

import { useState, type ReactNode } from "react";
import { DNI_NAPRZOD, dodajDni, opisDnia, opisGodzin } from "@/lib/checkins";
import { plural } from "@/lib/site";
import { useGra } from "./KartaKontekst";
import { IkDol, IkKodQr } from "./ikony";

/**
 * „Kto dziś gra" - tydzień deklaracji jako słupki (prototyp 01) i kod „zeskanuj i zagraj"
 * (prototyp 09) po dotknięciu.
 *
 * Słupek to liczba osób, które się danego dnia wybierają; dotknięcie dnia pokazuje jego
 * godziny i przestawia ten sam dzień w dolnym przycisku „Idę zagrać" - jeden wybór dnia
 * na całą kartę, nie dwa niezależne.
 *
 * Kod QR prowadzi na tę kartę z `?zagraj=1`, czyli od razu do zapisu: ekipa przy boisku
 * pokazuje kod, kolega skanuje i ma przed sobą wybór godzin.
 */
export function KtoDzisGra({ kodQr }: { kodQr: ReactNode }) {
  const { dzien, wybierzDzien, panel, gotowe } = useGra();
  const [kod, setKod] = useState(false);

  /* baza bez tygodniowych deklaracji oddaje tylko dzień, o który pytano - resztę rysujemy na zero */
  const dni =
    panel.tydzien ??
    Array.from({ length: DNI_NAPRZOD }, (_, i) => {
      const d = dodajDni(panel.dzis, i);
      return { day: d, osoby: d === panel.dzien ? panel.osoby : 0 };
    });
  const max = Math.max(1, ...dni.map((d) => d.osoby));
  const razem = dni.reduce((s, d) => s + d.osoby, 0);

  const opis = opisDnia(dzien, panel.dzis);
  const osoby = panel.dzien === dzien ? panel.osoby : 0;

  return (
    <section className="kb-sekcja" aria-labelledby="kto-gra">
      <div className="kb-karta overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
          <h2 id="kto-gra" className="kb-tytul">
            Kto dziś gra
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {razem > 0 ? `${razem} ${plural(razem, ["zapis", "zapisy", "zapisów"])} w 7 dni` : "Najbliższe 7 dni"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 px-3" role="radiogroup" aria-label="Dzień gry">
          {dni.map((d) => {
            const o = opisDnia(d.day, panel.dzis);
            const wybrany = d.day === dzien;
            const moj = panel.mojeDni.some((m) => m.day === d.day) || (wybrany && panel.moje.length > 0);
            return (
              <button
                key={d.day}
                type="button"
                role="radio"
                aria-checked={wybrany}
                aria-label={`${o.pelna}: ${d.osoby} ${plural(d.osoby, ["osoba", "osoby", "osób"])}`}
                onClick={() => wybierzDzien(d.day)}
                className="kb-slupek"
              >
                <span className="kb-slupek-liczba tabular-nums">{gotowe ? d.osoby : "·"}</span>
                <span className="kb-slupek-tor">
                  <i style={{ height: `${gotowe && d.osoby ? Math.max(14, (d.osoby / max) * 100) : 0}%` }} />
                </span>
                <span className="kb-slupek-dzien">{o.krotko}</span>
                <span className="kb-slupek-nr tabular-nums">{o.numer}</span>
                {moj && <span aria-hidden className="kb-slupek-moj" />}
              </button>
            );
          })}
        </div>

        {/*
          Stan wybranego dnia i kod QR - jedno pole, jedno dotknięcie. Bez osobnego przycisku
          zapisu: zapis robi przyklejony „Idę zagrać" na dole ekranu, który zawsze jest pod ręką.
        */}
        <button
          type="button"
          onClick={() => setKod((k) => !k)}
          aria-expanded={kod}
          className="mt-3 block w-full border-t border-[var(--k-linia)] px-5 pb-4 pt-4 text-left"
        >
          {osoby > 0 ? (
            <>
              <span className="block text-[17px] font-semibold tracking-[-0.01em]">
                {`${osoby} ${plural(osoby, ["osoba idzie", "osoby idą", "osób idzie"])} ${opis.kiedy}`}
              </span>
              {panel.slots.length > 0 && (
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {panel.slots.map((s) => (
                    <span key={s.hour} className="kb-chip tabular-nums">
                      {s.hour}:00 <b>{s.people}</b>
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="block text-[17px] font-semibold tracking-[-0.01em]">
                {opis.dzis
                  ? "Dziś jeszcze nikt się nie zapisał"
                  : `${opis.naKiedy.charAt(0).toUpperCase()}${opis.naKiedy.slice(1)} jeszcze nikt się nie zapisał`}
              </span>
              <span className="mt-1 block text-[13.5px] leading-snug text-muted">
                Bądź pierwszy - inni zobaczą, że będzie gra.
              </span>
            </>
          )}
          {panel.moje.length > 0 && panel.dzien === dzien && (
            <span className="mt-2 block text-[13px] font-semibold text-ink">
              Ty też: {opisGodzin(panel.moje)}
            </span>
          )}

          <span className="mt-4 flex items-center gap-3 rounded-[14px] bg-[var(--k-wyp)] px-3.5 py-3">
            <IkKodQr className="h-5 w-5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Zeskanuj i zagraj</span>
              <span className="block text-[12.5px] text-muted">Kod QR dla ekipy</span>
            </span>
            <IkDol className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${kod ? "rotate-180" : ""}`} />
          </span>
        </button>

        <div className="kb-rozwin" data-otwarte={kod}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center gap-4 px-5 pb-5">
              <div className="kb-qr shrink-0">{kodQr}</div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold">Zeskanuj i zagraj</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">
                  Pokaż kod ekipie - dopiszą się do gry jednym skanem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
