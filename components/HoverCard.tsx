import { Court, SURFACE_LABEL, TYPE_LABEL } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { ClockIcon, FireBallIcon, HoopIcon, BasketApprovedBadge, SurfaceIcon } from "./icons";

/** Podgląd po najechaniu na pinezkę: miniaturki + szybkie info. */
export function HoverCard({ court }: { court: Court }) {
  const thumbs = court.photos.slice(0, 3);
  return (
    <div className="glass w-[320px] overflow-hidden rounded-[22px] rise">
      <div className="grid grid-cols-3 gap-[2px] bg-white/5">
        {thumbs.map((p, i) => (
          <div key={i} className={`aspect-[4/3] overflow-hidden ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
            <CourtPhoto photo={p} seed={court.seed + i} />
          </div>
        ))}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{court.name}</h3>
            <p className="truncate text-[12px] text-muted">
              {court.city} · {TYPE_LABEL[court.type]}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-[12px] font-semibold">
            <FireBallIcon className="h-3.5 w-3.5" />
            {court.likes}
          </span>
        </div>

        {court.basketApproved && <BasketApprovedBadge className="mt-2.5" />}

        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <Fact icon={<HoopIcon className="h-3.5 w-3.5" />} label="kosze" value={String(court.hoops)} />
          <Fact icon={<ClockIcon className="h-3.5 w-3.5" />} label="otwarte" value={court.hours} />
          <Fact icon={<SurfaceIcon className="h-3.5 w-3.5" />} label="podłoże" value={SURFACE_LABEL[court.surface]} />
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-white/4 px-2 py-1.5">
      <div className="flex items-center gap-1 text-flame/90">{icon}</div>
      <div className="mt-1 truncate font-medium leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}
