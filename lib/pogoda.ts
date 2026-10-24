/**
 * Pogoda na dziś i jutro dla boiska - MET Norway (yr.no).
 *
 * Dla boiska odkrytego to najważniejsza informacja praktyczna: „jadę czy nie jadę".
 * Bez klucza i bez opłat (także komercyjnie), odpowiedź trzymamy godzinę na punkt.
 */
export interface WeatherHour {
  /** „2026-10-23T21:00” w czasie polskim - po nim prognoza przechodzi przez północ */
  czas: string;
  hour: number;
  temp: number;
  /** opad w milimetrach w tej godzinie */
  rain: number;
  /** prędkość wiatru w km/h */
  wind: number;
  /** kod pogody WMO (z symbolu MET Norway) - z niego wybieramy grafikę */
  code: number;
  /** czy o tej godzinie jest dzień (symbol MET bez końcówki _night) */
  day: boolean;
}

/** Scena rysowana w tle kafelka pogody. */
export type WeatherScene =
  | "clear"
  | "partly"
  | "overcast"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

/**
 * Kody WMO na scenę do narysowania. Grupujemy je grubo - dla gracza liczy się tylko,
 * czy jest słońce, chmury, mokro, śnieg albo burza.
 */
export function weatherScene(code: number): WeatherScene {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 51) return "rain";
  return "partly";
}

/** Krótki podpis stanu pogody - pod temperaturą w kafelku. */
export const SCENE_LABEL: Record<WeatherScene, string> = {
  clear: "bezchmurnie",
  partly: "częściowo słonecznie",
  overcast: "zachmurzenie",
  fog: "mgła",
  rain: "deszcz",
  snow: "śnieg",
  storm: "burza",
};

/*
  Źródło: MET Norway (Norweski Instytut Meteorologiczny), API Locationforecast - to samo, co
  w aplikacji yr.no. Od 24.10.2026 zamiast Open-Meteo: darmowe API Open-Meteo jest tylko do
  użytku niekomercyjnego, a serwis z partnerem jest komercyjny. MET Norway udostępnia dane
  bezpłatnie także komercyjnie (licencja CC BY 4.0) pod trzema warunkami:
    - podpis źródła przy prognozie (stoi pod wykresem w `PogodaKarty`),
    - nagłówek User-Agent z nazwą serwisu i kontaktem - bez niego odpowiadają 403,
    - pamięć podręczna zamiast pytania przy każdym wejściu (mamy: godzina na punkt).
*/
const API = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const IDENTYFIKACJA = "podkosz.pl kontakt@podkosz.pl";

/**
 * Do ilu miejsc po przecinku zaokrąglamy punkt, o który pytamy.
 *
 * ------------------------------------------------------------------ dlaczego to ważne
 *
 * Adres zapytania jest kluczem pamięci podręcznej. Przy trzech miejscach po przecinku
 * (110 m) KAŻDE boisko miałoby własny wpis i własne zapytania co godzinę. Jedno miejsce po
 * przecinku to około 11 km: wszystkie boiska w mieście dzielą jedno zapytanie, a różnicy
 * w prognozie między nimi i tak nie ma - model liczy na siatce o oczku kilku kilometrów.
 * MET Norway wprost prosi o zaokrąglanie (najwyżej 4 miejsca) właśnie po to, żeby pamięć
 * podręczna działała.
 */
const MIEJSC_PO_PRZECINKU = 1;

/**
 * Symbol pogody MET Norway („partlycloudy_day”, „lightrainshowers_night”…) na kod WMO,
 * z którego `weatherScene` wybiera grafikę. Grupujemy tak samo grubo jak sceny.
 */
function kodZSymbolu(symbol: string): number {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return 95;
  if (s.includes("snow") || s.includes("sleet")) return 71;
  if (s.includes("rain")) return 61;
  if (s === "fog") return 45;
  if (s === "cloudy") return 3;
  if (s === "partlycloudy") return 2;
  if (s === "fair") return 1;
  return 0;
}

/* „2026-10-24T18” w czasie polskim - MET podaje czas w UTC */
const godzinaPl = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

export async function fetchWeather(lat: number, lng: number): Promise<WeatherHour[]> {
  const url = `${API}?lat=${lat.toFixed(MIEJSC_PO_PRZECINKU)}&lon=${lng.toFixed(MIEJSC_PO_PRZECINKU)}`;

  try {
    /*
      Godzina, nie pół. Prognoza jest godzinowa, więc częstsze pytanie nie przynosi nowej
      informacji - a strona boiska i tak przebudowuje się co pół godziny, czyli co drugie
      przebudowanie bierze prognozę z pamięci.
    */
    const res = await fetch(url, { next: { revalidate: 3600 }, headers: { "User-Agent": IDENTYFIKACJA } });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      properties?: {
        timeseries?: {
          time: string;
          data: {
            instant: { details: { air_temperature?: number; wind_speed?: number } };
            next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
          };
        }[];
      };
    };
    const serie = data.properties?.timeseries ?? [];

    /* godzinowe wpisy są tylko na najbliższe ~2,5 doby; dalej co 6 godzin - tych nie bierzemy */
    return serie
      .filter((t) => t.data.next_1_hours)
      .map((t) => {
        const czas = `${godzinaPl.format(new Date(t.time)).replace(" ", "T")}:00`;
        const symbol = t.data.next_1_hours?.summary?.symbol_code ?? "cloudy";
        const d = t.data.instant.details;
        return {
          czas,
          hour: Number(czas.slice(11, 13)),
          temp: Math.round(d.air_temperature ?? 0),
          rain: t.data.next_1_hours?.details?.precipitation_amount ?? 0,
          /* MET podaje wiatr w m/s, kafelek pokazuje km/h */
          wind: Math.round((d.wind_speed ?? 0) * 3.6),
          code: kodZSymbolu(symbol),
          day: !symbol.endsWith("_night"),
        };
      });
  } catch {
    // pogoda jest dodatkiem - jej brak nie może psuć karty boiska
    return [];
  }
}

/** Krótka ocena warunków do gry - to, co człowiek chce przeczytać jednym zdaniem. */
export function weatherVerdict(hours: WeatherHour[]): string {
  if (!hours.length) return "";
  const deszcz = hours.filter((h) => h.rain >= 0.2);
  const zimno = hours.every((h) => h.temp <= 3);

  if (deszcz.length >= hours.length / 2) return "Dziś raczej mokro - trudno o grę.";
  if (deszcz.length) {
    const kiedy = deszcz.map((h) => `${String(h.hour).padStart(2, "0")}:00`).join(", ");
    return `Przelotnie deszcz o ${kiedy} - poza tym da się grać.`;
  }
  if (zimno) return "Sucho, ale mroźno - warto się ubrać.";
  return "Sucho - dobre warunki do gry.";
}
