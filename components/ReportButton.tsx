"use client";

import { useState } from "react";
import { REPORT_REASONS, ReportReason, sendReport } from "@/lib/reports";
import { supabaseEnabled } from "@/lib/supabase/config";

/** „Zgłoś błąd" na karcie boiska — dostępne również bez konta. */
export function ReportButton({ courtId }: { courtId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("godziny");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setState("sending");
    setError(null);
    try {
      await sendReport(courtId, reason, comment);
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-3 text-[13px] text-faint transition hover:text-muted"
      >
        Zgłoś błąd
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-md rounded-[26px] p-6 rise"
          >
            {state === "sent" ? (
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full flame-gradient text-[26px] text-black">
                  ✓
                </span>
                <h2 className="mt-4 text-[20px] font-semibold tracking-tight">Dzięki!</h2>
                <p className="mt-2 text-[14px] text-muted">
                  Zgłoszenie trafiło do panelu. Sprawdzimy dane i poprawimy wpis.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black"
                >
                  Zamknij
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[20px] font-semibold tracking-tight">Coś się nie zgadza?</h2>
                <p className="mt-1.5 text-[13px] text-muted">
                  Zaznacz, co jest nie tak. Zgłoszenie jest anonimowe — konto nie jest potrzebne.
                </p>

                <div className="mt-5 space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition ${
                        reason === r.value
                          ? "border-flame/60 bg-flame/12 text-ink"
                          : "border-hairline bg-white/4 text-muted hover:text-ink"
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          reason === r.value ? "border-flame" : "border-white/25"
                        }`}
                      >
                        {reason === r.value && (
                          <span className="h-2 w-2 rounded-full flame-gradient" />
                        )}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="field mt-4 px-4 py-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Szczegóły, np. „bramka zamykana o 20, nie o 22” (opcjonalnie)"
                    className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-faint"
                  />
                </div>

                {!supabaseEnabled && (
                  <p className="mt-3 text-[12px] text-faint">
                    Tryb testowy — zgłoszenia ruszą po podpięciu bazy.
                  </p>
                )}
                {error && <p className="mt-3 text-[12px] text-ember">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-hairline bg-white/5 px-5 py-3 text-[14px] font-medium text-muted transition hover:text-ink"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={submit}
                    disabled={state === "sending"}
                    className="flex-1 rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black disabled:opacity-40"
                  >
                    {state === "sending" ? "Wysyłam…" : "Wyślij zgłoszenie"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
