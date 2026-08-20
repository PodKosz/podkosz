"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const POTWIERDZENIE = "USUWAM";

/**
 * Usunięcie własnego konta.
 *
 * Robi to funkcja w bazie (`usun_moje_konto`): kasuje profil, podpalenia, ulubione
 * i zapisy „idę zagrać", a boiska dodane przez tę osobę zostają na mapie, tylko bez
 * powiązania z kontem. Operacja jest nieodwracalna, więc wymaga wpisania słowa.
 */
export function UsunKonto() {
  const router = useRouter();
  const [otwarte, setOtwarte] = useState(false);
  const [slowo, setSlowo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [usuwa, setUsuwa] = useState(false);

  const usun = async () => {
    setUsuwa(true);
    setBlad(null);

    const supabase = await supabaseBrowser();
    if (!supabase) {
      setUsuwa(false);
      setBlad("Usuwanie konta wymaga podpiętej bazy.");
      return;
    }

    const { error } = await supabase.rpc("usun_moje_konto");
    if (error) {
      setUsuwa(false);
      setBlad(error.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="rounded-[24px] border border-ember/30 bg-ember/[0.06] p-6">
      <h2 className="text-[17px] font-semibold tracking-tight text-ember">Usuń konto</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        Znikają: profil, nick, Twoje podpalenia, ulubione i zapisy „idę dziś zagrać”. Boiska,
        które dodałeś, zostają na mapie - są już częścią wspólnej bazy - ale przestają być
        powiązane z Twoim kontem. Tego nie da się cofnąć.
      </p>

      {!otwarte ? (
        <button
          onClick={() => setOtwarte(true)}
          className="mt-5 rounded-full border border-ember/50 px-5 py-2.5 text-[13px] font-medium text-ember transition hover:bg-ember/10"
        >
          Chcę usunąć konto
        </button>
      ) : (
        <div className="mt-5">
          <label className="block text-[13px] text-muted">
            Wpisz <span className="font-bold text-ember">{POTWIERDZENIE}</span>, żeby potwierdzić.
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={slowo}
              onChange={(e) => setSlowo(e.target.value.toUpperCase())}
              placeholder={POTWIERDZENIE}
              className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[15px] tracking-[0.1em] outline-none transition focus:border-ember/60 sm:max-w-[240px]"
            />
            <button
              onClick={() => void usun()}
              disabled={usuwa || slowo !== POTWIERDZENIE}
              className="shrink-0 rounded-2xl bg-ember px-6 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 disabled:opacity-40"
            >
              {usuwa ? "Usuwam…" : "Usuń konto na zawsze"}
            </button>
            <button
              onClick={() => {
                setOtwarte(false);
                setSlowo("");
                setBlad(null);
              }}
              className="shrink-0 rounded-2xl border border-hairline px-5 py-3 text-[13px] font-medium text-muted transition hover:text-ink"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {blad && (
        <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}
    </div>
  );
}
