"use client";

import { useSyncExternalStore } from "react";
import type { Access } from "@/lib/types";
import { otwarcieTeraz, type StanOtwarcia } from "@/lib/godziny-otwarcia";

/*
  Zegar co minutę. Karta boiska jest budowana z góry i leży w pamięci podręcznej, więc stan
  „otwarte" policzony na serwerze byłby stanem z chwili budowania - a strona żyje pół godziny.
  Liczymy więc w przeglądarce: serwer i pierwszy render klienta pokazują to samo (kreskę -
  zgodna hydracja), a zaraz potem pojawia się stan na teraz i odświeża co minutę.
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

/* trzy kolory: zielony otwarte, żółty wkrótce zamknięcie, czerwony zamknięte */
const KROPKA: Record<StanOtwarcia, string> = {
  otwarte: "#30d158",
  wkrotce: "#ffd60a",
  zamkniete: "#ff453a",
  ograniczony: "var(--color-faint)",
};

/* krótka wartość do komórki paska - pełne „Wkrótce zamknięte" nie mieści się w jednej trzeciej telefonu */
const KROTKO: Record<StanOtwarcia, string> = {
  otwarte: "Otwarte",
  wkrotce: "Wkrótce",
  zamkniete: "Zamknięte",
  ograniczony: "Ograniczony",
};

/**
 * Komórka „Teraz" w pasku pod nazwą boiska: czy boisko jest otwarte o tej godzinie, z kolorową
 * kropką, a pod spodem do której albo od której („do 22:00", „otwarcie 6:00", „całą dobę").
 * Boisko bez godzin, z których da się coś wyczytać, dostaje kreskę.
 */
export function KomorkaOtwarcia({ hours, access }: { hours: string; access: Access }) {
  const teraz = useSyncExternalStore(subskrybuj, migawka, migawkaSerwera);
  const stan = teraz ? otwarcieTeraz(hours, access, new Date(teraz * 60_000)) : null;
  const dopisek = stan?.stan === "wkrotce" ? `zamknięcie ${stan.dopisek?.replace(/^do /, "o ") ?? ""}` : stan?.dopisek;

  return (
    <div className="kb-info-komorka" aria-live="polite">
      <small>Teraz</small>
      <b className="kb-info-status">
        {stan && <i aria-hidden style={{ background: KROPKA[stan.stan] }} />}
        {stan ? KROTKO[stan.stan] : "–"}
      </b>
      <span>{stan ? dopisek || " " : teraz ? "brak godzin" : " "}</span>
    </div>
  );
}
