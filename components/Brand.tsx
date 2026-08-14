import Link from "next/link";

/** Logo: boisko widziane z góry, z piłką w kole środkowym. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 transition hover:opacity-90">
      <span
        className="grid place-items-center"
        style={{ filter: "drop-shadow(0 6px 18px rgba(255,90,20,.45))" }}
      >
        <svg viewBox="0 0 64 64" className={compact ? "h-9 w-9" : "h-13 w-13"}
             style={compact ? undefined : { width: 52, height: 52 }} fill="none">
          <defs>
            <linearGradient id="brand-court" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#ffc47d" />
              <stop offset="0.5" stopColor="#ff7a18" />
              <stop offset="1" stopColor="#ff3d00" />
            </linearGradient>
          </defs>

          <g stroke="url(#brand-court)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* płyta boiska */}
            <rect x="4.5" y="12.5" width="55" height="39" rx="4.5" strokeWidth="2.4" />
            {/* linia środkowa */}
            <path d="M32 12.5v39" strokeWidth="1.8" opacity=".9" />
            {/* pola podkoszowe */}
            <path d="M4.5 23.5h10v17h-10" strokeWidth="1.8" />
            <path d="M59.5 23.5h-10v17h10" strokeWidth="1.8" />
            <path d="M14.5 27a7 7 0 0 1 0 10" strokeWidth="1.6" opacity=".85" />
            <path d="M49.5 27a7 7 0 0 0 0 10" strokeWidth="1.6" opacity=".85" />
            {/* piłka w kole środkowym */}
            <circle cx="32" cy="32" r="7.5" strokeWidth="2.2" />
            <path d="M32 24.5v15M24.5 32h15" strokeWidth="1.3" opacity=".95" />
            <path d="M27.2 26c2.7 3.3 2.7 8.7 0 12M36.8 26c-2.7 3.3-2.7 8.7 0 12" strokeWidth="1.3" opacity=".95" />
          </g>
        </svg>
      </span>

      {/* na wąskich ekranach zostaje sama ikona — inaczej pasek nawigacji nie mieści się w szerokości */}
      <span
        className={`font-bold leading-none tracking-tight ${
          compact ? "hidden text-[19px] sm:inline" : "text-[28px]"
        }`}
      >
        POD<span className="flame-text">KOSZ</span>
      </span>
    </Link>
  );
}
