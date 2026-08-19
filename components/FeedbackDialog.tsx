"use client";

import { useState } from "react";
import { sendFeedback } from "@/lib/feedback";
import { supabaseEnabled } from "@/lib/supabase/config";

/** Okienko „co możemy poprawić" - otwierane przyciskiem podanym w children. */
export function FeedbackDialog({ label = "Co możemy poprawić?" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (message.trim().length < 3) {
      setError("Napisz choć kilka słów - inaczej nie będę wiedział, co poprawić.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      await sendFeedback(message, contact);
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
        className="rounded-2xl border border-hairline bg-white/6 px-6 py-3.5 text-[14px] font-medium transition hover:bg-white/10"
      >
        {label}
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
                  Czytam wszystko, co przychodzi. Jeśli zostawiłeś kontakt, odpiszę.
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
                <h2 className="text-[20px] font-semibold tracking-tight">Co możemy poprawić?</h2>
                <p className="mt-1.5 text-[13px] text-muted">
                  Czego brakuje, co przeszkadza, co byś zmienił. Piszesz do mnie bezpośrednio -
                  konto nie jest potrzebne.
                </p>

                <div className="field mt-5 px-4 py-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    autoFocus
                    placeholder="np. „przydałby się filtr po oświetleniu wieczorem” albo „mapa wolno działa na moim telefonie”"
                    className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
                  />
                </div>

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-faint">
                    Kontakt (opcjonalnie)
                  </span>
                  <span className="field flex px-4 py-3">
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="e-mail albo instagram, jeśli chcesz odpowiedź"
                      className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
                    />
                  </span>
                </label>

                {!supabaseEnabled && (
                  <p className="mt-3 text-[12px] text-faint">
                    Tryb testowy - opinie ruszą po podpięciu bazy.
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
                    {state === "sending" ? "Wysyłam…" : "Wyślij"}
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
