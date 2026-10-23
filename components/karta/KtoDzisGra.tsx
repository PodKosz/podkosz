"use client";

import { useRef, type ReactNode } from "react";
import { DNI_NAPRZOD, dodajDni, opisDnia } from "@/lib/checkins";
import { terazWPolsce } from "@/lib/godziny-otwarcia";
import { plural } from "@/lib/site";
import { useGra } from "./KartaKontekst";
import { IkStrzalka } from "./ikony";

/** Godziny na słupkach karty - te same, w które da się zapisać. */
const GODZINY = Array.from({ length: 16 }, (_, i) => 7 + i);
const SKROT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sob"];
const g2 = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * „Kto dziś gra" - pas kart, po jednej na każdy z siedmiu dni (prototyp 08 z `podkosz-karty/kto-gra`).
 *
 * W boxie jest tylko informacja: ile osób danego dnia i o której. Zapis robi przyklejony
 * „Idę zagrać" na dole ekranu - dotknięcie karty wybiera dzień także w nim.
 *
 * Zaraz za „Dziś" stoi biała karta z kodem QR: ekipa przy boisku pokazuje kod, kolega skanuje
 * i trafia na tę kartę z otwartym zapisem (`?zagraj=1`).
 */
export function KtoDzisGra({ kodQr }: { kodQr: ReactNode }) {
  const { dzien, wybierzDzien, panel, gotowe, godzinyDnia } = useGra();
  const pas = useRef<HTMLDivElement>(null);

  /* baza bez tygodniowych deklaracji oddaje tylko dzień, o który pytano - resztę rysujemy na zero */
  const dni =
    panel.tydzien ??
    Array.from({ length: DNI_NAPRZOD }, (_, i) => {
      const d = dodajDni(panel.dzis, i);
      return { day: d, osoby: d === panel.dzien ? panel.osoby : 0 };
    });

  const wszystkieGodziny = dni.flatMap((d) => godzinyDnia(d.day).map((s) => s.people));
  const max = Math.max(3, ...wszystkieGodziny);
  const godzinaTeraz = Math.floor(terazWPolsce().minuta / 60);
  const teraz = godzinyDnia(panel.dzis).find((s) => s.hour === godzinaTeraz)?.people ?? 0;

  const przewin = (kierunek: 1 | -1) =>
    pas.current?.scrollBy({ left: kierunek * pas.current.clientWidth * 0.8, behavior: "smooth" });

  const karta = (d: { day: string; osoby: number }) => {
    const o = opisDnia(d.day, panel.dzis);
    const [nazwa, data] = o.pelna.split(" ");
    const sloty = godzinyDnia(d.day);
    const godziny = sloty.map((s) => s.hour);
    const szczyt = sloty.reduce<{ hour: number; people: number } | null>((n, s) => (!n || s.people > n.people ? s : n), null);
    const tydzien = SKROT[new Date(`${d.day}T12:00:00Z`).getUTCDay()];
    const tytul = o.dzis ? "Dziś" : o.krotko === "Jutro" ? "Jutro" : nazwa.charAt(0).toUpperCase() + nazwa.slice(1);

    return (
      <button
        key={d.day}
        type="button"
        role="radio"
        aria-checked={d.day === dzien}
        aria-label={`${o.pelna}: ${d.osoby} ${plural(d.osoby, ["osoba", "osoby", "osób"])}`}
        onClick={() => wybierzDzien(d.day)}
        className="kb-dk"
      >
        <small>
          {tydzien} · {data}
        </small>
        <span className="kb-dk-tytul">{tytul}</span>
        <span className="kb-dk-ile">
          <b className="font-display tabular-nums">{gotowe ? d.osoby : "·"}</b>
          <span>{plural(d.osoby, ["osoba", "osoby", "osób"])}</span>
        </span>
        <span className="kb-dk-slupki" aria-hidden>
          {GODZINY.map((h) => {
            const n = sloty.find((s) => s.hour === h)?.people ?? 0;
            const terazTu = gotowe && o.dzis && h === godzinaTeraz;
            return (
              <i
                key={h}
                data-stan={terazTu ? "teraz" : n ? "jest" : undefined}
                style={{ height: `${n ? Math.max(14, (n / max) * 100) : 6}%` }}
              />
            );
          })}
        </span>
        <span className="kb-dk-os" aria-hidden>
          <span>7</span>
          <span>15</span>
          <span>23</span>
        </span>
        <span className="kb-dk-opis">
          {d.osoby && godziny.length ? (
            <>
              {g2(Math.min(...godziny))}-{g2(Math.max(...godziny) + 1)}
              {szczyt && (
                <>
                  <br />
                  najwięcej o {g2(szczyt.hour)}
                </>
              )}
            </>
          ) : d.osoby ? (
            " "
          ) : (
            "Jeszcze nikt - bądź pierwszy."
          )}
        </span>
      </button>
    );
  };

  return (
    <section className="kb-sekcja" aria-labelledby="kto-gra">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 id="kto-gra" className="kb-tytul">
            Kto dziś gra
          </h2>
          {teraz > 0 && (
            <p className="kb-teraz mt-1">
              Teraz {teraz} {plural(teraz, ["osoba", "osoby", "osób"])} na boisku
            </p>
          )}
        </div>
        <div className="kb-strzalki">
          <button type="button" onClick={() => przewin(-1)} aria-label="Wcześniejsze dni" className="kb-kolko">
            <IkStrzalka className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={() => przewin(1)} aria-label="Dalsze dni" className="kb-kolko">
            <IkStrzalka className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={pas} className="kb-dk-pas" role="radiogroup" aria-label="Dzień gry">
        {dni.slice(0, 1).map(karta)}
        <div className="kb-dk kb-dk-qr">
          <div className="kb-dk-kod">{kodQr}</div>
          <p>
            Zaproś ekipę
            <span>Zeskanują i dopiszą się do gry jednym ruchem.</span>
          </p>
        </div>
        {dni.slice(1).map(karta)}
      </div>
    </section>
  );
}
