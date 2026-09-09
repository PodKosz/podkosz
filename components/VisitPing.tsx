"use client";

import { useEffect } from "react";

/**
 * Jak często karta melduje, że wciąż jest otwarta.
 *
 * Musi być zgodne z oknem w `ilu_online` (pięć minut) - patrz nota przy pulsie niżej
 * i `supabase/migration-obecnosc-okno.sql`.
 */
const PULS_MS = 150_000;

/**
 * Odnotowuje jedną wizytę na sesję przeglądarki - do statystyk w panelu.
 *
 * Zwykły fetch do własnego endpointu, a nie klient Supabase: dzięki temu czytelnik,
 * który nic nie kliknie, nie pobiera biblioteki Supabase (248 kB). Wysyłamy to po
 * pierwszym bezczynnym momencie, żeby nie konkurować z wczytywaniem treści.
 */
export function VisitPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("podkosz-visit") === "1") return;
      sessionStorage.setItem("podkosz-visit", "1");
    } catch {
      // tryb prywatny bez sessionStorage - wtedy policzymy wizytę raz na wejście
    }

    const wyslij = () => {
      void fetch("/api/wizyta", { method: "POST", keepalive: true }).catch(() => undefined);
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) idle(wyslij);
    else setTimeout(wyslij, 1200);
  }, []);

  /*
    Puls obecności - osobno od wizyty, bo powtarza się przez cały czas czytania. Milknie,
    gdy karta schodzi w tło: licznik ma pokazywać ludzi PATRZĄCYCH na stronę, a nie
    zapomniane karty w drugim rzędzie.
    ------------------------------------------------------------------ dlaczego 150 s

    Było czterdzieści pięć. Przy stu otwartych kartach to dwa żądania na sekundę, przy
    trzystu - prawie siedem, bez przerwy, dobę na dobę: tyle samo wywołań funkcji na
    Vercelu i tyle samo zapisów do bazy. Wszystko po to, żeby w panelu stała jedna liczba.

    Sto pięćdziesiąt sekund przy oknie pięciu minut po stronie bazy (`ilu_online`)
    wybacza jedno zgubione uderzenie dokładnie tak samo, jak wybaczało 45 s przy oknie
    dwóch minut - a kosztuje trzy razy mniej. Licznik pokazuje wtedy „ilu było na stronie
    w ostatnich pięciu minutach"; dla liczby, na którą patrzy się raz na godzinę, to ta
    sama informacja.

    Te dwie liczby są sprzężone: podniesienie pulsu bez podniesienia okna sprawiłoby, że
    połowa ludzi wypadałaby z licznika między uderzeniami.
  */
  useEffect(() => {
    const puls = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/obecnosc", { method: "POST", keepalive: true }).catch(
        () => undefined
      );
    };

    const start = setTimeout(puls, 2500);
    const zegar = window.setInterval(puls, PULS_MS);
    document.addEventListener("visibilitychange", puls);

    return () => {
      clearTimeout(start);
      window.clearInterval(zegar);
      document.removeEventListener("visibilitychange", puls);
    };
  }, []);
  return null;
}
