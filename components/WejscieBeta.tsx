"use client";

import { useEffect, useState } from "react";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { GoogleMark } from "./GoogleMark";

/**
 * Wejście dla beta testerów ze strony „Już niedługo".
 *
 * To jedyna droga za zasłonę. Adresy dopuszczone do testów siedzą w tabeli `beta_testers`
 * (panel administratora → „Beta testerzy"), a o wpuszczeniu decyduje funkcja
 * `czy_wpuscic()` po stronie bazy - przy każdym wejściu, na serwerze.
 *
 * Osobno pytamy o to samo z przeglądarki, i to nie z nieufności do serwera, a dla jednego
 * zdania: kto zalogował się i wrócił tutaj, musi wiedzieć DLACZEGO wrócił. Bez tego widział
 * po zalogowaniu ten sam przycisk co przed nim i klikał go w kółko.
 *
 * Odpowiedź „nie" nie jest tu żadnym zabezpieczeniem - nawet gdyby ktoś podmienił ją sobie
 * w przeglądarce na „tak", zobaczy tylko inny napis na tej samej zasłonie. O wejściu decyduje
 * wyłącznie sprawdzenie w proxy.
 */
type Stan = "sprawdzam" | "gosc" | "odrzucony";

export function WejscieBeta() {
  const [stan, setStan] = useState<Stan>(supabaseEnabled ? "sprawdzam" : "gosc");
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let aktualne = true;

    void (async () => {
      const supabase = await supabaseBrowser();
      const { data: sesja } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      if (!aktualne) return;

      /*
        Bez sesji nie ma o co pytać. Z sesją pytamy bazę, a nie zgadujemy z tego, że ktoś
        widzi zasłonę: `/wkrotce` jest dostępne zawsze, więc wpuszczony tester może tu
        zajrzeć wprost z zakładek - i nie powinien wtedy przeczytać, że go nie wpuszczono.
      */
      if (!sesja?.user) {
        setStan("gosc");
        return;
      }

      const { data } = (await supabase?.rpc("czy_wpuscic")) ?? { data: null };
      if (!aktualne) return;
      setStan(data === true ? "gosc" : "odrzucony");
    })();

    return () => {
      aktualne = false;
    };
  }, []);

  if (!supabaseEnabled) return null;

  if (stan === "odrzucony") {
    return (
      <div className="mt-12 flex flex-col items-center gap-3">
        <p className="max-w-sm text-center text-[13px] leading-relaxed text-muted">
          Jesteś zalogowany, ale tego adresu nie ma na liście testów. Zapisz się poniżej na
          otwarcie - napiszę w dniu, w którym strona ruszy dla wszystkich.
        </p>
        <button
          onClick={() => void signOut()}
          className="text-[12px] uppercase tracking-[0.14em] text-faint transition hover:text-flame"
        >
          wyloguj się
        </button>
      </div>
    );
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      <button
        onClick={() => signInWithGoogle("/").catch((e: Error) => setBlad(e.message))}
        disabled={stan === "sprawdzam"}
        className="glass flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13px] font-medium text-muted transition hover:text-ink disabled:opacity-60"
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
