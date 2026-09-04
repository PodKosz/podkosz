import Link from "next/link";
import { Court, TYPE_LABEL, surfaceLabel } from "@/lib/types";
import { CourtPhoto } from "./CourtPhoto";
import { BasketApprovedBadge, FireBallIcon, FunnyBadge, PinIcon } from "./icons";

/**
 * Kafelek boiska używany wszędzie poza mapą: ulubione, podstrony miast i województw,
 * profile odkrywców. Zawsze jest odnośnikiem, więc wyszukiwarki mają po czym chodzić.
 *
 * Reakcja na kursor jest ta sama, co na kartach rankingu (`.karta-rankingu`): kafelek
 * podnosi się o kilka pikseli, zdjęcie podchodzi, a po szkle przejeżdża smuga światła.
 * Wcześniej było tu samo `brightness-110` - rozjaśnienie całego kafla, które wygląda jak
 * podświetlenie wiersza w tabeli, a nie jak dotknięcie karty. Skoro ten sam gest jest już
 * opisany w arkuszu, nie ma powodu mieć dwóch różnych odpowiedzi na to samo najechanie.
 *
 * Kolejność warstw jest tu istotna: smuga leży NAD zdjęciem, ale pod treścią - dlatego
 * napisy dostają własny `z-index`, a smuga stoi w drzewie na końcu. Element pozycjonowany
 * maluje się nad niepozycjonowanym niezależnie od kolejności, więc bez tego `z-[2]`
 * światło przejeżdżałoby po nazwie boiska.
 */
export function CourtCard({ court, showCity = true }: { court: Court; showCity?: boolean }) {
  return (
    <Link
      href={`/boisko/${court.slug}`}
      className="karta-rankingu glass block overflow-hidden rounded-[22px]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CourtPhoto photo={court.photos[0]} seed={court.seed} sizes="(max-width: 640px) 100vw, 380px" />
        {(court.basketApproved || court.funny) && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {court.basketApproved && <BasketApprovedBadge />}
            {court.funny && <FunnyBadge />}
          </div>
        )}
      </div>
      <div className="relative z-[2] flex items-center gap-3 p-4">
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

      <span aria-hidden className="karta-rankingu-blysk" />
    </Link>
  );
}
