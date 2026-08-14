import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel administratora — PodKosz",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

export default async function AdminPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pb-24 pt-28">
      <AdminPanel isAdmin={!!user?.isAdmin} signedIn={!!user} />
    </main>
  );
}
