import { Explorer } from "@/components/Explorer";
import { listMapCourts } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function Home() {
  const [courts, user] = await Promise.all([listMapCourts(), getSessionUser()]);
  return <Explorer courts={courts} isAdmin={!!user?.isAdmin} />;
}
