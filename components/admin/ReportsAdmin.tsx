"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { REASON_LABEL, useReports } from "@/lib/reports";
import { PinIcon } from "../icons";

type Sort = "count" | "newest";

/** Boiska ze zgłoszonymi błędami — domyślnie te z największą liczbą zgłoszeń. */
export function ReportsAdmin() {
  const { courts, loading, error, resolve } = useReports();
  const [sort, setSort] = useState<Sort>("count");
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...courts];
    return sort === "count"
      ? list.sort((a, b) => b.openCount - a.openCount || b.newest.localeCompare(a.newest))
      : list.sort((a, b) => b.newest.localeCompare(a.newest));
  }, [courts, sort]);

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję zgłoszenia…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5 inline-flex gap-1 rounded-full border border-hairline bg-white/5 p-1">
        {(
          [
            ["count", "Najwięcej zgłoszeń"],
            ["newest", "Najnowsze"],
          ] as [Sort, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition ${
              sort === k ? "bg-white/14 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!sorted.length && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Brak otwartych zgłoszeń. Dane boisk nikogo nie uwierają.
        </p>
      )}

      <div className="space-y-3">
        {sorted.map((c) => (
          <article key={c.courtId} className="glass overflow-hidden rounded-[24px]">
            <button
              onClick={() => setOpenId(openId === c.courtId ? null : c.courtId)}
              className="flex w-full items-center gap-4 p-4 text-left"
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[17px] font-bold ${
                  c.openCount >= 3
                    ? "bg-ember/20 text-ember"
                    : "border border-hairline bg-white/5 text-ink"
                }`}
              >
                {c.openCount}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{c.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                  <span className="flex items-center gap-1">
                    <PinIcon className="h-3.5 w-3.5" /> {c.city}
                  </span>
                  <span>
                    ostatnie: {new Date(c.newest).toLocaleString("pl-PL")}
                  </span>
                  <span className="text-faint">
                    {[...new Set(c.reports.map((r) => REASON_LABEL[r.reason]))]
                      .slice(0, 2)
                      .join(" · ")}
                  </span>
                </span>
              </span>

              <span className="shrink-0 text-[12px] uppercase tracking-[0.12em] text-faint">
                {openId === c.courtId ? "zwiń" : "otwórz"}
              </span>
            </button>

            {openId === c.courtId && (
              <div className="border-t border-hairline p-5">
                <ul className="space-y-2">
                  {c.reports.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 rounded-xl border border-hairline bg-white/4 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold">
                          {REASON_LABEL[r.reason]}
                        </span>
                        {r.comment && (
                          <span className="mt-1 block text-[13px] leading-snug text-muted">
                            „{r.comment}”
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-faint">
                          {new Date(r.created_at).toLocaleString("pl-PL")} ·{" "}
                          {r.reporter_id ? "użytkownik z kontem" : "gość"}
                        </span>
                      </span>
                      <button
                        onClick={() => resolve([r.id])}
                        className="shrink-0 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted transition hover:text-ink"
                      >
                        załatwione
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/boisko/${c.slug}`}
                    className="glass rounded-2xl px-5 py-3 text-[13px] font-medium"
                  >
                    Zobacz kartę boiska
                  </Link>
                  <button
                    onClick={() => resolve(c.reports.map((r) => r.id))}
                    className="rounded-2xl flame-gradient px-5 py-3 text-[13px] font-bold text-black"
                  >
                    Zamknij wszystkie ({c.openCount})
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-faint">
                  Dane poprawisz w zakładce „Boiska na mapie” → Edytuj.
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
