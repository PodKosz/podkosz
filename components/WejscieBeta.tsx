"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/config";
import { GoogleMark } from "./GoogleMark";

/**
 * Wejście dla beta testerów ze strony „Już niedługo".
 *
 * Adresy dopuszczone do testów siedzą w tabeli `beta_testers` (panel administratora →
 * „Beta testerzy"). Po zalogowaniu przez Google zasłona pyta bazę, czy ten adres jest na
 * liście, i jeśli tak - wpuszcza dalej. Kto nie jest, wraca tutaj.
 */
export function WejscieBeta() {
  const [blad, setBlad] = useState<string | null>(null);

  if (!supabaseEnabled) return null;

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      <button
        onClick={() => signInWithGoogle("/").catch((e: Error) => setBlad(e.message))}
        className="glass flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13px] font-medium text-muted transition hover:text-ink"
      >
        <GoogleMark className="h-5 w-5" /> Testuję stronę - wejdź
      </button>

      {blad ? (
        <p className="max-w-xs text-center text-[12px] leading-snug text-ember">{blad}</p>
      ) : (
        <p className="text-[12px] text-faint">tylko dla zaproszonych do testów</p>
      )}
    </div>
  );
}
