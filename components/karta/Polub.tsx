"use client";

import { useId, useState } from "react";
import { DUPLIKAT, komunikatZapisu } from "@/lib/bledy-zapisu";
import { useSesja, zapamietajReakcje } from "@/lib/sesja";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useBramka } from "../BramkaLogowania";

/**
 * „Polub" - serce na karcie boiska. Od 23.10.2026 to jeden przycisk w miejsce dwóch: Hype
 * (polecenie boiska innym, licznik przy pinezce) i „Do ulubionych" (własna lista). Polubienie
 * zapisuje oba wiersze naraz - boisko dostaje głos i ląduje w „Ulubionych boiskach" na koncie,
 * cofnięcie zdejmuje jedno i drugie. Licznik to dalej liczba z `likes`, czyli dawny Hype.
 *
 * Po polubieniu kontur serca wypełnia się piłką: pomarańcz wznosi się od dołu, a na nim
 * wychodzą szwy piłki do kosza - jak w logo.
 */
export function Polub({ courtId, likes }: { courtId: string; likes: number }) {
  const sesja = useSesja();
  return (
    <Serce
      /* stan początkowy z sesji - przemontowanie, gdy sesja wróci (jak w `reakcje.tsx`) */
      key={sesja ? `wiem-${sesja.likes.includes(courtId)}` : "czekam"}
      courtId={courtId}
      likes={likes}
      initiallyLiked={sesja?.likes.includes(courtId) ?? false}
    />
  );
}

function Serce({ courtId, likes, initiallyLiked }: { courtId: string; likes: number; initiallyLiked: boolean }) {
  const { wymagaj } = useBramka();
  const [lubie, setLubie] = useState(initiallyLiked);
  /* licznik bez własnego głosu - dzięki temu cofnięcie i ponowne polubienie nie liczą podwójnie */
  const [bezMnie] = useState(likes - (initiallyLiked ? 1 : 0));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  /* animacja wypełnienia gra tylko po kliknięciu, nie przy wejściu na stronę z polubionym */
  const [kliknieto, setKliknieto] = useState(false);

  const toggle = async () => {
    if (busy) return;
    if (!(await wymagaj("polubić boisko"))) return;

    const next = !lubie;
    setLubie(next);
    setKliknieto(true);
    setHint(null);

    const supabase = await supabaseBrowser();
    if (!supabase) return; // tryb testowy bez bazy: zostaje stan lokalny

    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setLubie(!next);
      return;
    }

    const [glos, lista] = next
      ? await Promise.all([
          supabase.from("likes").insert({ court_id: courtId, user_id: user.id }),
          supabase.from("favorites").insert({ court_id: courtId, user_id: user.id }),
        ])
      : await Promise.all([
          supabase.from("likes").delete().eq("court_id", courtId).eq("user_id", user.id),
          supabase.from("favorites").delete().eq("court_id", courtId).eq("user_id", user.id),
        ]);
    setBusy(false);

    /* duplikat = wiersz już był, czyli stan docelowy obowiązuje (karta leci z cache, sesja dochodzi później) */
    const blad = [glos.error, lista.error].find((e) => e && e.code !== DUPLIKAT);
    if (blad) {
      setLubie(!next);
      setHint(komunikatZapisu(blad));
      return;
    }
    zapamietajReakcje("likes", courtId, next);
    zapamietajReakcje("favorites", courtId, next);
  };

  const liczba = bezMnie + (lubie ? 1 : 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={lubie}
        aria-label={lubie ? `Cofnij polubienie (${liczba})` : `Polub boisko (${liczba})`}
        className="kb-przycisk group gap-2 pl-3.5 pr-4"
      >
        <IkonaSerca pelne={lubie} animuj={kliknieto} />
        <span>{lubie ? "Lubisz to" : "Polub"}</span>
        <span className="tabular-nums text-muted">{liczba}</span>
      </button>
      {hint && (
        <p className="glass absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl p-3 text-[12px] leading-snug text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/* serce w siatce 24 x 24 - ten sam kształt co w prototypach karty */
const SERCE =
  "M12 20.3s-7.4-4.5-9.3-9C1.4 8.1 3.3 4.6 6.8 4.6c2.1 0 3.6 1.2 5.2 3.1 1.6-1.9 3.1-3.1 5.2-3.1 3.5 0 5.4 3.5 4.1 6.7-1.9 4.5-9.3 9-9.3 9z";

/**
 * Serce z piłką. Wypełnienie to prostokąt przycięty do serca i przesuwany w górę (CSS,
 * `.kb-serce-wypelnienie`), szwy to cztery linie piłki przycięte tym samym kształtem.
 */
function IkonaSerca({ pelne, animuj }: { pelne: boolean; animuj: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`kb-serce h-[22px] w-[22px] shrink-0 ${pelne ? "kb-serce-pelne" : ""} ${animuj ? "kb-serce-anim" : ""}`}
    >
      <defs>
        <clipPath id={`serce-${id}`}>
          <path d={SERCE} />
        </clipPath>
        <linearGradient id={`pilka-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--grad-1)" />
          <stop offset="0.5" stopColor="var(--grad-2)" />
          <stop offset="1" stopColor="var(--grad-3)" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#serce-${id})`}>
        <rect className="kb-serce-wypelnienie" x="0" y="0" width="24" height="24" fill={`url(#pilka-${id})`} />
        <g className="kb-serce-szwy" fill="none" stroke="#1a0b02" strokeWidth="1.15" strokeLinecap="round">
          <path d="M12 3v19" />
          <path d="M1.5 11.2c3.6 1.5 17.4 1.5 21 0" />
          <path d="M5.6 4.2c3.1 3.4 3.3 8.6-.4 13" />
          <path d="M18.4 4.2c-3.1 3.4-3.3 8.6.4 13" />
        </g>
      </g>
      <path d={SERCE} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className="kb-serce-kontur" />
    </svg>
  );
}
