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

/*
  Liczba boisk zmienia się rzadko, a przy publikacji nowego boiska i tak unieważniamy jej
  znacznik - godzinny odświeżacz jest więc tylko siatką bezpieczeństwa. Dzięki temu strona
  leci z cache, zamiast być składana przy każdym wejściu.
*/
export const revalidate = 3600;

export default async function AboutPage() {
  const total = await countCourts();

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28">
      {/*
        Obrys boiska pod całą stroną - ten sam kadr co na „Już niedługo": przekrzywiony,
        szerszy niż ekran, więc linie wybiegają poza kadr zamiast kończyć się w powietrzu.
        Warstwa jest przyklejona do okna (fixed), bo rozciągnięta na całą wysokość strony
        dałaby rysunek zdeformowany jak guma. Linie gaszę mocniej niż na zasłonie - tam
        leżał na nich jeden napis, tu cała kolumna tekstu.
      */}
      <div
        className="kontur-rysowany pointer-events-none fixed left-1/2 top-1/2 -z-10 aspect-[108/58] w-[190vw] opacity-[0.3] sm:w-[108vw]"
        style={{ translate: "calc(-50% + 8vw) calc(-50% - 2vh)", rotate: "-11deg" }}
        aria-hidden
      >
        <CourtOutline uid="tlo" />
      </div>

      {/*
        Ciepłe plamy światła pod całą stroną. Trzymam je w warstwie przyklejonej do okna:
        plamy są szersze niż kolumna tekstu i wychodzą poza ekran, a element `fixed` nie
        rozciąga strony na boki - `absolute` z takimi rozmiarami zrobiłby poziomy pasek
        przewijania na telefonie. `overflow-hidden` ucina je dokładnie na krawędzi ekranu,
        więc nigdzie nie widać twardego końca gradientu.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <span
          className="liquid-blob -left-32 -top-28 h-[520px] w-[680px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,24,.32) 0%, rgba(255,77,10,.12) 52%, transparent 72%)",
          }}
        />
        <span
          className="liquid-blob -right-40 top-[34%] h-[560px] w-[640px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,77,10,.26) 0%, rgba(255,122,24,.09) 55%, transparent 74%)",
          }}
        />
        <span
          className="liquid-blob -left-28 bottom-[-9rem] h-[520px] w-[720px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,178,92,.24) 0%, rgba(255,122,24,.08) 52%, transparent 72%)",
          }}
        />
        <span
          className="liquid-blob left-1/2 top-[8%] h-[520px] w-[760px] -translate-x-1/2"
          style={{
            background: "radial-gradient(circle, rgba(255,122,24,.16) 0%, transparent 72%)",
          }}
        />
        <span
          className="liquid-blob right-[12%] bottom-[-14rem] h-[420px] w-[520px]"
          style={{
            background: "radial-gradient(circle, rgba(255,122,24,.20) 0%, transparent 70%)",
          }}
        />
      </div>

      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">O projekcie</p>
      {/*
        Nadtytuł „Chcemy zbudować" siedzi w tym samym `h1`, tylko mniejszym stopniem pisma:
        zdanie zostaje jedno, a wielki tekst rozkłada się na dwa wiersze podobnej długości
        („Największą mapę boisk" / „do koszykówki w Polsce"). Wcześniej pierwsza linia była
        o połowę krótsza od pozostałych i nagłówek wyglądał jak przypadkowo złamany.

        Twarda spacja po „w" pilnuje reguły, że jednoliterowe słowo nie kończy wiersza.
      */}
      <h1 className="mt-3 max-w-[24ch] text-balance text-[clamp(34px,5.6vw,60px)] font-semibold leading-[1.04] tracking-[-0.03em]">
        <span className="mb-1 block text-[0.44em] font-normal leading-tight tracking-[-0.01em] text-muted">
          Chcemy zbudować
        </span>
        Największą mapę boisk do koszykówki w&nbsp;Polsce
      </h1>
      <div className="mt-5 max-w-2xl space-y-4 text-[17px] leading-relaxed text-muted">
        <p>
          Szukanie boiska w obcym mieście wygląda zwykle tak samo: mapa pokazuje pinezkę bez
          zdjęcia, forum pamięta stan sprzed ośmiu lat, a na miejscu okazuje się, że obręcz
          jest wygięta, brama zamknięta albo płyta rozbita. Dojeżdżasz z piłką i wracasz
          z niczym.
        </p>
        <p className="text-ink/90">
          Chcemy to zmienić. PodKosz to jedna wielka baza i mapa boisk z całej Polski, którą
          piszą jej użytkownicy: zdjęcia, opis, godziny, dodatkowe uwagi o miejscu - wszystko
          przychodzi od ludzi, którzy tam grają. Zgłoszenie robisz telefonem, stojąc na boisku,
          w trzy minuty i bez zakładania konta.
        </p>
        <p>
          Każde boisko ma komplet kadrów z różnych stron: całe boisko z narożnika, osobno każdy
          kosz, zbliżenie na obręcz i siatkę oraz detal nawierzchni. Widzisz, czy obręcz jest
          prosta i czy beton nie jest spękany, zanim pojedziesz na boisko.
        </p>
        <p>
          Do zdjęć dokładamy to, co decyduje o tym, czy warto tam jechać: rodzaj nawierzchni,
          liczbę koszy, oświetlenie, ogrodzenie, godziny i zasady dostępu oraz dokładną pinezkę
          z GPS-u. Mapę przefiltrujesz po nawierzchni, typie boiska, województwie i dostępności,
          sprawdzisz prognozę na dziś dla boisk odkrytych, zobaczysz, kto wybiera się tam zagrać
          i o której, podpalisz swoje ulubione miejsca i zapiszesz je na własną listę.
        </p>
        <p>
          Są też dwa rankingi. W rankingu boisk kolejność ustala społeczność - im więcej
          płonących piłek, tym wyżej stoi miejsce, na którym naprawdę dobrze się gra. W rankingu
          graczy liczy się to, ile boisk ktoś dodał i opublikował. Tu potrzebne jest konto:
          zgłoszenia bez logowania trafiają na mapę, ale nie mają właściciela, więc nie wchodzą
          do rankingu.
        </p>
        <p className="text-ink/90">
          Najważniejsze: tej bazy nie tworzy żadna instytucja. Buduje ją społeczność, boisko po
          boisku. Każde zgłoszenie sprawdzamy i publikujemy, a Ty trafiasz do rankingu odkrywców.
        </p>
      </div>

      {/*
        Licznik bazy bez ramki i bez karty: liczba stoi wprost na stronie, na rysunku boiska
        leżącym pod całą treścią. Zostaje tylko ciepła poświata pod cyframi, żeby nie wisiały
        w pustce. Liczba leci prosto z Supabase przy każdym wejściu.
      */}
      <section className="relative mt-16 py-10 text-center sm:py-16">
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,460px)] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 blur-[90px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,77,10,.42) 0%, rgba(255,122,24,.16) 50%, transparent 100%)",
          }}
        />

        <div className="relative">
          <p className="text-[14px] font-medium uppercase tracking-[0.36em] text-white/70 sm:text-[17px]">
            Boisk w bazie
          </p>
          {/*
            Gradient nakładany przez background-clip: text maluje tylko pudełko wiersza, więc
            liczba potrzebuje zapasu z dwóch stron: leading powyżej 1 (inaczej dolne krzywe cyfr
            zostawały niepomalowane) i wcięcie z prawej, bo ujemny tracking odejmuje odstęp także
            po ostatniej cyfrze - i to jej prawy bok zostawał nieomalowany.
          */}
          <p className="mt-2 flame-text pb-3 pr-[0.08em] text-[clamp(96px,22vw,236px)] font-bold leading-[1.04] tracking-[-0.05em] tabular-nums sm:mt-3">
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
