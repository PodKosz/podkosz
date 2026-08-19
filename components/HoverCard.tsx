"use client";

import { MapCourt, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { thumbUrl, thumbWidth, useCourtPhotos } from "@/lib/galeria";
import { PhotoPlaceholder } from "./CourtPhoto";
import { ClockIcon, FireBallIcon, HoopIcon, BasketApprovedBadge, SurfaceIcon } from "./icons";

/**
 * Podgląd po najechaniu na pinezkę (na dotyku: po jej dotknięciu) - miniaturki i szybkie info.
 * `tapHint` dokłada stopkę z zaproszeniem do dotknięcia, bo wtedy cała karta jest linkiem.
 * Wersja dotykowa jest o ~30% mniejsza od tej na kursor: szerokość ogranicza wrapper na mapie,
 * a marginesy i kroje pisma schodzą tutaj, żeby karta nie zajmowała pół ekranu telefonu.
 */
export function HoverCard({ court, tapHint = false }: { court: MapCourt; tapHint?: boolean }) {
  // zdjęcia nie przychodzą razem z listą boisk - dociągamy je dla tej jednej pinezki
  const thumbs = useCourtPhotos(court.id, 3);
  const kadry = thumbs.length ? thumbs : [null, null, null];
  return (
    <div
      className={`glass overflow-hidden rounded-[22px] rise ${
        tapHint ? "w-full" : "w-[320px]"
      }`}
    >
      <div className="grid grid-cols-3 gap-[2px] bg-white/5">
        {kadry.map((p, i) => (
          <div
            key={i}
            className={`relative aspect-[4/3] overflow-hidden ${
              i === 0 ? "col-span-2 row-span-2" : ""
            }`}
          >
            {p?.url ? (
              /*
                Zwykły <img> ze stałym adresem miniatury, a nie next/image: ten sam adres
                rozgrzewamy z góry (patrz prefetchCourtPhotos), więc obrazek jest już
                w pamięci przeglądarki i wizytówka pojawia się bez migania.
              */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl(p.url, thumbWidth(i))}
                alt={p.caption}
                className="h-full w-full object-cover"
                decoding="async"
              />
            ) : (
              // póki zdjęcia lecą z serwera, stoi grafika zastępcza - nic nie przeskakuje
              <PhotoPlaceholder kind={i === 0 ? "narożnik" : "kosz-a"} seed={court.seed + i} />
            )}
          </div>
        ))}
      </div>

      <div className={tapHint ? "p-2.5" : "p-3.5"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={`truncate font-semibold tracking-tight ${
                tapHint ? "text-[13px]" : "text-[15px]"
              }`}
            >
              {court.name}
            </h3>
            <p className={`truncate text-muted ${tapHint ? "text-[11px]" : "text-[12px]"}`}>
              {court.city} · {TYPE_LABEL[court.type]}
            </p>
          </div>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 font-semibold ${
              tapHint ? "py-0.5 text-[11px]" : "py-1 text-[12px]"
            }`}
          >
            <FireBallIcon className={tapHint ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {court.likes}
          </span>
        </div>

        {court.basketApproved && <BasketApprovedBadge className={tapHint ? "mt-2" : "mt-2.5"} />}

        <div
          className={`grid grid-cols-3 ${
            tapHint ? "mt-2 gap-1.5 text-[10px]" : "mt-3 gap-2 text-[11px]"
          }`}
        >
          <Fact
            compact={tapHint}
            icon={<HoopIcon className={tapHint ? "h-3 w-3" : "h-3.5 w-3.5"} />}
            label="kosze"
            value={String(court.hoops)}
          />
          <Fact
            compact={tapHint}
            icon={<ClockIcon className={tapHint ? "h-3 w-3" : "h-3.5 w-3.5"} />}
            label="otwarte"
            value={court.hours}
          />
          <Fact
            compact={tapHint}
            icon={<SurfaceIcon className={tapHint ? "h-3 w-3" : "h-3.5 w-3.5"} />}
            label="podłoże"
            value={surfaceLabel(court.surface)}
          />
        </div>

        {tapHint && (
          <p className="mt-2 flex items-center justify-center gap-1.5 border-t border-hairline pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-flame">
            dotknij, żeby otworzyć boisko
            <span aria-hidden>→</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-white/4 ${
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      }`}
    >
      <div className="flex items-center gap-1 text-flame/90">{icon}</div>
      <div className={`truncate font-medium leading-tight ${compact ? "mt-0.5" : "mt-1"}`}>
        {value}
      </div>
      <div
        className={`uppercase tracking-wider text-faint ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        {label}
      </div>
    </div>
  );
}
