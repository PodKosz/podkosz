import { Explorer } from "@/components/Explorer";
import { SiteStructuredData } from "@/components/StructuredData";
import { listMapCourts } from "@/lib/repo";

/*
  Mapa jest jednakowa dla wszystkich - kto jest administratorem i co ma podpalone, Explorer
  dociąga sobie sam w przeglądarce. Dzięki temu strona główna wychodzi z cache, a nie jest
  składana przy każdym wejściu; lista boisk odświeża się co pięć minut albo wcześniej, gdy
  publikacja nowego boiska unieważni znacznik.
*/
export const revalidate = 300;

export default async function Home() {
  const courts = await listMapCourts();

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
