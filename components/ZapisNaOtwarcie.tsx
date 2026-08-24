"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { plural } from "@/lib/site";

/**
 * Zapis na otwarcie serwisu ze strony „Już niedługo".
 *
 * Zapis idzie przez własny endpoint, bo zaraz po nim ma pójść krótkie potwierdzenie
 * pocztą, a klucz do wysyłki nie ma prawa wyjść na front. Sam wpis i tak pilnuje baza:
 * tabela przyjmuje adresy od każdego, także niezalogowanego (o to właśnie chodzi), ale
 * nikt poza administratorem jej nie przeczyta.
 *
 * Licznik pod przyciskiem idzie osobną funkcją zwracającą samą liczbę - pokazuje, że ktoś
 * już czeka, nie ujawniając listy.
 */
export function ZapisNaOtwarcie() {
  const [email, setEmail] = useState("");
  const [stan, setStan] = useState<"czeka" | "wysyla" | "zapisany">("czeka");
  const [blad, setBlad] = useState<string | null>(null);
  const [ilu, setIlu] = useState<number | null>(null);
  /* adres był już na liście - wtedy potwierdzenie nie idzie po raz drugi */
  const [juzByl, setJuzByl] = useState(false);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase.rpc("zapisow_na_otwarcie");
      if (aktualne && typeof data === "number") setIlu(data);
    })();

    return () => {
      aktualne = false;
    };
  }, []);

  if (!supabaseEnabled) return null;

  const zapisz = async () => {
    const adres = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adres)) {
      setBlad("To nie wygląda na adres e-mail.");
      return;
    }

    setStan("wysyla");
    setBlad(null);

    /*
      Zapis idzie przez serwer, a nie wprost do bazy, bo zaraz po nim ma pójść krótkie
      potwierdzenie pocztą - a klucz do wysyłki nie ma prawa wyjść na front.
    */
    try {
      const odp = await fetch("/api/zapis-na-otwarcie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adres }),
      });
      const dane = (await odp.json()) as { zapisany?: boolean; nowy?: boolean; powod?: string };

      if (!dane.zapisany) {
        setStan("czeka");
        setBlad(
          dane.powod === "adres"
            ? "To nie wygląda na adres e-mail."
            : "Nie udało się zapisać. Spróbuj za chwilę."
        );
        return;
      }

      setStan("zapisany");
      setJuzByl(dane.nowy === false);
      if (dane.nowy) setIlu((n) => (n === null ? null : n + 1));
    } catch {
      setStan("czeka");
      setBlad("Nie udało się połączyć. Spróbuj za chwilę.");
    }
  };

  if (stan === "zapisany") {
    return (
      <div className="mt-10 flex flex-col items-center gap-2">
        <p className="szklo-pro rounded-full px-6 py-3 text-[14px] text-ink">
          Jesteś na liście. Odezwę się w dniu otwarcia.
        </p>
        <p className="text-[12px] text-faint">
          {juzByl
            ? "Ten adres był już zapisany - nic więcej nie trzeba."
            : "Potwierdzenie poszło na maila. Jeden list, bez newslettera."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex w-full max-w-[420px] flex-col items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void zapisz();
        }}
        className="szklo-pro flex w-full items-center gap-2 rounded-full p-1.5"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setBlad(null);
          }}
          placeholder="twój@email.pl"
          aria-label="Adres e-mail"
          autoComplete="email"
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-[14px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={stan === "wysyla"}
          className="shrink-0 rounded-full flame-gradient px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {stan === "wysyla" ? "Zapisuję…" : "Zapisz się na otwarcie"}
        </button>
      </form>

      {blad ? (
        <p className="text-[12px] text-ember">{blad}</p>
      ) : (
        <p className="text-[12px] text-faint">
          {ilu && ilu > 0
            ? `${ilu} ${plural(ilu, ["osoba czeka", "osoby czekają", "osób czeka"])} na otwarcie`
            : "Napiszę raz - w dniu, w którym strona ruszy."}
        </p>
      )}
    </div>
  );
}
