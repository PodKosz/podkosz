"use client";

import { useLayoutEffect, useState } from "react";
import { CourtOutline } from "./CourtOutline";
import { czyKadrStartowy } from "@/lib/adres";
import "./kadr-startowy.css";

/**
 * Zasłona nad mapą na czas wczytywania - od pierwszej klatki strony do chwili, w której
 * żywa mapa ma komplet kafelków kadru.
 *
 * Pokazuje jedno z dwóch:
 *  - KADR STARTOWY: gotowy obrazek mapy Polski (patrz `scripts/kadr-startowy.mjs`),
 *    ustawiony co do piksela tam, gdzie mapa go za chwilę narysuje. Przy pierwszym wejściu
 *    mapa jest więc na ekranie od razu, a podmiana na żywą niczego nie przesuwa;
 *  - kontur boiska - gdy kadr ma być inny niż cała Polska (link do miejsca, powrót
 *    z karty boiska, województwo w adresie) albo gdy ekran jest za niski, żeby obrazek
 *    miał sens. Tam gotowego obrazka nie ma i nie może być.
 *
 * Który wariant, rozstrzyga klasa `start-polska` na `html`. Przy pierwszym wczytaniu stawia
 * ją skrypt w <head> (`SKRYPT_STARTU`), zanim cokolwiek się narysuje - inaczej przez klatkę
 * stałby zły wariant. Tu tylko ją poprawiamy przy przejściu na mapę bez przeładowania
 * strony, bo wtedy skrypt w <head> się nie wykonuje, a kadr mógł się zmienić.
 *
 * Zasłona leży w Explorerze, a nie w mapie: MapLibre przychodzi z opóźnieniem jako osobna
 * paczka i gdyby zasłona była jej częścią, pojawiłaby się dopiero razem z nią.
 */
export function ZaslonaMapy({ gotowa }: { gotowa: boolean }) {
  const [zeszla, setZeszla] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("start-polska", czyKadrStartowy());
  }, []);

  if (zeszla) return null;

  return (
    <div
      aria-hidden
      className={`zaslona-mapy${gotowa ? " schodzi" : ""}`}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && gotowa) setZeszla(true);
      }}
    >
      <div className="kadr-startowy">
        <span className="kadr-startowy-obraz" />
        <div className="zaslona-kontur">
          <div className="w-[min(560px,72vw)] opacity-25">
            <CourtOutline uid="mapa-zaslona" />
          </div>
        </div>
      </div>
    </div>
  );
}
