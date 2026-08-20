"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSesja } from "@/lib/sesja";
import { CheckIn } from "./CheckIn";
import { FavoriteButton } from "./FavoriteButton";
import { LikeButton } from "./LikeButton";
import { DiceIcon, PencilIcon } from "./icons";

/**
 * Elementy karty boiska zależne od tego, kto patrzy.
 *
 * Karta boiska jest identyczna dla wszystkich (dzięki temu leci z cache), a te kawałki
 * dociągają stan użytkownika już w przeglądarce. Przyciski trzymają swój stan w `useState`
 * na podstawie wartości początkowej, więc po otrzymaniu sesji przemontowujemy je przez `key` -
 * inaczej zostałyby na wartości „niepodpalone".
 */

export function Podpalenie({ courtId, likes }: { courtId: string; likes: number }) {
  const sesja = useSesja();

  return (
    <LikeButton
      key={sesja ? `wiem-${sesja.likes.includes(courtId)}` : "czekam"}
      courtId={courtId}
      initial={likes}
      initiallyLiked={sesja?.likes.includes(courtId) ?? false}
      signedIn={Boolean(sesja?.user)}
    />
  );
}

export function Ulubione({ courtId, compact = false }: { courtId: string; compact?: boolean }) {
  const sesja = useSesja();

  return (
    <FavoriteButton
      key={sesja ? `wiem-${sesja.favorites.includes(courtId)}` : "czekam"}
      courtId={courtId}
      initiallyFavorite={sesja?.favorites.includes(courtId) ?? false}
      signedIn={Boolean(sesja?.user)}
      compact={compact}
    />
  );
}

export function ZagramDzis({ courtId }: { courtId: string }) {
  const sesja = useSesja();
  return <CheckIn courtId={courtId} signedIn={Boolean(sesja?.user)} />;
}

/** Skrót do edycji wpisu - tylko dla administratora. */
export function LinkEdycji({ slug }: { slug: string }) {
  const sesja = useSesja();
  if (!sesja?.user?.isAdmin) return null;

  return (
    <Link
      href={`/admin?edytuj=${slug}`}
      className="inline-flex w-fit items-center gap-1.5 rounded-full flame-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
    >
      <PencilIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> edytuj
    </Link>
  );
}

/**
 * Pasek „losuj dalej" pojawia się po wejściu z losowania. Parametr adresu czytamy tutaj,
 * w przeglądarce - gdyby czytała go strona na serwerze, karta boiska nie mogłaby być
 * cache'owana (dostęp do parametrów wymusza renderowanie na żądanie). Odczyt parametrów musi
 * przy tym siedzieć w granicy `Suspense`, bo strona jest budowana z góry, kiedy adresu
 * jeszcze nie ma.
 */
export function PasekLosowania({ slug }: { slug: string }) {
  return (
    <Suspense fallback={null}>
      <PasekLosowaniaTresc slug={slug} />
    </Suspense>
  );
}

function PasekLosowaniaTresc({ slug }: { slug: string }) {
  const parametry = useSearchParams();
  if (parametry.get("losowe") !== "1") return null;

  const dziwne = parametry.get("dziwne") === "1";

  return (
    <Link
      href={`/losowe?omin=${slug}${dziwne ? "&dziwne=1" : ""}`}
      prefetch={false}
      className="inline-flex w-fit items-center gap-1.5 rounded-full flame-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
    >
      <DiceIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> losuj dalej
    </Link>
  );
}
