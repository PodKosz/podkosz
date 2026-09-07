/**
 * Adres IP klienta - z nagłówka, któremu można wierzyć.
 *
 * Wcześniej brało się to tak: `cf-connecting-ip`, a jeśli nie ma, to PIERWSZA wartość
 * z `x-forwarded-for`. Obie decyzje były błędne i obie dawały się wykorzystać jednym
 * `curl -H`.
 *
 * `x-forwarded-for` to lista dopisywana po drodze: każdy pośrednik dokleja na KONIEC adres,
 * który sam widział. Pierwsza wartość jest więc tą, którą wpisał klient - czyli dowolną.
 * Ostatnia jest dopisana przez naszego pośrednika (brzeg Vercela) i to jedyna, której nie
 * da się podrobić. Serwis stoi na Vercelu, nie za Cloudflare, więc `cf-connecting-ip`
 * w ogóle nie ma prawa tu dojść - jeśli jest, to znaczy, że ktoś go podłożył ręcznie.
 *
 * Skutki starej wersji były dwa i oba poważne:
 *   - LISTA BANÓW do obejścia jednym nagłówkiem: zbanowany adres wystarczyło podać jako
 *     `cf-connecting-ip: 1.2.3.4` i blokada w proxy przestawała cokolwiek znaczyć.
 *   - STATYSTYKI I OBECNOŚĆ do zasypania: licznik wizyt i „ilu jest teraz" trzymają jeden
 *     wiersz na skrót adresu, więc podając za każdym żądaniem inny adres dawało się
 *     hodować dowolnie dużo wierszy i pokazać w panelu dowolną liczbę.
 *
 * Reguły SQL (`reports_rate_limit`, `feedback_rate_limit`) brały ostatnią wartość od
 * początku - teraz kod TypeScriptu robi to samo, więc obie strony liczą ten sam adres.
 */

/** Nagłówek Cloudflare bierzemy pod uwagę tylko wtedy, gdy serwis rzeczywiście za nim stoi. */
const ZA_CLOUDFLARE = process.env.PODKOSZ_ZA_CLOUDFLARE === "1";

function ostatni(lista: string | null): string | null {
  if (!lista) return null;
  const czesci = lista
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return czesci.length ? czesci[czesci.length - 1] : null;
}

/**
 * Adres, po którym wolno rozliczać limity i blokady. `null`, gdy nie da się go ustalić -
 * wtedy lepiej przepuścić żądanie niż rozliczać wszystkich razem pod jednym kluczem.
 */
export function adresKlienta(naglowki: Headers): string | null {
  if (ZA_CLOUDFLARE) {
    const cf = naglowki.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }

  /* nagłówek własny Vercela - brzeg nadpisuje go przy każdym żądaniu */
  return (
    ostatni(naglowki.get("x-vercel-forwarded-for")) ??
    ostatni(naglowki.get("x-forwarded-for")) ??
    naglowki.get("x-real-ip")?.trim() ??
    null
  );
}
