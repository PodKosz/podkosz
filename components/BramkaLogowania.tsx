"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth";
import { pobierzSesje } from "@/lib/sesja";
import { supabaseEnabled } from "@/lib/supabase/config";
import { GoogleMark } from "./GoogleMark";

/**
 * Bramka logowania: jedno okno na wszystkie czynności, które wymagają konta.
 *
 * Do tej pory każdy przycisk radził sobie sam i każdy inaczej. Podpalenie boiska pisało
 * podpowiedź pod spodem, ulubione od razu wyrzucały na logowanie Google, deklaracja
 * „zagram dziś" mówiła jeszcze co innego. Trzy zachowania na jedno pytanie - a przy
 * podpowiedzi pod przyciskiem najczęstszy przypadek wyglądał tak, jakby przycisk nie
 * działał: człowiek klika, nic się nie rusza, tekst pojawia się poza wzrokiem.
 *
 * Teraz jest jedno okno na środku ekranu, reszta strony pod nim rozmyta, i mówi wprost:
 * czego chciałeś, dlaczego trzeba konta i gdzie kliknąć. Rozmycie jest tu robotą, nie
 * ozdobą - odcina uwagę od strony i nie da się okna przeoczyć.
 *
 * ------------------------------------------------------------------ jak używać
 *
 *   const { wymagaj } = useBramka();
 *   if (!(await wymagaj("podpalić boisko"))) return;
 *
 * `wymagaj` jest asynchroniczne z rozmysłem: odpowiedź o sesji przychodzi z serwera
 * i w pierwszej sekundzie po wejściu na stronę jeszcze jej nie ma. Sprawdzanie stanu
 * „jeszcze nie wiem" pokazywałoby okno logowania osobie, która JEST zalogowana - dlatego
 * czekamy na odpowiedź, a nie zgadujemy. Zapytanie idzie raz na wczytanie strony
 * (`pobierzSesje` trzyma obietnicę w module), więc czekanie jest zwykle zerowe.
 */

interface Bramka {
  /** `true`, gdy wolno działać. `false` znaczy: pokazano okno logowania. */
  wymagaj: (czynnosc: string) => Promise<boolean>;
  /** Otwiera okno bez sprawdzania sesji - dla przypadków, gdy wiadomo, że konta nie ma. */
  pokaz: (czynnosc: string) => void;
}

const Kontekst = createContext<Bramka | null>(null);

export function useBramka(): Bramka {
  const ctx = useContext(Kontekst);
  /*
    Brak dostawcy nie może wywalić przycisku - w najgorszym razie wracamy do zachowania
    sprzed bramki, czyli „wolno działać". Baza i tak odrzuci zapis bez konta.
  */
  return ctx ?? { wymagaj: async () => true, pokaz: () => {} };
}

export function BramkaLogowania({ children }: { children: ReactNode }) {
  const [czynnosc, setCzynnosc] = useState<string | null>(null);

  const pokaz = useCallback((co: string) => setCzynnosc(co), []);

  const wymagaj = useCallback(async (co: string) => {
    /* bez podpiętej bazy nie ma logowania i nie ma czego pilnować - tryb testowy */
    if (!supabaseEnabled) return true;

    const sesja = await pobierzSesje();
    if (sesja.user) return true;

    setCzynnosc(co);
    return false;
  }, []);

  return (
    <Kontekst.Provider value={{ wymagaj, pokaz }}>
      {children}
      {czynnosc && <Okno czynnosc={czynnosc} onZamknij={() => setCzynnosc(null)} />}
    </Kontekst.Provider>
  );
}

function Okno({ czynnosc, onZamknij }: { czynnosc: string; onZamknij: () => void }) {
  const sciezka = usePathname();
  const [blad, setBlad] = useState<string | null>(null);
  const [idzie, setIdzie] = useState(false);

  /* Escape zamyka - okno pojawia się w środku czyjegoś kliknięcia i nie może więzić */
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZamknij();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [onZamknij]);

  const zaloguj = () => {
    setIdzie(true);
    setBlad(null);
    /* po powrocie z Google wracamy tam, gdzie człowiek był - nie na stronę główną */
    signInWithGoogle(sciezka || "/").catch((e: Error) => {
      setBlad(e.message);
      setIdzie(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center px-5">
      {/* rozmycie całej strony pod oknem - to ono odcina uwagę, nie sama przezroczystość */}
      <div
        onClick={onZamknij}
        className="absolute inset-0 bg-void/50 backdrop-blur-xl"
        style={{ animation: "rise 260ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="szklo-pro relative w-full max-w-[420px] overflow-hidden rounded-[30px] px-7 py-8 text-center"
        style={{ animation: "rise 380ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <button
          onClick={onZamknij}
          aria-label="Zamknij"
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-hairline bg-white/6 text-[15px] text-muted transition hover:text-ink"
        >
          &times;
        </button>

        <p className="text-[11px] uppercase tracking-[0.32em] text-flame">Hej!</p>
        <h2 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.02em]">
          Musisz się zalogować, żeby to zrobić
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          {`Żeby ${czynnosc}, potrzebujesz konta. Przeglądanie boisk zostaje otwarte dla wszystkich - konto jest tylko do tego, co zmienia mapę.`}
        </p>

        <button
          onClick={zaloguj}
          disabled={idzie}
          className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-black transition hover:brightness-95 disabled:opacity-60"
        >
          <GoogleMark className="h-5 w-5" />
          {idzie ? "Przenoszę do Google..." : "Zaloguj się przez Google"}
        </button>

        <button
          onClick={onZamknij}
          className="mt-3 w-full rounded-full px-6 py-3 text-[13px] text-faint transition hover:text-muted"
        >
          Może później
        </button>

        {blad && <p className="mt-4 text-[13px] text-ember">{blad}</p>}
      </div>
    </div>
  );
}
