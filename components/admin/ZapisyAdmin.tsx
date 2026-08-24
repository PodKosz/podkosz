"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dataOpisowa, plural } from "@/lib/site";

/**
 * Zapisy na otwarcie: lista adresów zostawionych na stronie „Już niedługo".
 *
 * Wysyłka idzie porcjami po dziewięćdziesiąt adresów, bo tyle przyjmuje dostawca poczty
 * w jednym żądaniu. Przycisk wysyła jedną porcję i mówi, ile zostało - przy większej
 * liczbie zapisanych trzeba go kliknąć kilka razy. Świadomie nie robimy z tego pętli:
 * masowa wysyłka to rzecz, którą lepiej prowadzić na oczach, krok po kroku.
 */
interface Zapis {
  email: string;
  created_at: string;
  notified_at: string | null;
}

async function pobierzZapisy(): Promise<{ items: Zapis[]; error: string | null }> {
  const supabase = await supabaseBrowser();
  if (!supabase) return { items: [], error: "Zapisy wymagają podpiętej bazy." };

  const { data, error } = await supabase
    .from("launch_signups")
    .select("email, created_at, notified_at")
    .order("created_at", { ascending: false });

  return { items: (data ?? []) as Zapis[], error: error ? error.message : null };
}

export function ZapisyAdmin() {
  const [lista, setLista] = useState<Zapis[]>([]);
  const [laduje, setLaduje] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [wysyla, setWysyla] = useState(false);
  const [wynik, setWynik] = useState<string | null>(null);

  /*
    Czysty odczyt, bez dotykania stanu - dzięki temu da się go wywołać także z efektu.
    Ustawianie stanu wprost w efekcie jest w tym projekcie zabronione (react-hooks).
  */
  const wczytaj = useCallback(async () => {
    const wynik = await pobierzZapisy();
    setLista(wynik.items);
    setBlad(wynik.error);
    setLaduje(false);
  }, []);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const wynik = await pobierzZapisy();
      if (!aktualne) return;
      setLista(wynik.items);
      setBlad(wynik.error);
      setLaduje(false);
    })();

    return () => {
      aktualne = false;
    };
  }, []);

  const czekaja = lista.filter((z) => !z.notified_at).length;

  const wyslij = async () => {
    setWysyla(true);
    setWynik(null);

    try {
      const odp = await fetch("/api/mail-otwarcie", { method: "POST" });
      const dane = (await odp.json()) as {
        wyslane?: number;
        zostalo?: number;
        powod?: string;
        blad?: string;
      };

      setWynik(
        dane.blad ??
          (dane.wyslane
            ? `Poszło ${dane.wyslane} ${plural(dane.wyslane, ["list", "listy", "listów"])}` +
              (dane.zostalo ? `, zostało ${dane.zostalo}.` : ".")
            : `Nic nie poszło${dane.powod ? ` - ${dane.powod}` : ""}.`)
      );
      await wczytaj();
    } catch {
      setWynik("Nie udało się połączyć z serwerem.");
    } finally {
      setWysyla(false);
    }
  };

  if (laduje) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję zapisy…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass flex flex-wrap items-center gap-4 rounded-[24px] p-6">
        <div>
          <p className="text-[26px] font-bold leading-none text-ink">{lista.length}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-faint">
            zapisanych na otwarcie
          </p>
        </div>

        <div>
          <p className="text-[26px] font-bold leading-none flame-text">{czekaja}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-faint">
            czeka na wiadomość
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <a
            href="/api/mail-otwarcie"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/5 px-4 py-2 text-[12px] text-muted transition hover:text-ink"
          >
            Podejrzyj list
          </a>

          <button
            type="button"
            onClick={() => void wyslij()}
            disabled={wysyla || czekaja === 0}
            className="rounded-full flame-gradient px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {wysyla ? "Wysyłam…" : "Wyślij porcję (90)"}
          </button>
        </div>
      </div>

      {wynik && <p className="text-[13px] text-muted">{wynik}</p>}
      {blad && <p className="text-[13px] text-ember">{blad}</p>}

      {lista.length > 0 && (
        <ul className="space-y-1.5">
          {lista.map((z) => (
            <li
              key={z.email}
              className="kafel flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"
            >
              <span className="text-ink">{z.email}</span>
              <span className="text-faint">{dataOpisowa(z.created_at, true)}</span>
              <span
                className={`ml-auto text-[11px] uppercase tracking-[0.12em] ${
                  z.notified_at ? "text-flame" : "text-faint"
                }`}
              >
                {z.notified_at ? "powiadomiony" : "czeka"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
