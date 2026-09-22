"use client";

import { useState } from "react";
import { DUPLIKAT, komunikatZapisu } from "@/lib/bledy-zapisu";
import { zapamietajReakcje } from "@/lib/sesja";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useBramka } from "./BramkaLogowania";
import { FireBallIcon } from "./icons";

/** Lajk = płonąca piłka. Bez podpiętej bazy działa lokalnie (tryb testowy). */
export function LikeButton({
  courtId,
  initial,
  initiallyLiked = false,
  size = "lg",
}: {
  courtId: string;
  initial: number;
  initiallyLiked?: boolean;
  size?: "lg" | "sm";
}) {
  const { wymagaj } = useBramka();
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initial);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const big = size === "lg";

  const toggle = async () => {
    if (busy) return;
    const supabase = await supabaseBrowser();

    /*
      Jedno pytanie, jedno okno - patrz `BramkaLogowania`. Wcześniej stała tu podpowiedź
      pod przyciskiem, którą przy podpalaniu z mapy najczęściej się nie widziało.
    */
    if (!(await wymagaj("podpalić boisko"))) return;

    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    if (!supabase) return; // tryb testowy: zostaje stan lokalny

    setBusy(true);
    const kto = await uid(supabase);
    const { error } = next
      ? await supabase.from("likes").insert({ court_id: courtId, user_id: kto })
      : await supabase.from("likes").delete().eq("court_id", courtId).eq("user_id", kto);
    setBusy(false);

    /*
      Duplikat znaczy, że wiersz już jest, czyli boisko JEST podpalone - a o to chodziło.
      To samo okienko co przy ulubionych: karta leci z pamięci podręcznej, a stan podpaleń
      dociąga `/api/sesja`, więc kliknięcie zaraz po wejściu trafia w przycisk pokazujący
      jeszcze „podpal". Licznik cofamy, bo podpalenie nie jest nowe - tylko ekran o nim
      nie wiedział.
    */
    if (error?.code === DUPLIKAT) {
      setCount((c) => c - 1);
      zapamietajReakcje("likes", courtId, true);
      return;
    }

    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      setHint(komunikatZapisu(error));
      return;
    }

    zapamietajReakcje("likes", courtId, next);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-pressed={liked}
        className={`group flex items-center gap-2 rounded-full border transition active:scale-95 ${
          big
            ? "px-4 py-2.5 text-[13px] sm:px-5 sm:py-3 sm:text-[15px]"
            : "px-3 py-1.5 text-[13px]"
        } ${
          liked
            ? "border-transparent flame-gradient font-bold text-black flame-ring"
            : "border-hairline bg-white/6 font-semibold text-ink hover:bg-white/10"
        }`}
      >
        <FireBallIcon
          className={`${
            big ? "h-4 w-4 sm:h-5 sm:w-5" : "h-4 w-4"
          } transition-transform group-hover:scale-110`}
        />
        {count}
        {big && (
          <span className="ml-1 font-medium opacity-80">{liked ? "podpalone" : "podpal"}</span>
        )}
      </button>

      {hint && (
        <p className="glass absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl p-3 text-[12px] leading-snug text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

type Klient = NonNullable<Awaited<ReturnType<typeof supabaseBrowser>>>;

async function uid(supabase: Klient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}
