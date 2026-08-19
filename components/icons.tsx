import { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

export function BallIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.4" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 2.8v18.4M2.8 12h18.4" />
      <path d="M5.4 5.4c3.9 3.9 3.9 9.3 0 13.2M18.6 5.4c-3.9 3.9-3.9 9.3 0 13.2" />
    </svg>
  );
}

export function HoopIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" {...props}>
      <rect x="4.5" y="3" width="15" height="9.5" rx="1.4" />
      <path d="M8.6 12.5h6.8l-1 2.2H9.6z" />
      <path d="M9.6 14.7c.5 2.6 1.3 4 2.4 4.6 1.1-.6 1.9-2 2.4-4.6" />
      <path d="M12 14.7v4.6" />
    </svg>
  );
}

export function CourtIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.4" stroke="currentColor" {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.6" />
      <path d="M12 5.5v13" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M2.5 9h3v6h-3M21.5 9h-3v6h3" />
    </svg>
  );
}

export function SurfaceIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.4" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.6 9.2h16.8M3.6 14.8h16.8M9.2 3.6v16.8M14.8 3.6v16.8" opacity=".55" />
    </svg>
  );
}

export function PinIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" {...props}>
      <path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10.3" r="2.5" />
    </svg>
  );
}

export function ClockIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.2V12l3.2 2" />
    </svg>
  );
}

export function BulbIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" {...props}>
      <path d="M9.3 17.5h5.4M10.2 20.4h3.6" />
      <path d="M12 3.2a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.2Z" />
    </svg>
  );
}

export function FenceIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" {...props}>
      <path d="M6 4.5v15M12 4.5v15M18 4.5v15M3.5 9h17M3.5 14.5h17" />
    </svg>
  );
}

export function SearchIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" stroke="currentColor" strokeLinecap="round" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function ChevronIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function CameraIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" {...props}>
      <path d="M3.5 8.5h3l1.6-2.4h7.8L17.5 8.5h3a1 1 0 0 1 1 1v8.4a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </svg>
  );
}

export function PencilIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </svg>
  );
}

/**
 * Płonąca piłka. Wariant "flame" to jednostka lajka, "heat" - wyróżnienie od twórcy.
 */
export function FireBallIcon({
  variant = "flame",
  ...props
}: P & { variant?: "flame" | "basket" }) {
  const id = `fbg-${variant}`;
  const stops =
    variant === "basket"
      ? ["#a855f7", "#e9d5ff", "#ffffff"] // jasna, żeby odcinała się na fioletowej odznace
      : ["#ff3d00", "#ff7a18", "#ffd08a"];
  const seam = variant === "basket" ? "rgba(70,20,120,.6)" : "rgba(60,15,0,.55)";

  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.55" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <path
        d="M12 1.4c.5 2.2-.4 3.6-1.7 4.8-1.6 1.5-2.4 2.6-2.2 4.1.1.8.5 1.4.5 1.4s-1.4-.2-2-1.4c-1.3 1.6-1.7 3.2-1.7 4.6C4.9 19.6 8.1 22.6 12 22.6s7.1-3 7.1-7.7c0-4.6-3.2-6.6-4.4-9.1-.7-1.5-.9-3.1-2.7-4.4Z"
        fill={`url(#${id})`}
      />
      <g stroke={seam} strokeWidth="1" fill="none">
        <circle cx="12" cy="15.4" r="4.6" />
        <path d="M12 10.8v9.2M7.4 15.4h9.2" />
      </g>
    </svg>
  );
}

/** Odznaka "Basket Approved" - rekomendacja przyznawana osobiście przez twórcę. */
export function BasketApprovedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[10px] font-bold uppercase tracking-[0.16em] text-white basket-gradient basket-ring ${className}`}
    >
      <FireBallIcon variant="basket" className="h-3.5 w-3.5" />
      Basket Approved
    </span>
  );
}

/** Limonkowa plakietka dla boisk dziwnych i śmiesznych. */
export function FunnyBadge({
  className = "",
  label = "Dziwne boisko",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[10px] font-bold uppercase tracking-[0.16em] text-black lime-gradient lime-ring ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 9.5h.01M15.5 9.5h.01" />
        <path d="M8 15c1.4 1.4 6.2 1.4 8-1" />
      </svg>
      {label}
    </span>
  );
}

/** Pomarańczowy trójkącik play w szkle - używany na miniaturze filmiku. */
export function PlayIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9 6.2c0-.9 1-1.5 1.8-1l7.3 4.6c.7.5.7 1.5 0 2l-7.3 4.6c-.8.5-1.8-.1-1.8-1V6.2Z" />
    </svg>
  );
}

/** Kostka do losowania - „losowe boisko” i „losuj dalej”. */
export function DiceIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
