/**
 * Dane strukturalne jako tekst, który wolno wstawić do `<script>`.
 *
 * `JSON.stringify` sam z siebie NIE WYSTARCZA i to była tu dziura. Wnętrze `<script>`
 * przeglądarka czyta jako surowy tekst i kończy go na pierwszym napisie `</script`,
 * nie zważając na to, że stoi on w środku łańcucha JSON. A do tego JSON-a wchodzą nazwy,
 * opisy i adresy boisk - czyli TEKST OD LUDZI, wpisany w zgłoszeniu. Nazwa boiska postaci
 * `</script><img src=x onerror=...>` zamykała skrypt i wstawiała swój kod w cudzą stronę:
 * zapisany XSS, uruchamiany każdemu, kto otworzy podstronę tego boiska.
 *
 * Moderacja tego nie łapie: w panelu widać zwykły tekst, a nie to, co zrobi z niego parser
 * HTML. Nagłówek CSP też nie - kod stoi w naszym dokumencie, więc jest tak samo „nasz"
 * jak reszta strony.
 *
 * Zamiana `<`, `>` i `&` na sekwencje uXXXX rozwiązuje to u źródła: dla czytnika JSON to
 * dokładnie ten sam napis, a dla parsera HTML nie ma już czego domykać. U+2028 i U+2029
 * lecą przy okazji - są poprawne w JSON, ale w JavaScripcie łamią wiersz.
 *
 * Pętla po znakach, a nie wyrażenie regularne, z jednego powodu: U+2028 jest dla
 * JavaScriptu znakiem końca wiersza, więc wpisany wprost do literału wyrażenia
 * regularnego rozcina go na dwa i psuje plik.
 */
const DO_UCIECZKI = new Set([0x3c, 0x3e, 0x26, 0x2028, 0x2029]);

export function jsonDoSkryptu(dane: unknown): string {
  const tekst = JSON.stringify(dane) ?? "null";
  let wynik = "";

  for (const znak of tekst) {
    const kod = znak.codePointAt(0) ?? 0;
    wynik += DO_UCIECZKI.has(kod)
      ? "\\u" + kod.toString(16).padStart(4, "0")
      : znak;
  }

  return wynik;
}
