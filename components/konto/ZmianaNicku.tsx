"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/*
  Komunikaty tłumaczymy na własne: reguły siedzą w bazie (żeby nie dało się ich obejść poza
  formularzem), ale wyjątki z Postgresa brzmią jak z konsoli.
*/
function ladnyKomunikat(surowy: string): string {
  if (/od 3 do 24/.test(surowy)) return "Nick musi mieć od 3 do 24 znaków.";
  if (/zawiera/.test(surowy))
    return "Nick może zawierać tylko litery, cyfry, spację, kropkę, kreskę i podkreślnik.";
  if (/zablokowany/.test(surowy)) return "Ten nick jest zablokowany - wybierz inny.";
  if (/zaj/.test(surowy)) return "Ten nick jest już zajęty - wybierz inny.";
  if (/zablokowane/.test(surowy)) return "Konto jest zablokowane - nie można zmienić nicku.";

  const data = surowy.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (/14 dni/.test(surowy)) {
    return data
      ? `Nick można zmieniać raz na 14 dni. Następna zmiana od ${data[1]}.`
      : "Nick można zmieniać raz na 14 dni.";
  }

  return surowy;
}

/**
 * Zmiana nicku.
 *
 * Długość, dozwolone znaki, listę zablokowanych słów, zajętość i limit jednej zmiany na
 * 14 dni pilnuje wyzwalacz w bazie - formularz tylko pokazuje, co stamtąd wróciło.
 */
export function ZmianaNicku({
  nick,
  ostatniaZmiana,
  zablokowane,
}: {
  nick: string;
  /** ISO albo null, gdy nick nie był jeszcze zmieniany */
  ostatniaZmiana: string | null;
  zablokowane: boolean;
}) {
  const [wartosc, setWartosc] = useState(nick);
  const [stan, setStan] = useState<{ blad?: string; ok?: string } | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  const nastepnaZmiana = ostatniaZmiana
    ? new Date(new Date(ostatniaZmiana).getTime() + 14 * 24 * 3600 * 1000)
    : null;
  const czekaj = Boolean(nastepnaZmiana && nastepnaZmiana > new Date());

  const zapisz = async () => {
    setZapisuje(true);
    setStan(null);

    const supabase = await supabaseBrowser();
    if (!supabase) {
      setZapisuje(false);
      setStan({ blad: "Zmiana nicku wymaga podpiętej bazy." });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: wartosc.trim() })
      .eq("id", user?.id ?? "");

    setZapisuje(false);

    if (error) {
      setStan({ blad: ladnyKomunikat(error.message) });
      return;
    }

    setStan({ ok: "Nick zmieniony. Odświeżam stronę…" });
    // pasek nawigacji i podpisy pod boiskami czytają nick z serwera
    setTimeout(() => location.reload(), 900);
  };

  return (
    <div className="glass rounded-[24px] p-6">
      <h2 className="text-[17px] font-semibold tracking-tight">Twój nick</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Tym podpisem widnieją boiska, które dodajesz, i Twoje miejsce w rankingu odkrywców.
        Od 3 do 24 znaków, bez wulgaryzmów. Zmiana raz na 14 dni.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={wartosc}
          onChange={(e) => {
            setWartosc(e.target.value);
            setStan(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !czekaj && !zablokowane) void zapisz();
          }}
          maxLength={24}
          disabled={czekaj || zablokowane}
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[15px] outline-none transition focus:border-flame/60 disabled:opacity-50"
        />
        <button
          onClick={() => void zapisz()}
          disabled={zapisuje || czekaj || zablokowane || wartosc.trim() === nick}
          className="shrink-0 rounded-2xl flame-gradient px-6 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 disabled:opacity-40"
        >
          {zapisuje ? "Zapisuję…" : "Zapisz nick"}
        </button>
      </div>

      {czekaj && nastepnaZmiana && (
        <p className="mt-3 text-[13px] text-faint">
          Kolejna zmiana będzie możliwa od{" "}
          {nastepnaZmiana.toLocaleDateString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
          .
        </p>
      )}

      {stan?.blad && (
        <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {stan.blad}
        </p>
      )}
      {stan?.ok && (
        <p className="mt-3 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-[13px] text-lime">
          {stan.ok}
        </p>
      )}
    </div>
  );
}
