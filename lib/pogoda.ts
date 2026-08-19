/**
 * Pogoda na dziś dla boiska - open-meteo.
 *
 * Dla boiska odkrytego to najważniejsza informacja praktyczna: „jadę czy nie jadę".
 * Open-meteo nie wymaga klucza ani opłat, a odpowiedź trzymamy pół godziny, więc
 * ruch do nich jest minimalny.
 */
export interface WeatherHour {
  hour: number;
  temp: number;
  /** opad w milimetrach w tej godzinie */
  rain: number;
  /** prędkość wiatru w km/h */
  wind: number;
  /** kod pogody WMO z open-meteo - z niego wybieramy grafikę */
  code: number;
  /** czy o tej godzinie jest dzień (open-meteo: is_day) */
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

const API = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(lat: number, lng: number): Promise<WeatherHour[]> {
  const url =
    `${API}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    "&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code,is_day" +
    "&timezone=Europe%2FWarsaw&forecast_days=1";

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation: number[];
        wind_speed_10m: number[];
        weather_code: number[];
        is_day: number[];
      };
    };
    const h = data.hourly;
    if (!h?.time?.length) return [];

    return h.time.map((t, i) => ({
      hour: Number(t.slice(11, 13)),
      temp: Math.round(h.temperature_2m[i]),
      rain: h.precipitation[i] ?? 0,
      wind: Math.round(h.wind_speed_10m[i] ?? 0),
      code: h.weather_code?.[i] ?? 0,
      day: (h.is_day?.[i] ?? 1) === 1,
    }));
  } catch {
    // pogoda jest dodatkiem - jej brak nie może psuć karty boiska
    return [];
  }
}

/**
 * Wybiera godziny warte pokazania: najbliższą pełną oraz kolejne co dwie godziny
 * do 22:00. Wieczorem lista sama się skraca.
 */
export function playableHours(all: WeatherHour[], nowHour: number): WeatherHour[] {
  const start = Math.max(nowHour, 7);
  return all.filter((h) => h.hour >= start && h.hour <= 22 && (h.hour - start) % 2 === 0).slice(0, 5);
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
