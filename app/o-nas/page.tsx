import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_STEPS } from "@/lib/types";
import { PhotoPlaceholder } from "@/components/CourtPhoto";
import { FireBallIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "O nas — PodKosz",
  description:
    "Budujemy najdokładniejszą bazę boisk do koszykówki w Polsce — ze zdjęciami w dobrej jakości, dodawaną przez graczy.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">O projekcie</p>
      <h1 className="mt-2 text-[clamp(32px,5.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em]">
        Każde boisko w Polsce, ze zdjęciami które coś mówią
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
        Szukanie miejsca do gry w obcym mieście kończy się zwykle na rozmytym zdjęciu sprzed ośmiu
        lat. Robimy to inaczej: sześć konkretnych kadrów z każdego boiska, zawsze te same ujęcia,
        zawsze z GPS-em. Dzięki temu widzisz stan obręczy i nawierzchni, zanim wsiądziesz w tramwaj.
      </p>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          ["Znajdź", "Mapa, filtry po nawierzchni, dostępności i województwie."],
          ["Dodaj", "Sześć zdjęć z telefonu, GPS przypina pinezkę."],
          ["Podpal", "Płonąca piłka to głos społeczności — buduje ranking."],
        ].map(([t, d], i) => (
          <div key={t} className="glass rounded-[22px] p-5">
            <span className="grid h-9 w-9 place-items-center rounded-full flame-gradient text-[14px] font-bold text-black">
              {i + 1}
            </span>
            <h2 className="mt-3 text-[17px] font-semibold">{t}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Standard zdjęć</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted">
          Każde boisko w bazie ma ten sam zestaw ujęć. To dlatego karty boisk da się ze sobą
          porównywać.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PHOTO_STEPS.map((s, i) => (
            <div key={s.kind} className="glass overflow-hidden rounded-2xl">
              <div className="aspect-[4/3]">
                <PhotoPlaceholder kind={s.kind} seed={13 + i * 7} />
              </div>
              <p className="p-3 text-[12px] font-medium">{s.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass mt-16 flex flex-wrap items-center gap-5 rounded-[26px] p-7">
        <FireBallIcon className="h-12 w-12" />
        <div className="min-w-[240px] flex-1">
          <h2 className="text-[20px] font-semibold">Znasz boisko, którego u nas nie ma?</h2>
          <p className="mt-1 text-[14px] text-muted">
            Trzy minuty z telefonem w ręku i trafia na mapę. Konto nie jest wymagane.
          </p>
        </div>
        <Link
          href="/dodaj"
          className="rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black"
        >
          Dodaj boisko
        </Link>
      </section>

      <p className="mt-12 text-[13px] text-faint">
        Kontakt: podkoszpl@gmail.com · © 2026 PodKosz
      </p>
    </main>
  );
}
