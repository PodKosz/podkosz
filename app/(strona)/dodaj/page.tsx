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

  /*
    Zablokowanemu kontu baza i tak odrzuci zgłoszenie (polityka RLS), ale lepiej powiedzieć to
    od razu, niż pozwolić przejść cały kreator na darmo.
  */
  if (user?.isBanned) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-24 pt-28">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Dodaj boisko</p>
        <h1 className="mt-2 text-[clamp(28px,5vw,42px)] font-semibold tracking-[-0.02em]">
          Konto jest zablokowane
        </h1>
        <p className="mt-6 rounded-[24px] border border-ember/40 bg-ember/10 px-6 py-5 text-[14px] leading-relaxed text-ember">
          Dodawanie boisk z tego konta jest wyłączone. Możesz dalej przeglądać mapę. Jeśli to
          pomyłka, napisz do nas przez formularz opinii w stopce.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-5 pb-24 pt-28">
      <AddFlow user={user ? { name: user.name, email: user.email } : null} />
    </main>
  );
}
