import { Explorer } from "@/components/Explorer";
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
  return <Explorer courts={courts} />;
}
