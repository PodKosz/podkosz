import { Explorer } from "@/components/Explorer";
import { listCourts } from "@/lib/repo";

export const revalidate = 0;

export default async function Home() {
  const courts = await listCourts();
  return <Explorer courts={courts} />;
}
