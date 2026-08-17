"use client";

import { useMemo, useState } from "react";
import { useFeedback } from "@/lib/feedback";

/** Opinie od użytkowników — najnowsze na górze, z możliwością odhaczenia. */
export function FeedbackAdmin() {
  const { items, loading, error, setStatus, remove } = useFeedback();
  const [tab, setTab] = useState<"open" | "done">("open");

  const visible = useMemo(() => items.filter((f) => f.status === tab), [items, tab]);

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję opinie…
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
            ["open", "Nowe"],
            ["done", "Załatwione"],
          ] as ["open" | "done", string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2 text-[12px] font-medium transition ${
              tab === k ? "bg-white/14 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}{" "}
            <span className="opacity-70">({items.filter((f) => f.status === k).length})</span>
          </button>
        ))}
      </div>

      {!visible.length && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          {tab === "open" ? "Brak nowych opinii." : "Nic tu jeszcze nie ma."}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((f) => (
          <article key={f.id} className="glass rounded-[22px] p-5">
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{f.message}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3 text-[12px] text-faint">
              <span>{new Date(f.created_at).toLocaleString("pl-PL")}</span>
              <span>{f.author_id ? "użytkownik z kontem" : "gość"}</span>
              {f.contact && <span className="text-muted">kontakt: {f.contact}</span>}

              <span className="ml-auto flex items-center gap-2">
                {f.status === "open" ? (
                  <button
                    onClick={() => setStatus(f.id, "done")}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted transition hover:text-ink"
                  >
                    załatwione
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus(f.id, "open")}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted transition hover:text-ink"
                  >
                    wróć do nowych
                  </button>
                )}
                <button
                  onClick={() => remove(f.id)}
                  className="px-2 text-[12px] text-faint transition hover:text-ember"
                >
                  usuń
                </button>
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
