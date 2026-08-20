"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { AuthMenu, AuthUser } from "./AuthMenu";

const LINKS = [
  { href: "/", label: "Mapa" },
  { href: "/ranking", label: "Ranking" },
  { href: "/o-nas", label: "O nas" },
];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href);

/**
 * Górny pasek. Kto jest zalogowany, dociągamy tu z `/api/sesja` już w przeglądarce, a nie
 * z układu strony: odczyt ciasteczek na serwerze wymuszałby renderowanie każdej podstrony
 * na żądanie. Dopóki odpowiedź nie wróci, w miejscu przycisku stoi placeholder tej samej
 * wielkości, żeby pasek nie podskakiwał.
 */
export function TopNav() {
  const path = usePathname();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let aktualne = true;

    fetch("/api/sesja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user?: AuthUser | null }) => {
        if (aktualne) setUser(d.user ?? null);
      })
      .catch(() => {
        if (aktualne) setUser(null);
      });

    return () => {
      aktualne = false;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-3 sm:p-5">
      {/* na telefonie logo jest zawsze, także na mapie - inaczej nie ma jak wrócić */}
      <div className="pointer-events-auto shrink-0">
        <span className="md:hidden">
          <Brand compact />
        </span>
        <span className="hidden md:block">{path !== "/" && <Brand compact />}</span>
      </div>

      <nav className="glass pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full p-1 pl-1.5 sm:gap-1 sm:p-1.5 sm:pl-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] transition sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.12em] ${
              isActive(path, l.href) ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}

        <Link
          href="/dodaj"
          className="rounded-full flame-gradient px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-[0.98] sm:px-5 sm:py-2.5 sm:text-[12px] sm:tracking-[0.12em]"
        >
          <span className="sm:hidden">Dodaj</span>
          <span className="hidden sm:inline">Dodaj boisko</span>
        </Link>

        <span className="mx-0.5 h-5 w-px bg-white/12 sm:mx-1 sm:h-6" />
        {user === undefined ? (
          <span className="h-9 w-9 rounded-full bg-white/6 sm:w-[104px]" aria-hidden />
        ) : (
          <AuthMenu user={user} />
        )}
      </nav>
    </div>
  );
}
