"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { plural } from "@/lib/site";

interface Brak {
  id: string;
  slug: string;
  name: string;
  city: string;
  zdjecia: number;
  brak_zdjec: boolean;
  brak_godzin: boolean;
  krotki_opis: boolean;
  brak_nawierzchni: boolean;
}

/**
 * Raport „co uzupełnić" - lista opublikowanych boisk z lukami w danych.
 *
 * Przy imporcie z OpenStreetMap większość wpisów trafi na mapę bez zdjęć i bez godzin.
 * Ta zakładka zamienia tę zaległość w konkretną listę zadań, zamiast zgadywania,
 * które boisko wymaga jeszcze pracy.
 */
export function BrakiAdmin() {
  const [rows, setRows] = useState<Brak[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = supabaseBrowser();

    // setState wyłącznie w callbacku obietnicy - synchroniczny setState w ciele efektu
    // wywołuje kaskadę renderów
    const load = async (): Promise<{ rows: Brak[]; error: string | null }> => {
      if (!supabase) return { rows: [], error: null };
      const { data, error: err } = await supabase
        .from("courts_braki")
        .select("*")
        .order("created_at", { ascending: false });
      return { rows: (data ?? []) as Brak[], error: err?.message ?? null };
    };

    load()
      .then((res) => {
        if (!alive) return;
        if (res.error) setError(res.error);
        setRows(res.rows);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        {error} - jeśli widok nie istnieje, wgraj migrację{" "}
        <code>supabase/migration-zagram-dzis.sql</code>.
      </p>
    );
  }

  if (!rows) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">Wczytuję…</p>
    );
  }

  const doPoprawy = rows.filter(
    (r) => r.brak_zdjec || r.brak_godzin || r.krotki_opis || r.brak_nawierzchni
  );

  if (!doPoprawy.length) {
    return (
      <div className="glass rounded-[24px] p-10 text-center">
        <p className="text-[15px] text-muted">
          Wszystkie {rows.length} {plural(rows.length, ["boisko ma", "boiska mają", "boisk ma"])}{" "}
          zdjęcia, godziny, nawierzchnię i porządny opis. Nic do uzupełnienia.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-[14px] text-muted">
        {doPoprawy.length} z {rows.length}{" "}
        {plural(rows.length, ["boiska", "boisk", "boisk"])} wymaga uzupełnienia.
      </p>

      <div className="space-y-2">
        {doPoprawy.map((r) => (
          <div key={r.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
            <span className="min-w-0 flex-1">
              <Link
                href={`/boisko/${r.slug}`}
                className="block truncate text-[15px] font-semibold transition hover:text-flame"
              >
                {r.name}
              </Link>
              <span className="text-[13px] text-muted">{r.city}</span>
            </span>

            <span className="flex flex-wrap gap-1.5">
              {r.brak_zdjec && <Tag>bez zdjęć</Tag>}
              {!r.brak_zdjec && r.zdjecia < 6 && <Tag soft>{r.zdjecia} zdjęć</Tag>}
              {r.brak_godzin && <Tag>bez godzin</Tag>}
              {r.brak_nawierzchni && <Tag>bez nawierzchni</Tag>}
              {r.krotki_opis && <Tag soft>krótki opis</Tag>}
            </span>

            <Link
              href={`/admin?edytuj=${r.slug}`}
              className="shrink-0 rounded-full flame-gradient px-4 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110"
            >
              uzupełnij
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ children, soft = false }: { children: React.ReactNode; soft?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] ${
        soft
          ? "border border-hairline bg-white/5 text-muted"
          : "border border-ember/45 bg-ember/12 text-ember"
      }`}
    >
      {children}
    </span>
  );
}
