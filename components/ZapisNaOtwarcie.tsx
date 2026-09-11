"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { plural } from "@/lib/site";
import { poprawnyKsztalt, sugestiaAdresu } from "@/lib/adres-email";

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
 *
 * ------------------------------------------------------------------ pytanie o literówkę
 *
 * Przy wysyłce sprawdzamy adres pod kątem typowych pomyłek w domenie i - jeśli coś pachnie
 * błędem - pytamy, zamiast wysyłać. To jedyne miejsce w serwisie, gdzie przeoczenie kończy
 * się całkowitą ciszą: list idzie w próżnię, człowiek czeka na potwierdzenie, którego nigdy
 * nie będzie, a my nie mamy jak go powiadomić, bo jedyny adres, jaki mamy, jest zły.
 *
 * Pytamy raz. „Zostaw mój" wysyła dokładnie to, co wpisał - bo podpowiedź potrafi się mylić,
 * a nikomu nie wolno odebrać możliwości zapisania się przez naszą zgadywankę.
 *
 * Po zapisie pokazujemy adres, na który poszedł list. Wygląda to na drobiazg, a jest drugą
 * połową całej tej roboty: literówki w części przed małpą nie wykryje żaden algorytm i nie
 * wykryje jej nikt poza właścicielem skrzynki, który musi ją najpierw zobaczyć.
 */
export function ZapisNaOtwarcie() {
  const [email, setEmail] = useState("");
  const [stan, setStan] = useState<"czeka" | "wysyla" | "zapisany">("czeka");
  const [blad, setBlad] = useState<string | null>(null);
  const [ilu, setIlu] = useState<number | null>(null);
  /* adres był już na liście - wtedy potwierdzenie nie idzie po raz drugi */
  const [juzByl, setJuzByl] = useState(false);
  /* podejrzenie literówki - dopóki tu coś stoi, nic nie wysyłamy */
  const [sugestia, setSugestia] = useState<string | null>(null);
  /* adres, na który list faktycznie poszedł - pokazujemy go po zapisie */
  const [zapisanyAdres, setZapisanyAdres] = useState("");

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

  /**
   * @param adres      wysyłany adres - podawany wprost, bo po kliknięciu „Tak, popraw"
   *                   stan `email` jeszcze go nie zna
   * @param juzPytane  true = literówkę już przy tym adresie omówiliśmy, nie pytamy drugi raz
   */
  const zapisz = async (adres: string, juzPytane = false) => {
    if (!poprawnyKsztalt(adres)) {
      setBlad("To nie wygląda na adres e-mail.");
      return;
    }

    if (!juzPytane) {
      const podejrzenie = sugestiaAdresu(adres);
      if (podejrzenie) {
        setSugestia(podejrzenie);
        setBlad(null);
        return;
      }
    }

    setStan("wysyla");
    setBlad(null);
    setSugestia(null);

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
      setZapisanyAdres(adres);
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
          {juzByl ? (
            <>
              Ten adres był już zapisany - nic więcej nie trzeba.
            </>
          ) : (
            <>
              Potwierdzenie poszło na <b className="text-muted">{zapisanyAdres}</b>. Jeden list,
              bez newslettera.
            </>
          )}
        </p>

        {/*
          Ostatnia deska ratunku na literówkę w części przed małpą - tej nie wykryje żaden
          algorytm, bo „paradoeski@gmail.com" to poprawny adres w istniejącej domenie.
          Wykryć ją może wyłącznie właściciel skrzynki, i tylko wtedy, gdy zobaczy, co wpisał.
        */}
        <button
          type="button"
          onClick={() => {
            setStan("czeka");
            setBlad(null);
            setSugestia(null);
          }}
          className="text-[12px] text-faint underline underline-offset-4 transition hover:text-muted"
        >
          To nie mój adres - popraw
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 flex w-full max-w-[420px] flex-col items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void zapisz(email.trim().toLowerCase());
        }}
        className="szklo-pro flex w-full items-center gap-2 rounded-full p-1.5"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setBlad(null);
            /* poprawka w polu unieważnia pytanie o poprzedni adres */
            setSugestia(null);
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

      {sugestia ? (
        <div className="szklo-pro w-full rounded-2xl px-4 py-3 text-center">
          <p className="text-[13px] text-muted">
            Czy chodziło o <b className="text-ink">{sugestia}</b>?
          </p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail(sugestia);
                void zapisz(sugestia, true);
              }}
              className="rounded-full flame-gradient px-4 py-2 text-[12px] font-bold text-black transition hover:brightness-110"
            >
              Tak, popraw
            </button>
            <button
              type="button"
              onClick={() => void zapisz(email.trim().toLowerCase(), true)}
              className="rounded-full border border-hairline px-4 py-2 text-[12px] text-muted transition hover:text-ink"
            >
              Nie, mój jest dobry
            </button>
          </div>
        </div>
      ) : blad ? (
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
