"use client";

import { useEffect } from "react";

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
    zapomniane karty w drugim rzędzie. Czterdzieści pięć sekund przy oknie dwóch minut
    po stronie bazy wybacza jedno zgubione uderzenie.
  */
  useEffect(() => {
    const puls = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/obecnosc", { method: "POST", keepalive: true }).catch(
        () => undefined
      );
    };

    const start = setTimeout(puls, 2500);
    const zegar = window.setInterval(puls, 45_000);
    document.addEventListener("visibilitychange", puls);

    return () => {
      clearTimeout(start);
      window.clearInterval(zegar);
      document.removeEventListener("visibilitychange", puls);
    };
  }, []);
  return null;
}
