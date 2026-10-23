"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  MAKS_TAGOW,
  MAKS_ZNAKOW,
  SLOWO_OCENY,
  TAGI_OPINII,
  type Opinia,
  type TagOpinii,
  ocenaTekstem,
  statystyki,
  usunOpinie,
  ustawPomocne,
  zapiszOpinie,
} from "@/lib/opinie";
import { plural } from "@/lib/site";
import { useBramka } from "../BramkaLogowania";
import { Arkusz } from "./Arkusz";
import { useOpinie } from "./KartaKontekst";
import { IkGwiazda, IkKciuk, IkOlowek, IkPinezka, IkStrzalka } from "./ikony";

/** Ile opinii graczy widać od razu - reszta po „Pokaż wszystkie". */
const NA_START = 2;

export interface PrzypietaOpinia {
  nick: string;
  /** adres profilu albo `null` (zgłoszenie bez konta) */
  profil: string | null;
  avatar: string | null;
  dodane: string;
  tekst: string;
}

const data = (iso: string) => new Date(iso).toLocaleDateString("pl-PL");

/**
 * „Oceny i opinie" (prototyp 10).
 *
 * Na górze zawsze PRZYPIĘTA opinia osoby, która dodała boisko: jej opis był dotąd sekcją
 * „O boisku", a jest dokładnie tym samym, czym opinia - jednym głosem człowieka, który tam był.
 * Pod nią dwie najnowsze opinie graczy, reszta po rozwinięciu.
 *
 * Ocenić boisko można jednym dotknięciem gwiazdki - arkusz otwiera się z tą oceną już
 * zaznaczoną, a tagi i tekst są dodatkiem.
 */
export function Opinie({ courtId, przypieta }: { courtId: string; przypieta: PrzypietaOpinia }) {
  const { dostepne, lista, gotowe, odswiez } = useOpinie();
  const { wymagaj } = useBramka();
  const [wszystkie, setWszystkie] = useState(false);
  const [arkusz, setArkusz] = useState<{ ocena: number; edycja: Opinia | null } | null>(null);

  const moja = lista.find((o) => o.moja) ?? null;
  const cudze = lista.filter((o) => !o.moja);
  const widoczne = wszystkie ? cudze : cudze.slice(0, NA_START);
  const s = statystyki(lista);

  const ocen = async (ocena: number) => {
    if (!(await wymagaj("ocenić boisko"))) return;
    setArkusz({ ocena, edycja: null });
  };

  const zamknij = useCallback(() => setArkusz(null), []);

  const zaprosDoOceny = dostepne && gotowe && !moja;

  /* gwiazdki „Oceń boisko" - na telefonie nad opiniami, na komputerze pod nimi */
  const ocena = (gdzie: "tel" | "pc") => (
    <div className={`kb-opinie-ocen kb-opinie-ocen-${gdzie}`}>
      <span>
        <b>Oceń boisko</b>
        <span>Jedno dotknięcie wystarczy - reszta jest opcjonalna.</span>
      </span>
      <span className="flex" role="group" aria-label="Twoja ocena">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => void ocen(n)} aria-label={`${n} na 5 - ${SLOWO_OCENY[n]}`} className="kb-gwiazda">
            <IkGwiazda className="h-[26px] w-[26px]" />
          </button>
        ))}
      </span>
    </div>
  );

  return (
    <section id="opinie" className="kb-sekcja kb-opinie scroll-mt-24" aria-labelledby="opinie-tytul">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="opinie-tytul" className="kb-tytul">
          Oceny i opinie
        </h2>
        {cudze.length > NA_START && (
          <button type="button" onClick={() => setWszystkie((w) => !w)} className="kb-link">
            {wszystkie ? "Mniej" : `Wszystkie ${cudze.length}`}
            <IkStrzalka className={`h-3.5 w-3.5 transition-transform ${wszystkie ? "-rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {/* średnia dużym pismem i rozkład ocen - bez ramki, z poświatą pod liczbą */}
      {dostepne && (
        <div className="kb-opinie-podsum">
          <div className="kb-opinie-srednia">
            <p className="font-display tabular-nums">{s.srednia !== null ? ocenaTekstem(s.srednia) : "–"}</p>
            <div>
              {s.srednia !== null && <Gwiazdki ocena={Math.round(s.srednia)} />}
              <span>{s.liczba ? `na 5 · ${s.liczba} ${plural(s.liczba, ["opinia", "opinie", "opinii"])}` : "brak ocen"}</span>
            </div>
          </div>
          <div className="grid gap-[5px]" aria-hidden>
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="grid grid-cols-[52px_minmax(0,1fr)_14px] items-center gap-2">
                <Gwiazdki ocena={n} z={n} mala />
                <span className="kb-pasek">
                  <i style={{ width: s.liczba ? `${(s.rozklad[n] / s.liczba) * 100}%` : "0%" }} />
                </span>
                <span className="text-right text-[11px] tabular-nums text-faint">{s.rozklad[n]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {zaprosDoOceny && ocena("tel")}

      <div className="kb-opinie-lista">
        <Przypieta o={przypieta} />

        {moja && (
          <KartaOpinii
            o={moja}
            naglowek="Twoja opinia"
            akcja={
              <button type="button" onClick={() => setArkusz({ ocena: moja.ocena, edycja: moja })} className="kb-chip-przycisk">
                <IkOlowek className="h-3.5 w-3.5" /> Edytuj
              </button>
            }
          />
        )}

        {widoczne.map((o) => (
          <KartaOpinii key={o.id} o={o} akcja={<Pomocne o={o} onZmiana={odswiez} />} />
        ))}
      </div>

      {!wszystkie && cudze.length > NA_START && (
        <button type="button" onClick={() => setWszystkie(true)} className="kb-opinie-wiecej">
          Pokaż wszystkie opinie ({cudze.length})
        </button>
      )}

      {zaprosDoOceny && ocena("pc")}

      {arkusz && (
        <ArkuszOpinii
          courtId={courtId}
          poczatek={arkusz}
          onZamknij={zamknij}
          onZapisano={() => {
            setArkusz(null);
            odswiez();
          }}
        />
      )}
    </section>
  );
}

function Gwiazdki({ ocena, z = 5, mala = false }: { ocena: number; z?: number; mala?: boolean }) {
  return (
    <span className="flex justify-end gap-px" aria-label={`${ocena} na 5`}>
      {Array.from({ length: z }, (_, i) => (
        <IkGwiazda
          key={i}
          className={mala ? "h-[9px] w-[9px]" : "h-3 w-3"}
          fill={i < ocena ? "currentColor" : "none"}
          style={{ color: i < ocena ? "var(--color-ink)" : "var(--color-faint)" }}
        />
      ))}
    </span>
  );
}

function Avatar({ nick, avatar }: { nick: string; avatar: string | null }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--k-wyp-2)] text-[13px] font-bold">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={36} height={36} className="h-full w-full object-cover" />
      ) : (
        nick.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** Opis osoby, która dodała boisko - przypięty nad opiniami graczy. */
function Przypieta({ o }: { o: PrzypietaOpinia }) {
  const nick = <b className="text-[15px] font-semibold">@{o.nick}</b>;
  return (
    <article className="kb-opinia kb-opinia-przypieta">
      <div className="flex items-center gap-3">
        <Avatar nick={o.nick} avatar={o.avatar} />
        <div className="min-w-0 flex-1">
          {o.profil ? <Link href={o.profil}>{nick}</Link> : nick}
          <p className="text-[12.5px] text-faint">dodał(a) boisko · {data(o.dodane)}</p>
        </div>
        <span className="kb-przypiete">
          <IkPinezka className="h-3 w-3" /> Przypięte
        </span>
      </div>
      {o.tekst ? (
        <p className="mt-3 text-[15px] leading-[1.55] text-ink/90">{o.tekst}</p>
      ) : (
        <p className="mt-3 text-[14px] leading-snug text-muted">Dodał(a) to boisko do mapy - dzięki temu możesz tu zagrać.</p>
      )}
    </article>
  );
}

function KartaOpinii({ o, naglowek, akcja }: { o: Opinia; naglowek?: string; akcja: React.ReactNode }) {
  return (
    <article className="kb-opinia">
      {naglowek && <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{naglowek}</p>}
      <div className="flex items-center gap-3">
        <Avatar nick={o.nick} avatar={o.avatar} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold">{o.nick}</b>
          <div className="mt-0.5 flex items-center gap-2">
            <Gwiazdki ocena={o.ocena} />
            <span className="text-[12px] text-faint">{data(o.dodana)}</span>
          </div>
        </div>
      </div>
      {o.tekst && <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.55] text-ink/90">{o.tekst}</p>}
      {o.tagi.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {o.tagi.map((t) => (
            <span key={t} className="kb-tag">
              {TAGI_OPINII[t]}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3">{akcja}</div>
    </article>
  );
}

function Pomocne({ o, onZmiana }: { o: Opinia; onZmiana: () => void }) {
  const { wymagaj } = useBramka();
  const [moja, setMoja] = useState(o.pomocnaDlaMnie);
  const [ile, setIle] = useState(o.pomocne);

  const przelacz = async () => {
    if (!(await wymagaj("oznaczyć opinię jako pomocną"))) return;
    const next = !moja;
    setMoja(next);
    setIle((n) => n + (next ? 1 : -1));
    try {
      await ustawPomocne(o.id, next);
    } catch {
      setMoja(!next);
      setIle((n) => n + (next ? -1 : 1));
      return;
    }
    onZmiana();
  };

  return (
    <button type="button" onClick={() => void przelacz()} aria-pressed={moja} className="kb-chip-przycisk">
      <IkKciuk className="h-3.5 w-3.5" /> Pomocne{ile > 0 ? ` (${ile})` : ""}
    </button>
  );
}

function ArkuszOpinii({
  courtId,
  poczatek,
  onZamknij,
  onZapisano,
}: {
  courtId: string;
  poczatek: { ocena: number; edycja: Opinia | null };
  onZamknij: () => void;
  onZapisano: () => void;
}) {
  const e = poczatek.edycja;
  const [ocena, setOcena] = useState(poczatek.ocena);
  const [tagi, setTagi] = useState<TagOpinii[]>(e?.tagi ?? []);
  const [tekst, setTekst] = useState(e?.tekst ?? "");
  const [busy, setBusy] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const przelaczTag = (t: TagOpinii) =>
    setTagi((obecne) =>
      obecne.includes(t) ? obecne.filter((x) => x !== t) : obecne.length < MAKS_TAGOW ? [...obecne, t] : obecne
    );

  const zapisz = async () => {
    setBusy(true);
    setBlad(null);
    try {
      await zapiszOpinie(courtId, { ocena, tagi, tekst }, e?.id);
      onZapisano();
    } catch (err) {
      setBlad((err as Error).message);
      setBusy(false);
    }
  };

  const usun = async () => {
    if (!e) return;
    setBusy(true);
    try {
      await usunOpinie(e.id);
      onZapisano();
    } catch (err) {
      setBlad((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Arkusz tytul={e ? "Twoja opinia" : "Oceń boisko"} onZamknij={onZamknij}>
      <div className="mt-3 flex justify-center" role="radiogroup" aria-label="Ocena">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={ocena === n}
            aria-label={`${n} na 5`}
            onClick={() => setOcena(n)}
            className="kb-gwiazda kb-gwiazda-duza"
            data-pelna={n <= ocena}
          >
            <IkGwiazda className="h-9 w-9" />
          </button>
        ))}
      </div>
      <p className="mt-1 min-h-5 text-center text-[14px] font-semibold text-muted">{SLOWO_OCENY[ocena]}</p>

      <p className="mb-2.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        Co warto wiedzieć? <span className="font-normal normal-case tracking-normal text-faint">do {MAKS_TAGOW}, opcjonalnie</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TAGI_OPINII) as TagOpinii[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tagi.includes(t)}
            onClick={() => przelaczTag(t)}
            className="kb-wybor"
          >
            {TAGI_OPINII[t]}
          </button>
        ))}
      </div>

      <p className="mb-2.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        Kilka słów <span className="font-normal normal-case tracking-normal text-faint">opcjonalnie</span>
      </p>
      <div className="relative">
        <textarea
          value={tekst}
          maxLength={MAKS_ZNAKOW}
          onChange={(ev) => setTekst(ev.target.value)}
          rows={4}
          placeholder="Jak się tu gra? Obręcze, ludzie, najlepsza pora…"
          className="kb-pole"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11.5px] tabular-nums text-faint">
          {tekst.length}/{MAKS_ZNAKOW}
        </span>
      </div>

      {blad && <p className="mt-3 text-[13px] leading-snug text-ink">{blad}</p>}

      <button type="button" onClick={() => void zapisz()} disabled={busy} className="kb-bialy mt-5 w-full">
        {busy ? "Zapisuję…" : e ? "Zapisz zmiany" : "Dodaj opinię"}
      </button>
      {e && (
        <button
          type="button"
          onClick={() => void usun()}
          disabled={busy}
          className="mt-2 w-full rounded-full py-2.5 text-[13.5px] font-semibold text-muted"
        >
          Usuń opinię
        </button>
      )}
    </Arkusz>
  );
}

/**
 * Komórka „Opinie" w pasku pod nazwą boiska (prototyp 01): średnia i gwiazdki, a dotknięcie
 * przewija do sekcji opinii. Bez opinii stoi kreska - zero gwiazdek czytałoby się jak ocena.
 */
export function KomorkaOpinii() {
  const { lista, gotowe } = useOpinie();
  const s = statystyki(lista);
  return (
    <a href="#opinie" className="kb-info-komorka">
      <small>{s.liczba ? `${s.liczba} ${plural(s.liczba, ["opinia", "opinie", "opinii"])}` : "Opinie"}</small>
      <b className="tabular-nums">{s.srednia !== null ? ocenaTekstem(s.srednia) : "–"}</b>
      <span>{s.srednia !== null ? <Gwiazdki ocena={Math.round(s.srednia)} /> : gotowe ? "brak ocen" : " "}</span>
    </a>
  );
}
