"use client";

import { useSyncExternalStore } from "react";
import type { Access } from "@/lib/types";
import { otwarcieTeraz } from "@/lib/godziny-otwarcia";

/*
  Zegar co minutę. Karta boiska jest budowana z góry i leży w pamięci podręcznej, więc stan
  „otwarte" policzony na serwerze byłby stanem z chwili budowania - a strona żyje pół godziny.
  Liczymy więc w przeglądarce: serwer i pierwszy render klienta nie pokazują nic (ta sama
  migawka, zgodna hydracja), a zaraz potem pojawia się stan na teraz i odświeża co minutę.
*/
let minuta = 0;
function subskrybuj(odswiez: () => void) {
  const zegar = window.setInterval(() => {
    minuta = Math.floor(Date.now() / 60_000);
    odswiez();
  }, 15_000);
  return () => window.clearInterval(zegar);
}
const migawka = () => minuta || (minuta = Math.floor(Date.now() / 60_000));
const migawkaSerwera = () => 0;

const KROPKA = {
  otwarte: "#30d158",
  wkrotce: "#ffb340",
  zamkniete: "#ff453a",
  ograniczony: "var(--color-faint)",
} as const;

/** „Otwarte · do 22:00", „Wkrótce zamknięte · do 22:00", „Zamknięte · otwarcie 6:00". */
export function StatusOtwarcia({ hours, access }: { hours: string; access: Access }) {
  const teraz = useSyncExternalStore(subskrybuj, migawka, migawkaSerwera);
  if (!teraz) return null;

  const stan = otwarcieTeraz(hours, access, new Date(teraz * 60_000));
  if (!stan) return null;

  /* kropka oddzielająca od miasta jest tutaj, a nie w karcie - bez stanu nie ma czego oddzielać */
  return (
    <>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: KROPKA[stan.stan] }} />
        <span className="truncate">
          <span className="font-semibold text-ink">{stan.etykieta}</span>
          {stan.dopisek && <span> · {stan.dopisek}</span>}
        </span>
      </span>
    </>
  );
}
