"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSesja } from "@/lib/sesja";
import { CheckIn } from "./CheckIn";
import { FavoriteButton } from "./FavoriteButton";
import { LikeButton } from "./LikeButton";
import { useLosowanie } from "./Losowanie";
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
 * Pasek „losuj dalej" pojawia się po wejściu z losowania.
 *
 * Parametr adresu czytamy w efekcie, po zamontowaniu - a nie hakiem `useSearchParams`.
 * Powód jest konkretny: karta boiska jest budowana z góry, więc przy pierwszym renderze
 * w przeglądarce parametry są jeszcze puste. Warunek `if (!czynne) return null` sprawiał
 * wtedy, że klient nie rysował NIC, a serwerowy przycisk zostawał w drzewie jako martwy
 * HTML - React nie przejmował go na własność i kliknięcie nie robiło nic. Dopóki był to
 * zwykły odnośnik, nikt tego nie zauważył: link działa bez JavaScriptu. Przycisk już nie.
 *
 * Odczyt po zamontowaniu daje ten sam wynik na serwerze i przy pierwszym renderze klienta
 * (nic), więc React ma co hydratować, a przycisk pojawia się klatkę później - już żywy.
 */
export function PasekLosowania({ slug }: { slug: string }) {
  const { losuj, nakladka } = useLosowanie();

  /*
    `useSyncExternalStore` jest tu dokładnie na swoim miejscu: pierwszy render bierze
    migawkę serwerową (pusty adres), więc serwer i klient zgadzają się co do joty, a zaraz
    po hydratacji React przechodzi na migawkę z przeglądarki. Bez tego trzeba by ustawiać
    stan w efekcie, co jest tym samym w gorszym opakowaniu.
  */
  const zapytanie = useSyncExternalStore(
    (odswiez) => {
      window.addEventListener("popstate", odswiez);
      return () => window.removeEventListener("popstate", odswiez);
    },
    () => window.location.search,
    () => ""
  );

  const p = new URLSearchParams(zapytanie);
  if (p.get("losowe") !== "1") return null;
  const adres = `/losowe?omin=${slug}${p.get("dziwne") === "1" ? "&dziwne=1" : ""}`;

  return (
    <>
      <button
        onClick={() => losuj(adres)}
        className="inline-flex w-fit items-center gap-1.5 rounded-full flame-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.14em]"
      >
        <DiceIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> losuj dalej
      </button>
      {nakladka}
    </>
  );
}
