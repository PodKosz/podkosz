"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { DNI_NAPRZOD, dodajDni, opisDnia, type CheckinSlot } from "@/lib/checkins";
import { terazWPolsce } from "@/lib/godziny-otwarcia";
import { plural } from "@/lib/site";
import { Arkusz } from "./Arkusz";
import { useGra } from "./KartaKontekst";
import { IkKodQr } from "./ikony";

/* zakres osi - godziny, w które da się zapisać */
const OD = 7;
const DO = 22;
/* pole wykresu w jednostkach viewBox: wysokość, góra i dół krzywej */
const W = 1000;
const H = 150;
const GORA = 22;
const DOL = 128;
const OS = [7, 10, 13, 16, 19, 22];

const g2 = (h: number) => `${String(h).padStart(2, "0")}:00`;
const x = (h: number) => ((h - OD) / (DO + 1 - OD)) * W;

/**
 * Gładka krzywa przez punkty - spline monotoniczny (Fritsch-Carlson). Zwykły Catmull-Rom
 * robiłby między dwiema pustymi godzinami brzuszek poniżej zera, czyli „minus jedną osobę".
 */
function sciezka(p: [number, number][]) {
  const n = p.length;
  const dx: number[] = [];
  const dy: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0]);
    dy.push((p[i + 1][1] - p[i][1]) / dx[i]);
  }
  const m = [dy[0]];
  for (let i = 1; i < n - 1; i++) m.push(dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2);
  m.push(dy[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / dy[i];
    const b = m[i + 1] / dy[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * dy[i];
      m[i + 1] = t * b * dy[i];
    }
  }
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${p[i][0] + h} ${p[i][1] + m[i] * h} ${p[i + 1][0] - h} ${p[i + 1][1] - m[i + 1] * h} ${p[i + 1][0]} ${p[i + 1][1]}`;
  }
  return d;
}

/**
 * „Kto dziś gra" - oś dnia (prototyp 01 z `podkosz-karty/kto-gra`): krzywa mówi, ile osób
 * będzie na boisku o każdej godzinie, zielona kreska to „teraz". Bez ramki - sekcja leży wprost
 * na stronie, a wykres gaśnie przy krawędziach.
 *
 * W sekcji jest tylko informacja. Zapis robi przyklejony „Idę zagrać" na dole ekranu, a wybór
 * dnia tutaj przestawia dzień także w nim. Kod QR dla ekipy - pod ikoną w nagłówku.
 */
export function KtoDzisGra({ kodQr }: { kodQr: ReactNode }) {
  const { dzien, wybierzDzien, panel, gotowe, godzinyDnia } = useGra();
  const [kod, setKod] = useState(false);
  const [podKursorem, setPodKursorem] = useState<number | null>(null);
  const wykres = useRef<HTMLDivElement>(null);
  const zamknijKod = useCallback(() => setKod(false), []);

  const dni =
    panel.tydzien ??
    Array.from({ length: DNI_NAPRZOD }, (_, i) => {
      const d = dodajDni(panel.dzis, i);
      return { day: d, osoby: d === panel.dzien ? panel.osoby : 0 };
    });
  const wybranyDzien = dni.find((d) => d.day === dzien) ?? dni[0];
  const osoby = wybranyDzien?.osoby ?? 0;
  const opis = opisDnia(dzien, panel.dzis);
  const [nazwa, data] = opis.pelna.split(" ");

  const sloty: CheckinSlot[] = godzinyDnia(dzien);
  const ile = (h: number) => sloty.find((s) => s.hour === h)?.people ?? 0;
  const max = Math.max(4, ...dni.flatMap((d) => godzinyDnia(d.day).map((s) => s.people)));
  const y = (n: number) => DOL - (n / max) * (DOL - GORA);

  /* punkt w środku każdej godziny plus zera na brzegach - krzywa zaczyna się i kończy na dole */
  const godziny = Array.from({ length: DO - OD + 1 }, (_, i) => OD + i);
  const punkty: [number, number][] = [[0, DOL], ...godziny.map((h): [number, number] => [x(h + 0.5), y(ile(h))]), [W, DOL]];
  const linia = sciezka(punkty);
  const pole = `${linia} L${W} ${DOL} L0 ${DOL} Z`;

  const szczyt = sloty.reduce<CheckinSlot | null>((n, s) => (!n || s.people > n.people ? s : n), null);
  const zakres = sloty.length ? `${g2(Math.min(...sloty.map((s) => s.hour)))}-${g2(Math.max(...sloty.map((s) => s.hour)) + 1)}` : "";

  /* „teraz" liczymy dopiero po danych z bazy - serwer budował stronę o innej godzinie */
  const t = terazWPolsce();
  const terazGodz = t.minuta / 60;
  const pokazTeraz = gotowe && opis.dzis && terazGodz >= OD && terazGodz < DO + 1;
  const terazIle = opis.dzis ? ile(Math.floor(terazGodz)) : 0;

  const kiedy = opis.dzis ? "dziś" : opis.kiedy;
  const czasownik = plural(osoby, ["osoba gra", "osoby grają", "osób gra"]).replace(/^\d+\s/, "");

  const naKursor = (clientX: number) => {
    const r = wykres.current?.getBoundingClientRect();
    if (!r || !osoby) return;
    const fr = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width));
    setPodKursorem(Math.floor(OD + fr * (DO + 1 - OD)));
  };

  return (
    <section className="kb-sekcja" aria-labelledby="kto-gra">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="kto-gra" className="kb-tytul">
          Kto dziś gra
        </h2>
        <button type="button" onClick={() => setKod(true)} aria-label="Kod QR dla ekipy" title="Kod QR dla ekipy" className="kb-kolko kb-kolko-hover">
          <IkKodQr className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="kb-os-dni" role="radiogroup" aria-label="Dzień gry">
        {dni.map((d) => {
          const o = opisDnia(d.day, panel.dzis);
          return (
            <button
              key={d.day}
              type="button"
              role="radio"
              aria-checked={d.day === dzien}
              aria-label={`${o.pelna}: ${d.osoby} ${plural(d.osoby, ["osoba", "osoby", "osób"])}`}
              onClick={() => wybierzDzien(d.day)}
              className="kb-os-dzien"
            >
              {o.krotko} <b className="tabular-nums">{gotowe ? d.osoby || "–" : "·"}</b>
            </button>
          );
        })}
      </div>

      <div className="kb-os-srodek">
        <div>
          <div className="flex items-end gap-3">
            <span className="font-display text-[64px] leading-[0.86] tabular-nums">{gotowe ? osoby : "–"}</span>
            <p className="pb-1 text-[15px] font-semibold leading-tight">
              {czasownik} {kiedy}
              <span className="block text-[13.5px] font-medium text-muted">
                {nazwa} {data}
              </span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-muted">
            {pokazTeraz && terazIle > 0 && (
              <span className="kb-teraz">
                Teraz {terazIle} {plural(terazIle, ["osoba", "osoby", "osób"])}
              </span>
            )}
            {szczyt && (
              <span>
                Najwięcej o {g2(szczyt.hour)} · {szczyt.people} {plural(szczyt.people, ["osoba", "osoby", "osób"])}
              </span>
            )}
            {zakres && <span>Grają {zakres}</span>}
          </div>
        </div>

        <div className="min-w-0">
          <div
            ref={wykres}
            className="kb-os-wykres"
            aria-label="Ile osób gra o której godzinie"
            onPointerMove={(e) => naKursor(e.clientX)}
            onPointerDown={(e) => naKursor(e.clientX)}
            onPointerLeave={() => setPodKursorem(null)}
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="kb-os-pole" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--color-ink)" stopOpacity="0.22" />
                  <stop offset="1" stopColor="var(--color-ink)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2={W} y1={GORA + (DOL - GORA) * f} y2={GORA + (DOL - GORA) * f} className="kb-os-siatka" vectorEffect="non-scaling-stroke" />
              ))}
              <line x1="0" x2={W} y1={DOL} y2={DOL} className="kb-os-dno" vectorEffect="non-scaling-stroke" />
              {osoby > 0 && (
                <>
                  <path d={pole} fill="url(#kb-os-pole)" />
                  <path d={linia} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </>
              )}
              {pokazTeraz && (
                <line x1={x(terazGodz)} x2={x(terazGodz)} y1="6" y2={DOL} stroke="#30d158" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              )}
              {podKursorem !== null && (
                <line x1={x(podKursorem + 0.5)} x2={x(podKursorem + 0.5)} y1={GORA - 8} y2={DOL} className="kb-os-prowadnica" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {szczyt && (
              <span className="kb-os-szczyt" style={{ left: `${(x(szczyt.hour + 0.5) / W) * 100}%`, top: `${(y(szczyt.people) / H) * 100}%` }}>
                <span>{szczyt.people}</span>
              </span>
            )}
            {podKursorem !== null && (
              <span
                className="kb-os-dymek"
                style={{ left: `${(x(podKursorem + 0.5) / W) * 100}%`, top: `${(y(ile(podKursorem)) / H) * 100}%` }}
              >
                {g2(podKursorem)}{" "}
                <span>· {ile(podKursorem) ? `${ile(podKursorem)} ${plural(ile(podKursorem), ["osoba", "osoby", "osób"])}` : "pusto"}</span>
              </span>
            )}
            {gotowe && !osoby && (
              <p className="kb-os-pusto">
                Na ten dzień jeszcze nikt się nie zapisał.
                <br />
                Bądź pierwszy - przycisk na dole.
              </p>
            )}
          </div>
          <div className="kb-os-os" aria-hidden>
            {OS.map((h) => (
              <span key={h}>{h}:00</span>
            ))}
          </div>
        </div>
      </div>

      {kod && (
        <Arkusz tytul="Zeskanuj i zagraj" onZamknij={zamknijKod}>
          <div className="mt-2 flex items-center gap-4">
            <div className="kb-os-kod">{kodQr}</div>
            <div>
              <p className="text-[16px] font-semibold">Kod dla ekipy</p>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">
                Pokaż kolegom - zeskanują i od razu zapiszą się na grę na tym boisku.
              </p>
            </div>
          </div>
        </Arkusz>
      )}
    </section>
  );
}
