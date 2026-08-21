import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { pobierzNickZmieniony } from "@/lib/konto";
import { statystykiGracza } from "@/lib/profil";
import { ZmianaNicku } from "@/components/konto/ZmianaNicku";
import { UsunKonto } from "@/components/konto/UsunKonto";
import { TloPilki } from "@/components/TloPilki";
import { dataOpisowa } from "@/lib/site";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Ustawienia konta - PodKosz",
  description: "Nick, dane konta i usunięcie konta.",
  robots: { index: false, follow: false },
};

/* Strona jest prywatna - nic tu nie może być cache'owane ani współdzielone. */
export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
        <h1 className="text-[clamp(28px,5vw,44px)] font-semibold tracking-[-0.02em]">
          Ustawienia konta
        </h1>
        <p className="szklo-pro mt-8 rounded-[28px] p-8 text-center text-[15px] text-muted">
          Zaloguj się przez Google, żeby zarządzać swoim kontem.
        </p>
      </main>
    );
  }

  const [nickZmieniony, statystyki] = await Promise.all([
    pobierzNickZmieniony(user.id),
    statystykiGracza(user.name),
  ]);

  const dane: [string, string][] = [
    ["Adres e-mail", user.email ?? "-"],
    ["Rola", user.isAdmin ? "administrator" : "gracz"],
    [
      "Konto od",
      statystyki.dolaczyl ? dataOpisowa(statystyki.dolaczyl, true) : "-",
    ],
    ["Stan konta", user.isBanned ? "zablokowane" : "aktywne"],
  ];

  return (
    <main className="relative mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
      <TloPilki />

      <Link
        href="/konto"
        className="szklo-pro inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> moje konto
      </Link>

      <header className="mt-6">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Konto</p>
        <h1 className="mt-2 text-[clamp(28px,5vw,44px)] font-semibold tracking-[-0.02em]">
          Ustawienia konta
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Tu zmieniasz to, co widzą inni, i tu kończysz przygodę, jeśli zdecydujesz się odejść.
        </p>
      </header>

      {/* ---------- nick ---------- */}
      <section className="mt-10">
        <ZmianaNicku
          nick={user.name}
          ostatniaZmiana={nickZmieniony}
          zablokowane={user.isBanned}
        />
      </section>

      {/* ---------- dane konta ---------- */}
      <section className="szklo-pro mt-6 rounded-[28px] p-6 sm:p-7">
        <h2 className="text-[17px] font-semibold">Dane konta</h2>
        <p className="mt-1 text-[13px] text-muted">
          Logowanie obsługuje Google - hasła nie przechowujemy i nie da się go tu zmienić.
        </p>

        <dl className="mt-5 space-y-3">
          {dane.map(([etykieta, wartosc]) => (
            <div
              key={etykieta}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 last:border-0 last:pb-0"
            >
              <dt className="text-[13px] uppercase tracking-[0.12em] text-faint">{etykieta}</dt>
              <dd className="text-[15px] font-medium">{wartosc}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- usunięcie konta ---------- */}
      <section className="mt-6">
        <UsunKonto />
      </section>
    </main>
  );
}
