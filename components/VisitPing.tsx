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
  return null;
}
