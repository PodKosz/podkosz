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
}

const API = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(lat: number, lng: number): Promise<WeatherHour[]> {
  const url =
    `${API}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    "&hourly=temperature_2m,precipitation,wind_speed_10m" +
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
      };
    };
    const h = data.hourly;
    if (!h?.time?.length) return [];

    return h.time.map((t, i) => ({
      hour: Number(t.slice(11, 13)),
      temp: Math.round(h.temperature_2m[i]),
      rain: h.precipitation[i] ?? 0,
      wind: Math.round(h.wind_speed_10m[i] ?? 0),
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
