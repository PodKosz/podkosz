"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth";
import { GoogleMark } from "./GoogleMark";

/**
 * Przycisk „zaloguj się przez Google" do postawienia w treści strony.
 *
 * Osobny od tego w oknie `BramkaLogowania`, bo trafia w inne miejsce: okno łapie
 * przerwaną czynność, a ten stoi na stronach, na które da się wejść wprost bez konta
 * (kreator dodawania boiska). Po powrocie z Google wracamy pod ten sam adres, więc
 * człowiek ląduje w kreatorze, a nie na stronie głównej.
 */
export function PrzyciskLogowania({ etykieta = "Zaloguj się przez Google" }: { etykieta?: string }) {
  const sciezka = usePathname();
  const [blad, setBlad] = useState<string | null>(null);
  const [idzie, setIdzie] = useState(false);

  return (
    <div>
      <button
        onClick={() => {
          setIdzie(true);
          setBlad(null);
          signInWithGoogle(sciezka || "/").catch((e: Error) => {
            setBlad(e.message);
            setIdzie(false);
          });
        }}
        disabled={idzie}
        className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-black transition hover:brightness-95 disabled:opacity-60"
      >
        <GoogleMark className="h-5 w-5" />
        {idzie ? "Przenoszę do Google..." : etykieta}
      </button>
      {blad && <p className="mt-3 text-[13px] text-ember">{blad}</p>}
    </div>
  );
}
