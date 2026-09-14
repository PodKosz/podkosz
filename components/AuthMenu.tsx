"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/config";
import { MOTYWY, useMotyw, ustawMotyw } from "@/lib/motyw";
import { GoogleMark } from "./GoogleMark";

export interface AuthUser {
  name: string;
  avatar: string | null;
  isAdmin: boolean;
  isBanned?: boolean;
}

export function AuthMenu({ user }: { user: AuthUser | null }) {
  const path = usePathname();
  const [error, setError] = useState<string | null>(null);
  const kotwica = useRef<HTMLDivElement>(null);

  /*
    Menu pamięta, NA KTÓRYM ADRESIE zostało otwarte - nie zwykłe „otwarte/zamknięte".

    Dzięki temu zamknięcie przy przejściu na inną stronę nie wymaga żadnego efektu:
    po zmianie adresu zapamiętana wartość przestaje pasować i menu jest zamknięte samo
    z siebie. Pierwsza wersja robiła to `useEffect`-em z `setOpen(false)` i słusznie
    poległa na regule `react-hooks/set-state-in-effect` - stan, który da się wyliczyć
    z tego, co już mamy, nie ma po co być osobnym stanem.
  */
  const [otwarteNa, setOtwarteNa] = useState<string | null>(null);
  const open = otwarteNa === path;
  const zamknij = () => setOtwarteNa(null);

  /*
    ZAMYKANIE MENU.

    Do tej pory menu zamykało się WYŁĄCZNIE po kliknięciu w jego własny link albo
    w awatar po raz drugi. Wszystko inne zostawiało je otwarte: dotknięcie mapy obok,
    cofnięcie się w przeglądarce, wylogowanie. Na telefonie to nie drobiazg - menu
    zasłania tam pół ekranu i wygląda, jakby strona się zawiesiła.

    Trzy wyjścia, bo każde zamyka co innego:
      - zmiana adresu: łapie nawigację, która nie poszła z tego menu (wstecz, wylogowanie,
        odnośnik spod spodu),
      - dotknięcie poza menu: najczęstszy odruch i jedyny, który działa bez celowania,
      - Escape: klawiatura ma prawo zamknąć to, co otworzyła.
  */
  useEffect(() => {
    if (!open) return;

    /*
      `pointerdown`, nie `click`: na telefonie palec schodzi z ekranu dopiero po chwili,
      a menu ma zniknąć od razu. Warunek `contains` jest tu konieczny - bez niego dotknięcie
      własnego linku zamykałoby menu, zanim odnośnik zdążyłby się uruchomić.
    */
    const pozaMenu = (e: PointerEvent) => {
      if (!kotwica.current?.contains(e.target as Node)) zamknij();
    };
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij();
    };

    document.addEventListener("pointerdown", pozaMenu);
    document.addEventListener("keydown", naKlawisz);
    return () => {
      document.removeEventListener("pointerdown", pozaMenu);
      document.removeEventListener("keydown", naKlawisz);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={() =>
            signInWithGoogle(path).catch((e: Error) => setError(e.message))
          }
          title={supabaseEnabled ? "Zaloguj się przez Google" : "Wymaga podpięcia bazy"}
          className="flex items-center gap-2 rounded-full border border-hairline bg-white/6 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted transition hover:text-ink lg:px-3 lg:py-2 lg:text-[12px] lg:tracking-[0.1em]"
        >
          <GoogleMark className="h-5 w-5" />
          <span className="hidden lg:inline">Zaloguj</span>
        </button>
        {error && (
          <p className="menu-konta absolute right-0 top-12 z-50 w-64 rounded-2xl p-3 text-[12px] leading-snug text-muted">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={kotwica}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOtwarteNa((o) => (o === path ? null : path))}
        className="flex items-center gap-2 rounded-full border border-hairline bg-white/6 p-1 transition hover:bg-white/10 lg:py-1 lg:pl-1 lg:pr-3"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full flame-gradient text-[13px] font-bold text-black">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="hidden max-w-[120px] truncate text-[12px] font-medium lg:block">
          {user.name}
        </span>
      </button>

      {/*
        Menu ma własne tło zamiast samego `glass`. Na telefonie rozwijało się nad mapą i
        zlewało się z nią w jedną plamę: szkło rozmywa to, co pod spodem, ale nie odcina
        od niego. Szczegóły wyglądu siedzą w `.menu-konta` - tło jest tam ciepłe i pełne,
        a szkło robi wierzchnia warstwa, nie przezroczystość.
      */}
      {open && (
        <div className="menu-konta absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl p-1.5">
          <Link
            href="/konto"
            onClick={zamknij}
            className="block rounded-xl px-3 py-2.5 text-[13px] text-muted hover:text-ink"
          >
            Moje konto
          </Link>
          <Link
            href="/ulubione"
            onClick={zamknij}
            className="block rounded-xl px-3 py-2.5 text-[13px] text-muted hover:text-ink"
          >
            Ulubione boiska
          </Link>
          {/*
            Przełącznik motywu - na razie tylko dla administratora, do pokazów. Stoi pod
            „Ulubionymi boiskami", bo to ustawienie widoku, nie pozycja nawigacji: nie
            prowadzi nigdzie, zmienia to, na co się właśnie patrzy.
          */}
          {user.isAdmin && <PrzelacznikMotywu />}

          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={zamknij}
              className="block rounded-xl px-3 py-2.5 text-[13px] text-muted hover:text-ink"
            >
              Panel administratora
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="block w-full rounded-xl px-3 py-2.5 text-left text-[13px] text-muted hover:text-ink"
          >
            Wyloguj
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Trzy motywy w jednym rzędzie, jak segmentowany przełącznik.
 *
 * Zaznaczony segment dostaje gradient barwy głównej - a ta należy już do wybranego motywu,
 * więc przełącznik pokazuje sobą to, co włącza. Przy „Coconaut" zaznaczenie jest zielone,
 * przy „Polska" czerwone; nie trzeba dokładać próbek barw, bo cały interfejs jest próbką.
 */
function PrzelacznikMotywu() {
  const motyw = useMotyw();

  return (
    <div className="px-3 pb-1.5 pt-2.5">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-faint">Motyw</p>
      <div className="segmenty flex gap-1 p-1">
        {MOTYWY.map((m) => (
          <button
            key={m.id}
            onClick={() => ustawMotyw(m.id)}
            data-on={motyw === m.id}
            title={`Motyw ${m.nazwa}`}
            className="segment flex-1 px-1 py-1.5 text-[11px] text-muted"
          >
            {m.nazwa}
          </button>
        ))}
      </div>
    </div>
  );
}
