"use client";

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

export function TopNav({ user }: { user: AuthUser | null }) {
  const path = usePathname();
  const onMap = path === "/";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between p-5">
      <div className="pointer-events-auto">{!onMap && <Brand compact />}</div>

      <nav className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5 pl-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-4 py-2 text-[12px] font-medium uppercase tracking-[0.12em] transition ${
              isActive(path, l.href) ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/dodaj"
          className="rounded-full flame-gradient px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 active:scale-[0.98]"
        >
          Dodaj boisko
        </Link>
        <span className="mx-1 h-6 w-px bg-white/12" />
        <AuthMenu user={user} />
      </nav>
    </div>
  );
}
