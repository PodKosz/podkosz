import { adresKlienta } from "@/lib/adres-ip";
import { przepustka, zaDuzo } from "@/lib/limity";
import { GRANICE_POLSKI, zPhotona } from "@/lib/miejsca";
import { SITE_URL } from "@/lib/site";

/**
 * Podpowiedzi adresów do wyszukiwarki na mapie (Photon, dane OpenStreetMap).
 *
 * Do pisania z podpowiedziami nie nadaje się Nominatim z `/api/geo` - jego regulamin wprost
 * zabrania autouzupełniania. Photon (komoot) powstał właśnie do tego. Ruch idzie przez nasz
 * serwer z tych samych powodów co w `/api/geo`: przedstawiamy się nagłówkiem, adres IP osoby
 * szukającej nie wychodzi poza nas, a te same zapytania („Kraków”, „Marszałkowska”) lecą
 * z pamięci podręcznej zamiast drugi raz do dostawcy.
 *
 * Środek mapy (`lat`, `lng`) przesuwa wyniki w stronę oglądanej okolicy. Zaokrąglamy go do
 * dwóch miejsc (około kilometra), żeby sąsiednie kadry trafiały w tę samą pamięć.
 */

const CACHE_S = 86_400;

export async function GET(request: Request) {
  const wejscie = new URL(request.url);
  const q = (wejscie.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return Response.json({ miejsca: [] });

  /*
    Sześćdziesiąt zapytań na minutę z jednego adresu: pole pyta dopiero po pauzie w pisaniu,
    więc człowiek nie dobije nawet do połowy. Chroni dostawcę, który działa na zasadzie
    uczciwego użytku i za nadużycia blokuje źródło.
  */
  const przepust = przepustka("miejsca", adresKlienta(request.headers), 60, 60);
  if (!przepust.ok) return zaDuzo(przepust.poczekaj, "Za dużo zapytań o adresy.");

  const cel = new URL("https://photon.komoot.io/api/");
  cel.searchParams.set("q", q);
  cel.searchParams.set("limit", "10");
  cel.searchParams.set("lang", "default");
  cel.searchParams.set("bbox", GRANICE_POLSKI);
  const lat = Number(wejscie.searchParams.get("lat"));
  const lng = Number(wejscie.searchParams.get("lng"));
  if (wejscie.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
    cel.searchParams.set("lat", lat.toFixed(2));
    cel.searchParams.set("lon", lng.toFixed(2));
  }

  try {
    const res = await fetch(cel, {
      headers: { "User-Agent": `PodKosz/1.0 (${SITE_URL})`, Referer: SITE_URL },
      next: { revalidate: CACHE_S },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.json({ miejsca: [], blad: res.status }, { status: 502 });
    const dane = (await res.json()) as { features?: Parameters<typeof zPhotona>[0] };
    return Response.json(
      { miejsca: zPhotona(dane.features ?? [], q) },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_S}, stale-while-revalidate=${7 * CACHE_S}` } }
    );
  } catch {
    return Response.json({ miejsca: [], blad: "brak odpowiedzi" }, { status: 502 });
  }
}
