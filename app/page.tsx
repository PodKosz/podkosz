import { Explorer } from "@/components/Explorer";
import { listCourts } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function Home() {
  const [courts, user] = await Promise.all([listCourts(), getSessionUser()]);
  return <Explorer courts={courts} isAdmin={!!user?.isAdmin} />;
}
