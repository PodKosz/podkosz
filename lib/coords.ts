export interface LatLng {
  lat: number;
  lng: number;
}

const inRange = (p: LatLng) =>
  Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && (p.lat !== 0 || p.lng !== 0);

const num = (s: string) => Number(s.replace(",", "."));

/** Stopnie-minuty-sekundy z literą półkuli: 50°01'01.9"N 19°52'21.4"E */
function parseDms(text: string): LatLng | null {
  const re =
    /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)?\s*["″”]?\s*([NSEW])/gi;
  const hits = [...text.matchAll(re)];
  if (hits.length !== 2) return null;

  const parts = hits.map((m) => {
    const value = Number(m[1]) + Number(m[2]) / 60 + (m[3] ? num(m[3]) : 0) / 3600;
    const hemi = m[4].toUpperCase();
    const signed = hemi === "S" || hemi === "W" ? -value : value;
    return { axis: hemi === "N" || hemi === "S" ? "lat" : "lng", value: signed };
  });

  const lat = parts.find((p) => p.axis === "lat");
  const lng = parts.find((p) => p.axis === "lng");
  if (!lat || !lng) return null;

  const point = { lat: lat.value, lng: lng.value };
  return inRange(point) ? point : null;
}

/** Stopnie i minuty dziesiętne: 50°01.032'N 19°52.357'E */
function parseDm(text: string): LatLng | null {
  const re = /(\d{1,3})\s*[°º]\s*(\d{1,2}(?:[.,]\d+))\s*['′’]?\s*([NSEW])/gi;
  const hits = [...text.matchAll(re)];
  if (hits.length !== 2) return null;

  const parts = hits.map((m) => {
    const value = Number(m[1]) + num(m[2]) / 60;
    const hemi = m[3].toUpperCase();
    return {
      axis: hemi === "N" || hemi === "S" ? "lat" : "lng",
      value: hemi === "S" || hemi === "W" ? -value : value,
    };
  });

  const lat = parts.find((p) => p.axis === "lat");
  const lng = parts.find((p) => p.axis === "lng");
  if (!lat || !lng) return null;

  const point = { lat: lat.value, lng: lng.value };
  return inRange(point) ? point : null;
}

/** Zapis dziesiętny: 50.033861, 19.872611 — także z przecinkiem jako separatorem ułamka. */
function parseDecimal(text: string): LatLng | null {
  const cleaned = text.replace(/[NnEe]\b/g, "").trim();

  // "50,0338 19,8726" albo "50,0338; 19,8726" — przecinek jest tu ułamkiem
  const commaDecimal = cleaned.match(
    /^\s*(-?\d{1,3},\d+)\s*[;\s]\s*(-?\d{1,3},\d+)\s*$/
  );
  if (commaDecimal) {
    const point = { lat: num(commaDecimal[1]), lng: num(commaDecimal[2]) };
    return inRange(point) ? point : null;
  }

  const dotDecimal = cleaned.match(
    /(-?\d{1,3}(?:\.\d+)?)\s*[,;/\s]+\s*(-?\d{1,3}(?:\.\d+)?)/
  );
  if (dotDecimal) {
    const point = { lat: Number(dotDecimal[1]), lng: Number(dotDecimal[2]) };
    // sam "2, 3" to raczej nie współrzędne — wymagamy części dziesiętnej
    if (!/\./.test(dotDecimal[1]) && !/\./.test(dotDecimal[2])) return null;
    return inRange(point) ? point : null;
  }

  return null;
}

/**
 * Rozpoznaje współrzędne w formatach, które wychodzą z Google Maps:
 * 50°01'01.9"N 19°52'21.4"E, 50°01.032'N 19°52.357'E, 50.033861, 19.872611.
 * Zwraca null, gdy tekst jest zwykłym zapytaniem adresowym.
 */
export function parseCoordinates(input: string): LatLng | null {
  const text = input.trim();
  if (!text) return null;
  return parseDms(text) ?? parseDm(text) ?? parseDecimal(text);
}

/** Format do pokazania użytkownikowi po rozpoznaniu wklejki. */
export function formatLatLng({ lat, lng }: LatLng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
