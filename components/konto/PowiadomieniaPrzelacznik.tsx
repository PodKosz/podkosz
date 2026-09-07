"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Wyłącznik powiadomień o wydarzeniach.
 *
 * Powiadomienie o wydarzeniu to jedyny list, który wychodzi z serwisu bez pytania -
 * dostaje go ktoś, kto podpalił dane boisko albo boisko w okolicy. Skoro tak, musi być
 * miejsce, w którym się to wyłącza, i musi być tak proste, jak włączenie: jedno
 * kliknięcie, bez formularza i bez pisania do nikogo. Adres tej strony stoi w stopce
 * każdego takiego listu.
 *
 * Stan trzymamy w `profiles.powiadomienia`, a nie w ustawieniach przeglądarki: wyłączenie
 * ma dotyczyć KONTA, nie urządzenia, z którego ktoś akurat kliknął.
 */
export function PowiadomieniaPrzelacznik({ userId }: { userId: string }) {
  const [wlaczone, setWlaczone] = useState<boolean | null>(null);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase
        .from("profiles")
        .select("powiadomienia")
        .eq("id", userId)
        .maybeSingle();
      if (aktualne) setWlaczone(((data as { powiadomienia?: boolean } | null)?.powiadomienia) ?? true);
    })();

    return () => {
      aktualne = false;
    };
  }, [userId]);

  const przelacz = async () => {
    if (wlaczone === null || zapisuje) return;
    const nowa = !wlaczone;

    setZapisuje(true);
    setBlad(null);
    /* przestawiamy od razu - kliknięcie ma odpowiedzieć natychmiast, a nie po podróży do bazy */
    setWlaczone(nowa);

    const supabase = await supabaseBrowser();
    if (!supabase) {
      setZapisuje(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ powiadomienia: nowa })
      .eq("id", userId);

    setZapisuje(false);
    if (error) {
      setWlaczone(!nowa);
      setBlad(error.message);
    }
  };

  return (
    <section className="szklo-pro mt-6 rounded-[28px] p-6 sm:p-7">
      <h2 className="text-[17px] font-semibold">Powiadomienia o wydarzeniach</h2>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted">
        Gdy na podpalonym przez Ciebie boisku (albo na boisku w okolicy) pojawi się turniej
        czy trening otwarty, wyślemy Ci jedną wiadomość z terminem. Nic innego na maila od
        nas nie przychodzi.
      </p>

      <button
        onClick={() => void przelacz()}
        disabled={wlaczone === null || zapisuje}
        aria-pressed={wlaczone === true}
        className="mt-5 inline-flex items-center gap-3 rounded-full border border-hairline bg-white/5 px-4 py-2.5 text-[14px] transition hover:border-flame/40 disabled:opacity-60"
      >
        {/* przełącznik rysowany, nie systemowy checkbox - reszta ustawień wygląda tak samo */}
        <span
          aria-hidden
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            wlaczone ? "flame-gradient" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              wlaczone ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
        <span>
          {wlaczone === null
            ? "sprawdzam…"
            : wlaczone
              ? "Włączone - dostaję maile o wydarzeniach"
              : "Wyłączone - nie dostaję maili o wydarzeniach"}
        </span>
      </button>

      {blad && <p className="mt-3 text-[13px] text-ember">{blad}</p>}
    </section>
  );
}
