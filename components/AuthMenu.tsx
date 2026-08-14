"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/config";
import { GoogleMark } from "./GoogleMark";

export interface AuthUser {
  name: string;
  avatar: string | null;
  isAdmin: boolean;
}

export function AuthMenu({ user }: { user: AuthUser | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={() =>
            signInWithGoogle(path).catch((e: Error) => setError(e.message))
          }
          title={supabaseEnabled ? "Zaloguj się przez Google" : "Wymaga podpięcia bazy"}
          className="flex items-center gap-2 rounded-full border border-hairline bg-white/6 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.1em] text-muted transition hover:text-ink"
        >
          <GoogleMark className="h-5 w-5" />
          Zaloguj
        </button>
        {error && (
          <p className="glass absolute right-0 top-12 w-64 rounded-2xl p-3 text-[12px] leading-snug text-muted">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-hairline bg-white/6 py-1 pl-1 pr-3 transition hover:bg-white/10"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full flame-gradient text-[13px] font-bold text-black">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="max-w-[120px] truncate text-[12px] font-medium">{user.name}</span>
      </button>

      {open && (
        <div className="glass absolute right-0 top-12 w-56 overflow-hidden rounded-2xl p-1.5">
          <Link
            href="/ulubione"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-[13px] text-muted transition hover:bg-white/8 hover:text-ink"
          >
            Ulubione boiska
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-[13px] text-muted transition hover:bg-white/8 hover:text-ink"
            >
              Panel administratora
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="block w-full rounded-xl px-3 py-2.5 text-left text-[13px] text-muted transition hover:bg-white/8 hover:text-ink"
          >
            Wyloguj
          </button>
        </div>
      )}
    </div>
  );
}
