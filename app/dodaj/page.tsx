import type { Metadata } from "next";
import { AddFlow } from "@/components/add/AddFlow";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dodaj boisko - PodKosz",
  description:
    "Zrób 6 zdjęć według instrukcji, przypnij lokalizację GPS i dodaj boisko do ogólnopolskiej bazy.",
};

export const revalidate = 0;

export default async function AddPage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-dvh px-5 pb-24 pt-28">
      <AddFlow user={user ? { name: user.name, email: user.email } : null} />
    </main>
  );
}
