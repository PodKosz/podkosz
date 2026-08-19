"use client";

import { useState } from "react";
import Link from "next/link";
import { Lead, LeadStatus, importOsmLeads, setLeadStatus, useLeads } from "@/lib/leads";
import { SURFACE_LABEL, Surface } from "@/lib/types";

const TABS: [LeadStatus, string][] = [
  ["new", "Do sprawdzenia"],
  ["added", "Dodane"],
  ["rejected", "Odrzucone"],
];

/**
 * Kandydaci z OpenStreetMap: import całej Polski jednym przyciskiem i lista do przeglądania.
 * Kandydatów jest kilka tysięcy, więc główną przeglądarką jest mapa (szare pinezki) -
 * tutaj jest import, licznik i podręczna lista ostatnich wpisów.
 */
export function LeadsAdmin() {
  const [tab, setTab] = useState<LeadStatus>("new");
  const { items, counts, loading, error, reload } = useLeads(tab);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const runImport = async () => {
    if (busy) return;
    setBusy(true);
    setImportError(null);
    setLog([]);
    try {
      await importOsmLeads((msg) => setLog((l) => [...l.slice(-6), msg]));
      await reload();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (lead: Lead, status: LeadStatus) => {
    await setLeadStatus(lead.id, status);
    await reload();
  };

  return (
    <div>
      <section className="glass rounded-[24px] p-5">
        <h2 className="text-[15px] font-semibold">Baza kandydatów z OpenStreetMap</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Import zaciąga z OSM wszystkie obiekty oznaczone jako boisko do koszykówki w Polsce
          (obecnie ponad 8 tysięcy). Nic nie trafia na mapę publicznie - punkty widzisz tylko Ty,
          jako szare pinezki po włączeniu przycisku „kandydaci OSM” na mapie. Klikasz pinezkę,
          dodajesz boisko ze zdjęciami, a kandydat znika z listy.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={runImport}
            disabled={busy}
            className="rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Importuję…" : counts.new + counts.added + counts.rejected > 0 ? "Odśwież z OSM" : "Zaciągnij boiska z OSM"}
          </button>
          <span className="text-[13px] text-muted">
            do sprawdzenia: <b className="text-ink">{counts.new}</b> · dodane:{" "}
            <b className="text-ink">{counts.added}</b> · odrzucone:{" "}
            <b className="text-ink">{counts.rejected}</b>
          </span>
        </div>

        {log.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-hairline pt-3 text-[12px] text-faint">
            {log.map((l, i) => (
              <li key={i}>· {l}</li>
            ))}
          </ul>
        )}

        {importError && (
          <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
            {importError}
          </p>
        )}

        <p className="mt-3 text-[11px] text-faint">
          Źródło: OpenStreetMap, licencja ODbL. Współrzędne traktujemy jako podpowiedź - nazwę,
          opis i zdjęcia i tak robisz sam.
        </p>
      </section>

      <div className="mt-6 mb-4 inline-flex gap-1 rounded-full border border-hairline bg-white/5 p-1">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2 text-[12px] font-medium transition ${
              tab === k ? "bg-white/14 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label} <span className="opacity-70">({counts[k]})</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {error}
        </p>
      )}

      {loading && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Wczytuję kandydatów…
        </p>
      )}

      {!loading && !items.length && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          {tab === "new"
            ? "Brak kandydatów - zacznij od importu z OSM."
            : "Nic tu jeszcze nie ma."}
        </p>
      )}

      <div className="space-y-2">
        {items.map((lead) => (
          <article
            key={lead.id}
            className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] px-4 py-3"
          >
            <span className="min-w-[200px] flex-1">
              <span className="block text-[14px] font-semibold">
                {lead.name || "Boisko bez nazwy"}
              </span>
              <span className="block text-[12px] tabular-nums text-muted">
                {lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}
                {lead.surface && ` · ${SURFACE_LABEL[lead.surface as Surface] ?? lead.surface}`}
                {lead.hoops ? ` · ${lead.hoops} kosz(e)` : ""}
                {lead.lit === true ? " · oświetlone" : ""}
                {lead.access_hint ? ` · dostęp: ${lead.access_hint}` : ""}
              </span>
            </span>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-muted transition hover:text-ink"
            >
              podejrzyj
            </a>

            {lead.status !== "added" && (
              <Link
                href={`/admin?nowe=${lead.id}`}
                className="rounded-xl border border-hairline bg-white/5 px-3.5 py-2 text-[12px] font-medium transition hover:bg-white/10"
              >
                dodaj boisko
              </Link>
            )}

            {lead.status === "new" ? (
              <button
                onClick={() => void move(lead, "rejected")}
                className="px-2 text-[12px] text-faint transition hover:text-ember"
              >
                odrzuć
              </button>
            ) : (
              <button
                onClick={() => void move(lead, "new")}
                className="px-2 text-[12px] text-faint transition hover:text-ink"
              >
                wróć do sprawdzenia
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
