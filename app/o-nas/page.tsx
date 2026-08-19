import type { Metadata } from "next";
import Link from "next/link";
import { REQUIRED_PHOTO_STEPS } from "@/lib/types";
import { ShotDiagram } from "@/components/ShotDiagram";
import { FireBallIcon } from "@/components/icons";
import { countCourts } from "@/lib/repo";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { CourtOutline } from "@/components/CourtOutline";

export const metadata: Metadata = {
  title: "O nas - PodKosz",
  description:
    "Największa mapa boisk do koszykówki w Polsce: zdjęcia z kilku ujęć, nawierzchnia, kosze, oświetlenie i godziny. Bazę buduje społeczność - każdy może dodać boisko.",
};

export const revalidate = 0;

export default async function AboutPage() {
  const total = await countCourts();

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">O projekcie</p>
      <h1 className="mt-2 text-[clamp(32px,5.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em]">
        Największa mapa boisk do koszykówki w Polsce
      </h1>
      <div className="mt-5 max-w-2xl space-y-4 text-[17px] leading-relaxed text-muted">
        <p>
          Szukanie miejsca do gry w obcym mieście kończy się zwykle na jednym rozmytym zdjęciu
          sprzed ośmiu lat. U nas każde boisko ma komplet kadrów z różnych stron: całe boisko
          z narożnika, osobno każdy kosz, zbliżenie na obręcz i siatkę oraz detal nawierzchni.
          Widzisz, czy obręcz jest prosta i czy beton nie jest spękany, zanim pojedziesz na
          boisko.
        </p>
        <p>
          Do zdjęć dokładamy to, co decyduje o tym, czy warto tam jechać: rodzaj nawierzchni,
          liczbę koszy, oświetlenie, ogrodzenie, godziny i zasady dostępu oraz dokładną pinezkę
          z GPS-u. Mapę przefiltrujesz po nawierzchni, typie boiska, województwie i dostępności,
          sprawdzisz prognozę na dziś dla boisk odkrytych, zobaczysz, kto wybiera się tam zagrać
          i o której, podpalisz swoje ulubione miejsca i zapiszesz je na własną listę.
        </p>
        <p className="text-ink/90">
          Najważniejsze: tej bazy nie tworzy żadna instytucja. Buduje ją społeczność - każdy może
          dodać boisko, które zna, w trzy minuty i bez zakładania konta. Zgłoszenie sprawdzamy i
          publikujemy, a Ty trafiasz do rankingu odkrywców.
        </p>
      </div>

      {/*
        Licznik bazy: bez fotografii, bo zdjęcie pod dużą liczbą zawsze z nią walczyło.
        Zostaje ciemna karta w kolorach serwisu, dwie dryfujące plamy gradientu i kontur
        boiska widzianego z góry, który wygasza się przy dolnej krawędzi. Liczba leci
        prosto z Supabase przy każdym wejściu.
      */}
      {/*
        Proporcje karty trzymamy blisko proporcji boiska (1,83), a na telefonie 16:9 - inaczej
        kontur rozciągnięty na blok byłby zauważalnie zdeformowany.
      */}
      <section className="relative mt-12 aspect-[16/9] overflow-hidden rounded-[32px] border border-hairline bg-deep sm:aspect-[840/460]">
        <span
          className="liquid-blob -left-28 -top-32 h-[380px] w-[520px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.30) 0%, rgba(255,77,10,.10) 55%, transparent 74%)",
          }}
        />
        <span
          className="liquid-blob -right-28 top-10 h-[340px] w-[420px]"
          style={{
            background: "radial-gradient(circle, rgba(255,178,92,.22) 0%, transparent 70%)",
          }}
        />

        {/* kontur boiska wypełnia całą kartę - liczba i podpis siedzą dokładnie w jego środku */}
        <div className="pointer-events-none absolute inset-0">
          <CourtOutline uid="licznik" />
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[14px] font-medium uppercase tracking-[0.36em] text-white/70 sm:text-[17px]">
            Boisk w bazie
          </p>
          {/*
            Gradient nakładany przez background-clip: text maluje tylko pudełko wiersza, więc
            liczba potrzebuje zapasu z dwóch stron: leading powyżej 1 (inaczej dolne krzywe cyfr
            zostawały niepomalowane) i wcięcie z prawej, bo ujemny tracking odejmuje odstęp także
            po ostatniej cyfrze - i to jej prawy bok zostawał nieomalowany.
          */}
          <p className="mt-2 flame-text pb-3 pr-[0.08em] text-[clamp(84px,20vw,236px)] font-bold leading-[1.04] tracking-[-0.05em] tabular-nums sm:mt-3">
            {total}
          </p>
          {total === 0 && (
            <p className="mx-auto max-w-md text-[15px] text-muted">
              Baza dopiero rusza - pierwsze boisko możesz dodać właśnie Ty.
            </p>
          )}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Jak dodać boisko</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Cały proces robisz telefonem, stojąc na boisku. Kreator prowadzi krok po kroku i nie
          puści dalej, dopóki nie masz obowiązkowego zestawu kadrów - dzięki temu wszystkie karty
          w bazie wyglądają tak samo dobrze.
        </p>

        <ol className="mt-6 space-y-3">
          {[
            [
              "Otwórz „Dodaj boisko”",
              "Konto nie jest wymagane. Z kontem dostaniesz maila, gdy boisko pojawi się na mapie, i wejdziesz do rankingu odkrywców.",
            ],
            [
              "Zrób zdjęcia według podpowiedzi",
              "Przy każdym ujęciu masz na ekranie rysunek i wskazówkę, gdzie stanąć. Kosz B pomijasz tylko wtedy, gdy boisko naprawdę ma jeden kosz.",
            ],
            [
              "Pobierz lokalizację ze środka boiska",
              "Pinezka trafia dokładnie tam, gdzie stoisz, a miasto i województwo uzupełniają się same. Jeśli to boisko już u nas jest, kreator od razu to pokaże.",
            ],
            [
              "Uzupełnij szczegóły i wyślij",
              "Nawierzchnia, liczba koszy, oświetlenie, ogrodzenie, godziny i krótki opis od siebie - to właśnie te informacje ludzie czytają przed wyjściem z domu.",
            ],
            [
              "Czekasz na sprawdzenie",
              "Przeglądam zgłoszenia zwykle w ciągu doby. Po publikacji dostajesz maila z linkiem do swojej karty boiska.",
            ],
          ].map(([t, d], i) => (
            <li key={t} className="glass flex gap-4 rounded-[20px] p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-flame/50 bg-flame/12 text-[13px] font-bold text-glow">
                {i + 1}
              </span>
              <span>
                <span className="block text-[16px] font-semibold">{t}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Standard zdjęć</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted">
          Każde boisko w bazie ma ten sam zestaw ujęć, zawsze w tej samej kolejności. To dlatego
          karty boisk da się ze sobą porównywać.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REQUIRED_PHOTO_STEPS.map((s, i) => (
            <div key={s.kind} className="glass overflow-hidden rounded-2xl">
              <div className="relative aspect-[4/3]">
                <ShotDiagram kind={s.kind} />
                <span className="absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[11px] font-bold">
                  {i + 1}
                </span>
                {s.skippable && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                    można pominąć
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-[12px] font-semibold leading-tight">{s.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{s.hint}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-faint">
          Do obowiązkowego zestawu można dorzucić maksymalnie trzy dodatkowe ujęcia ogólne -
          otoczenie, wejście, lampy albo widok z drugiego narożnika.
        </p>
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
            Napisz - czytam wszystko.
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
