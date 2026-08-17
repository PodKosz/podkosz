import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_STEPS } from "@/lib/types";
import { PhotoPlaceholder } from "@/components/CourtPhoto";
import { FireBallIcon } from "@/components/icons";
import { countCourts } from "@/lib/repo";
import { FeedbackDialog } from "@/components/FeedbackDialog";

export const metadata: Metadata = {
  title: "O nas — PodKosz",
  description:
    "Budujemy najdokładniejszą bazę boisk do koszykówki w Polsce — ze zdjęciami w dobrej jakości, dodawaną przez graczy.",
};

export const revalidate = 0;

export default async function AboutPage() {
  const total = await countCourts();

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

      {/* licznik bazy — liczba leci prosto z Supabase przy każdym wejściu */}
      <section className="relative mt-12 overflow-hidden rounded-[32px] border border-hairline bg-deep">
        {/* płynne tło: trzy plamy gradientu dryfujące w różnym tempie */}
        <span
          className="liquid-blob -left-24 -top-32 h-[420px] w-[520px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.55) 0%, rgba(255,77,10,.18) 52%, transparent 72%)",
          }}
        />
        <span
          className="liquid-blob -right-32 -top-16 h-[380px] w-[440px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,178,92,.42) 0%, transparent 70%)",
          }}
        />
        <span
          className="liquid-blob bottom-[38%] left-1/3 h-[300px] w-[360px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,61,0,.35) 0%, transparent 68%)",
          }}
        />

        <div className="relative px-6 pt-14 text-center">
          <p className="text-[12px] uppercase tracking-[0.26em] text-white/55">Boisk w bazie</p>
          <p className="mt-3 flame-text text-[clamp(80px,17vw,164px)] font-bold leading-[0.86] tracking-[-0.045em] tabular-nums">
            {total}
          </p>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            {total === 0
              ? "Baza dopiero rusza — pierwsze boisko możesz dodać właśnie Ty."
              : "Każde z nich ma komplet zdjęć w tym samym standardzie i pinezkę z GPS-u."}
          </p>
        </div>

        {/* zdjęcie wtopione maską: brzegi rozpływają się w karcie zamiast ciąć ją krawędzią */}
        <div className="relative mt-6 h-[280px] sm:h-[380px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/o-nas/kosz.jpg')",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 30%, #000 80%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 30%, #000 80%, transparent 100%)",
            }}
          />
          {/* ciepła poświata podnosząca się od dołu — spina zdjęcie z resztą marki */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(255,77,10,.42) 0%, rgba(255,122,24,.16) 34%, transparent 62%)",
            }}
          />
        </div>
      </section>

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

      <section className="mt-6 flex flex-wrap items-center gap-5 rounded-[26px] border border-hairline bg-white/4 p-7">
        <div className="min-w-[240px] flex-1">
          <h2 className="text-[20px] font-semibold">Co możemy poprawić?</h2>
          <p className="mt-1 text-[14px] text-muted">
            Brakuje filtra, coś nie działa na Twoim telefonie, masz pomysł na nową funkcję?
            Napisz — czytam wszystko.
          </p>
        </div>
        <FeedbackDialog label="Napisz opinię" />
      </section>

      <p className="mt-12 text-[13px] text-faint">
        Kontakt: podkoszpl@gmail.com · © 2026 PodKosz
      </p>
    </main>
  );
}
