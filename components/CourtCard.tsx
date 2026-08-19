import Link from "next/link";
import { Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { BasketApprovedBadge, FireBallIcon, FunnyBadge, PinIcon } from "./icons";

/**
 * Kafelek boiska używany wszędzie poza mapą: ulubione, podstrony miast i województw,
 * profile odkrywców. Zawsze jest odnośnikiem, więc wyszukiwarki mają po czym chodzić.
 */
export function CourtCard({ court, showCity = true }: { court: Court; showCity?: boolean }) {
  return (
    <Link
      href={`/boisko/${court.slug}`}
      className="glass overflow-hidden rounded-[22px] transition hover:brightness-110"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CourtPhoto photo={court.photos[0]} seed={court.seed} />
        {(court.basketApproved || court.funny) && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {court.basketApproved && <BasketApprovedBadge />}
            {court.funny && <FunnyBadge />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{court.name}</span>
          <span className="flex items-center gap-1 truncate text-[13px] text-muted">
            <PinIcon className="h-3.5 w-3.5 shrink-0" />
            {showCity ? `${court.city} · ` : ""}
            {TYPE_LABEL[court.type]} · {surfaceLabel(court.surface)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-glow">
          <FireBallIcon className="h-4 w-4" /> {court.likes}
        </span>
      </div>
    </Link>
  );
}
