import { Explorer } from "@/components/Explorer";
import { SiteStructuredData } from "@/components/StructuredData";
import { preconnect } from "react-dom";
import { listMapCourts } from "@/lib/repo";
import { kafelkiPodkladu } from "@/lib/podklad";

/*
  Mapa jest jednakowa dla wszystkich - kto jest administratorem i co ma podpalone, Explorer
  dociąga sobie sam w przeglądarce. Dzięki temu strona główna wychodzi z cache, a nie jest
  składana przy każdym wejściu; lista boisk odświeża się co pięć minut albo wcześniej, gdy
  publikacja nowego boiska unieważni znacznik.
*/
export const revalidate = 300;

export default async function Home() {
  const courts = await listMapCourts();

  /*
    Połączenie z serwerem kafelków otwieramy od razu, razem z HTML-em. Inaczej przeglądarka
    robi DNS, TCP i TLS dopiero wtedy, gdy mapa poprosi o pierwszy kafelek - a to jest po
    pobraniu i uruchomieniu MapLibre, czyli kilkaset milisekund stracone na czekanie
    w kolejce. `crossOrigin`, bo MapLibre pobiera kafelki przez `fetch` w trybie CORS,
    a połączenie otwarte bez niego nie zostałoby użyte.
  */
  for (const host of new Set(kafelkiPodkladu("dark_nolabels", false).map((u) => new URL(u).origin))) {
    preconnect(host, { crossOrigin: "anonymous" });
  }

  return (
    <>
      {/*
        Opis serwisu dla wyszukiwarek. Mapa to jeden wielki blok JavaScriptu - bez tego
        robot widzi na stronie głównej niewiele poza paskiem nawigacji i nie ma z czego
        wywnioskować, czym jest „PodKosz".
      */}
      <SiteStructuredData courts={courts.length} />
      <Explorer courts={courts} />
    </>
  );
}
