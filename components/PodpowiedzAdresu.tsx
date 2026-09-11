"use client";

import { sugestiaAdresu } from "@/lib/adres-email";

/**
 * Cicha podpowiedź pod polem z adresem: „chyba chodziło o gmail.com".
 *
 * Wersja dla pól, przy których nie ma własnego przycisku wysyłki - w kreatorze boiska adres
 * jest nieobowiązkowy i stoi obok sześciu zdjęć. Zatrzymywanie tam całego zgłoszenia pytaniem
 * o opcjonalnego maila byłoby karą za uprzejmość, więc podpowiedź tylko leży obok i czeka.
 *
 * Tam, gdzie formularz służy wyłącznie do zostawienia adresu (zapis na otwarcie), pytamy
 * wprost przy wysyłce - bo tam przeoczenie kończy się listem w próżnię i ciszą.
 */
export function PodpowiedzAdresu({
  adres,
  onPopraw,
}: {
  adres: string;
  onPopraw: (poprawiony: string) => void;
}) {
  const sugestia = sugestiaAdresu(adres.trim().toLowerCase());
  if (!sugestia) return null;

  return (
    <p className="mt-2 text-[13px] text-muted">
      Chyba chodziło o{" "}
      <button
        type="button"
        onClick={() => onPopraw(sugestia)}
        className="font-semibold text-flame underline underline-offset-4 transition hover:brightness-110"
      >
        {sugestia}
      </button>
      {" "}- kliknij, żeby poprawić.
    </p>
  );
}
