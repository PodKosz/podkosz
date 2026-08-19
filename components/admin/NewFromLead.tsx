"use client";

import { useEffect, useState } from "react";
import { Lead, getLead } from "@/lib/leads";
import { CourtValues } from "@/lib/admin";
import { Surface } from "@/lib/types";
import { CourtForm } from "./CourtForm";

/**
 * Dodawanie boiska z kandydata OSM: wstawiamy współrzędne i podpowiedzi z tagów,
 * a miasto i województwo dociągają się same z pinezki w formularzu.
 */
export function NewFromLead({ leadId, onSaved }: { leadId: string; onSaved: (slug: string) => void }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLead(leadId)
      .then((found) => {
        if (!alive) return;
        if (!found) setError("Nie znalazłem tego kandydata - mógł już zostać przejrzany.");
        else setLead(found);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [leadId]);

  if (error) {
    return (
      <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        {error}
      </p>
    );
  }

  if (!lead) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję kandydata…
      </p>
    );
  }

  const prefill: Partial<CourtValues> = {
    name: lead.name,
    lat: lead.lat,
    lng: lead.lng,
    surface: (lead.surface as Surface) ?? "beton",
    hoops: lead.hoops ?? 2,
    lit: lead.lit ?? false,
  };

  return (
    <div>
      <div className="glass mb-5 rounded-[20px] px-4 py-3 text-[13px] text-muted">
        Z kandydata OpenStreetMap:{" "}
        <b className="text-ink">{lead.name || "boisko bez nazwy"}</b> ·{" "}
        <span className="tabular-nums">
          {lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}
        </span>
        {lead.access_hint && ` · w OSM oznaczone jako dostęp „${lead.access_hint}”`}
        . Sprawdź pinezkę, wpisz nazwę i wrzuć zdjęcia - po zapisie kandydat zniknie z mapy.
      </div>
      <CourtForm prefill={prefill} leadId={lead.id} onSaved={onSaved} />
    </div>
  );
}
