"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { signInWithGoogle } from "@/lib/auth";

/** Ulubione boiska zalogowanego użytkownika. */
export function FavoriteButton({
  courtId,
  initiallyFavorite = false,
  signedIn = false,
  compact = false,
}: {
  courtId: string;
  initiallyFavorite?: boolean;
  signedIn?: boolean;
  /** mniejsza wersja - na telefonie stoi w jednym rzędzie ze współrzędnymi */
  compact?: boolean;
}) {
  const path = usePathname();
  const [fav, setFav] = useState(initiallyFavorite);
  const [hint, setHint] = useState<string | null>(null);

  const toggle = async () => {
    const supabase = supabaseBrowser();
    if (!supabase || !signedIn) {
      if (supabaseEnabled) {
        signInWithGoogle(path).catch((e: Error) => setHint(e.message));
      } else {
        setHint("Ulubione ruszą po podpięciu bazy.");
      }
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const next = !fav;
    setFav(next);
    const { error } = next
      ? await supabase.from("favorites").insert({ court_id: courtId, user_id: user.id })
      : await supabase.from("favorites").delete().eq("court_id", courtId);
    if (error) {
      setFav(!next);
      setHint(error.message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-pressed={fav}
        className={`glass flex items-center gap-1.5 rounded-full font-medium transition hover:bg-white/10 ${
          compact ? "px-3 py-1.5 text-[12px]" : "gap-2 px-5 py-3 text-[14px]"
        } ${fav ? "text-glow" : "text-ink"}`}
      >
        <svg
          viewBox="0 0 24 24"
          style={{ width: compact ? 15 : 18, height: compact ? 15 : 18 }}
          fill={fav ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="m12 20.3-7.1-7.2a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5Z" />
        </svg>
        {fav ? "W ulubionych" : "Do ulubionych"}
      </button>
      {hint && (
        <p className="glass absolute left-0 top-[calc(100%+8px)] z-20 w-60 rounded-2xl p-3 text-[12px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
