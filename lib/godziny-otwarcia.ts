import type { Access } from "./types";

/**
 * Czy boisko jest TERAZ otwarte - z pola godzin wpisanego przez człowieka.
 *
 * W bazie godziny są tekstem („całą dobę", „06:00 - 22:00", „pn-pt 8-20, sb-nd 10-18",
 * „po zajęciach szkolnych"), więc najpierw wyciągamy z niego zakresy, a dopiero potem
 * porównujemy z zegarem. Tekst, z którego nie da się wyczytać godzin, nie dostaje stanu
 * wcale - lepiej nic nie powiedzieć, niż powiedzieć „otwarte" pod zamkniętą bramą.
 *
 * Zegar jest zawsze polski (Europe/Warsaw), niezależnie od strefy telefonu: boisko stoi
 * w Polsce, a ktoś sprawdzający je z wyjazdu chce wiedzieć, czy otworzą, kiedy wróci.
 */

export type StanOtwarcia = "otwarte" | "wkrotce" | "zamkniete" | "ograniczony";

export interface Otwarcie {
  stan: StanOtwarcia;
  /** „Otwarte", „Wkrótce zamknięte", „Zamknięte" */
  etykieta: string;
  /** dopisek po kropce: „do 22:00", „otwarcie 6:00", „całą dobę" */
  dopisek: string | null;
}

/** Ile minut przed zamknięciem zaczyna się „wkrótce zamknięte". */
const PRZED_ZAMKNIECIEM = 60;

interface Zakres {
  /** dni tygodnia jak w `Date.getDay()` (0 = niedziela); `null` = codziennie */
  dni: number[] | null;
  /** minuty od północy */
  od: number;
  do: number;
}

/* skróty dni, jakie ludzie wpisują - od najdłuższych, żeby „pon" nie złapało się jako „po" */
const DNI: [RegExp, number][] = [
  [/^(pon|pn)/, 1],
  [/^wt/, 2],
  [/^(śr|sr)/, 3],
  [/^(czw|cz)/, 4],
  [/^(pi[aą]|pt)/, 5],
  [/^(sob|sb|so)/, 6],
  [/^(niedz|ndz|nd|nie)/, 0],
];

function dzienZeSlowa(slowo: string): number | null {
  const s = slowo.toLowerCase();
  for (const [wzor, dzien] of DNI) if (wzor.test(s)) return dzien;
  return null;
}

/** Dni od `a` do `b` włącznie, przez koniec tygodnia („sb-nd" to sobota i niedziela). */
function dniOdDo(a: number, b: number): number[] {
  const wynik: number[] = [];
  for (let d = a, krok = 0; krok < 7; d = (d + 1) % 7, krok += 1) {
    wynik.push(d);
    if (d === b) break;
  }
  return wynik;
}

const minuty = (g: string, m?: string) => Number(g) * 60 + (m ? Number(m) : 0);

const SLOWO_DNIA = "(?<![a-ząćęłńóśźż])(?:pon|pn|wt|śr|sr|czw|cz|pi[aą]|pt|sob|sb|so|niedz|ndz|nd)[a-ząćęłńóśźż]*\\.?";
const GODZINY = "(\\d{1,2})(?:[:.](\\d{2}))?\\s*[-–—]\\s*(\\d{1,2})(?:[:.](\\d{2}))?";

/** Zakresy z tekstu: najpierw „dzień(-dzień) godziny", a jeśli takich nie ma - sam zakres. */
export function zakresyGodzin(tekst: string): Zakres[] {
  const t = (tekst ?? "").toLowerCase();

  const zDniami = new RegExp(`(${SLOWO_DNIA})(?:\\s*[-–—]\\s*(${SLOWO_DNIA}))?[\\s:,]*${GODZINY}`, "giu");
  const zakresy: Zakres[] = [];
  for (const m of t.matchAll(zDniami)) {
    const a = dzienZeSlowa(m[1]);
    const b = m[2] ? dzienZeSlowa(m[2]) : a;
    if (a === null || b === null) continue;
    zakresy.push({ dni: dniOdDo(a, b), od: minuty(m[3], m[4]), do: minuty(m[5], m[6]) });
  }
  /* „weekend 9-19" obok „pn-pt 8-20" - weekend nie jest skrótem dnia, więc osobno */
  for (const m of t.matchAll(new RegExp(`weekend[\\s:,]*${GODZINY}`, "giu"))) {
    zakresy.push({ dni: [6, 0], od: minuty(m[1], m[2]), do: minuty(m[3], m[4]) });
  }
  if (zakresy.length) return zakresy;

  const sam = t.match(new RegExp(GODZINY, "u"));
  if (sam) {
    const dni = /weekend/.test(t) ? [6, 0] : null;
    return [{ dni, od: minuty(sam[1], sam[2]), do: minuty(sam[3], sam[4]) }];
  }
  return [];
}

/* „24:00", nie „0:00" - zakres „8-24" zamyka się o północy dzisiejszego dnia, nie zaczyna */
const godzina = (min: number) =>
  min === 24 * 60 ? "24:00" : `${Math.floor(min / 60) % 24}:${String(min % 60).padStart(2, "0")}`;

/** Dzień tygodnia i minuta doby w Polsce. */
export function terazWPolsce(data = new Date()): { dzien: number; minuta: number } {
  const czesci = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const czesc = (typ: string) => czesci.find((c) => c.type === typ)?.value ?? "";
  const DZIEN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dzien: DZIEN[czesc("weekday")] ?? 0,
    minuta: Number(czesc("hour")) * 60 + Number(czesc("minute")),
  };
}

/**
 * Stan otwarcia na teraz. `null`, gdy z tekstu nie da się wyczytać godzin - wtedy pod nazwą
 * boiska stoi samo miasto.
 */
export function otwarcieTeraz(hours: string, access: Access, data = new Date()): Otwarcie | null {
  const h = (hours ?? "").trim();
  if (access === "24h" || /ca[łl][ąa]\s*dob|całodob|24\s*\/\s*7|24h/i.test(h)) {
    return { stan: "otwarte", etykieta: "Otwarte", dopisek: "całą dobę" };
  }

  const zakresy = zakresyGodzin(h);
  if (!zakresy.length) {
    return access === "ograniczony" ? { stan: "ograniczony", etykieta: "Ograniczony dostęp", dopisek: null } : null;
  }

  const { dzien, minuta } = terazWPolsce(data);
  const wDniu = (z: Zakres, d: number) => z.dni === null || z.dni.includes(d);

  for (const z of zakresy) {
    const koniec = z.do <= z.od ? z.do + 24 * 60 : z.do;
    /* zakres przez północ (18-2) zaczął się wczoraj i jeszcze trwa */
    const wczoraj = (dzien + 6) % 7;
    const trwaOdWczoraj = koniec > 24 * 60 && wDniu(z, wczoraj) && minuta < koniec - 24 * 60;
    const trwaDzis = wDniu(z, dzien) && minuta >= z.od && minuta < koniec;
    if (!trwaDzis && !trwaOdWczoraj) continue;

    const zostalo = (trwaOdWczoraj ? koniec - 24 * 60 : koniec) - minuta;
    const doKiedy = `do ${godzina(z.do)}`;
    return zostalo <= PRZED_ZAMKNIECIEM
      ? { stan: "wkrotce", etykieta: "Wkrótce zamknięte", dopisek: doKiedy }
      : { stan: "otwarte", etykieta: "Otwarte", dopisek: doKiedy };
  }

  /* zamknięte - kiedy otwierają: jeszcze dziś, jutro albo najbliższego dnia z godzinami */
  for (let za = 0; za < 7; za += 1) {
    const d = (dzien + za) % 7;
    const najblizsze = zakresy
      .filter((z) => wDniu(z, d) && (za > 0 || z.od > minuta))
      .sort((a, b) => a.od - b.od)[0];
    if (!najblizsze) continue;
    const kiedy = za === 0 ? "" : za === 1 ? "jutro " : `${["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][d]} `;
    return { stan: "zamkniete", etykieta: "Zamknięte", dopisek: `otwarcie ${kiedy}${godzina(najblizsze.od)}` };
  }
  return { stan: "zamkniete", etykieta: "Zamknięte", dopisek: null };
}
