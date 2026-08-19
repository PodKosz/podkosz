"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { signInWithGoogle } from "@/lib/auth";
import { FireBallIcon } from "./icons";

/** Lajk = płonąca piłka. Bez podpiętej bazy działa lokalnie (tryb testowy). */
export function LikeButton({
  courtId,
  initial,
  initiallyLiked = false,
  signedIn = false,
  size = "lg",
}: {
  courtId: string;
  initial: number;
  initiallyLiked?: boolean;
  signedIn?: boolean;
  size?: "lg" | "sm";
}) {
  const path = usePathname();
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initial);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const big = size === "lg";

  const toggle = async () => {
    if (busy) return;
    const supabase = supabaseBrowser();

    if (supabaseEnabled && !signedIn) {
      setHint("Podpalanie boisk wymaga konta - kliknij, żeby zalogować się przez Google.");
      return;
    }

    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    if (!supabase) return; // tryb testowy: zostaje stan lokalny

    setBusy(true);
    const { error } = next
      ? await supabase.from("likes").insert({ court_id: courtId, user_id: await uid(supabase) })
      : await supabase.from("likes").delete().eq("court_id", courtId);
    setBusy(false);

    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      setHint(error.message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={hint && supabaseEnabled && !signedIn ? () => signInWithGoogle(path) : toggle}
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

async function uid(supabase: NonNullable<ReturnType<typeof supabaseBrowser>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}
