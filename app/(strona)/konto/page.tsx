import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { pobierzKonto } from "@/lib/konto";
import { statystykiGracza } from "@/lib/profil";
import { Odznaczenia } from "@/components/Odznaczenia";
import { plural, slugifyPlace } from "@/lib/site";
import { CourtCard } from "@/components/CourtCard";
import { TloPilki } from "@/components/TloPilki";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { FireBallIcon, PinIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Moje konto - PodKosz",
  description: "Twoje boiska, podpalenia, ulubione i historia gry.",
  robots: { index: false, follow: false },
};

/* Strona jest prywatna - nic tu nie może być cache'owane ani współdzielone. */
export const dynamic = "force-dynamic";

const GODZINA = (h: number) => `${String(h).padStart(2, "0")}:00`;

/* „18:00-21:00" dla zakresu, „18:00" dla jednej godziny (koniec +1, bo grało się tę godzinę) */
const ZAKRES = (hours: number[]) => {
  if (!hours.length) return "-";
  const od = hours[0];
  const doG = hours[hours.length - 1];
  return od === doG ? GODZINA(od) : `${GODZINA(od)}-${GODZINA(doG + 1)}`;
};

export default async function KontoPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="relative mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
        <TloPilki uid="konto" />
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Moje konto</p>
        <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
          Twoje konto
        </h1>
        <p className="szklo-pro mt-8 rounded-[28px] p-8 text-center text-[15px] text-muted">
          Zaloguj się przez Google (przycisk w prawym górnym rogu), żeby zobaczyć swoje boiska,
          podpalenia, ulubione i historię gry.
        </p>
      </main>
    );
  }

  const [dane, statystyki] = await Promise.all([
    pobierzKonto(user.id, user.name),
    statystykiGracza(user.name),
  ]);

  const kafelki: [string, string | number][] = [
    ["Boiska w bazie", dane.dodane.length],
    ["Zebrane podpalenia", dane.zebranePodpalenia],
    ["Twoje podpalenia", dane.podpalenia],
    ["Ulubione", dane.ulubione.length],
    ["W kolejce", dane.wKolejce],
    ["Zapisy na grę", dane.historia.length],
  ];

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <TloPilki uid="konto" />

      {/*
        Karta powitalna na szkle: avatar w gradientowym pierścieniu, nick, a po prawej dwa
        wyjścia - publiczny profil i ustawienia. Wszystko w jednym kadrze, żeby wejście na
        konto nie zaczynało się od surowego nagłówka na czarnym tle.
      */}
      <header className="szklo-pro flex flex-wrap items-center gap-5 rounded-[32px] p-6 sm:p-8">
        <span className="awatar-ramka shrink-0">
          <span className="grid h-[74px] w-[74px] place-items-center overflow-hidden text-[24px] font-bold">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="flame-text">{user.name.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
        </span>

        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Moje konto</p>
          <h1 className="mt-1 truncate text-[clamp(28px,4vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
            {user.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="truncate">{user.email}</span>
            {user.isAdmin && (
              <span className="rounded-full border border-flame/40 bg-flame/10 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-glow">
                administrator
              </span>
            )}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href={`/gracz/${slugifyPlace(user.name)}`}
            className="rounded-full border border-hairline bg-white/6 px-5 py-2.5 text-[13px] font-medium text-muted transition hover:border-flame/40 hover:text-ink"
          >
            Publiczny profil
          </Link>
          <Link
            href="/konto/ustawienia"
            className="rounded-2xl flame-gradient px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110"
          >
            Ustawienia konta
          </Link>
        </div>
      </header>

      {user.isBanned && (
        <p className="mt-6 rounded-[24px] border border-ember/40 bg-ember/10 px-6 py-5 text-[14px] leading-relaxed text-ember">
          <span className="font-semibold">Konto jest zablokowane.</span> Możesz przeglądać serwis,
          ale dodawanie boisk, podpalanie, ulubione i zapisy na grę są wyłączone. Jeśli to
          pomyłka, napisz do nas przez formularz opinii.
        </p>
      )}

      {/* ---------- statystyki ---------- */}
      <section className="mt-8">
        <NaglowekSekcji tytul="Twoje liczby" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kafelki.map(([label, wartosc]) => (
            <div key={label} className="kafel p-4">
              <p className="flame-text pb-1 text-[30px] font-bold leading-none tabular-nums">
                {wartosc}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-faint">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- odznaczenia ---------- */}
      <Odznaczenia statystyki={statystyki} />

      {/* ---------- moje boiska ---------- */}
      <section className="mt-12">
        <NaglowekSekcji tytul={`Boiska, które dodałeś (${dane.dodane.length})`} />
        {dane.dodane.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dane.dodane.map((c) => (
              <CourtCard key={c.id} court={c} />
            ))}
          </div>
        ) : (
          <p className="szklo-pro mt-4 rounded-[28px] p-8 text-center text-[15px] text-muted">
            Jeszcze nic nie dodałeś.{" "}
            <Link href="/dodaj" className="text-flame transition hover:brightness-110">
              Dodaj pierwsze boisko
            </Link>{" "}
            - zajmuje trzy minuty.
          </p>
        )}
        {(dane.wKolejce > 0 || dane.odrzucone > 0) && (
          <p className="mt-3 text-[13px] text-muted">
            {dane.wKolejce > 0 && (
              <>
                {dane.wKolejce} {plural(dane.wKolejce, ["zgłoszenie", "zgłoszenia", "zgłoszeń"])} w
                kolejce do sprawdzenia.{" "}
              </>
            )}
            {dane.odrzucone > 0 && <>Odrzucone: {dane.odrzucone}.</>}
          </p>
        )}
      </section>

      {/* ---------- ulubione ---------- */}
      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <NaglowekSekcji tytul={`Ulubione (${dane.ulubione.length})`} />
          <Link
            href="/ulubione"
            className="shrink-0 text-[13px] text-muted transition hover:text-flame"
          >
            cała lista
          </Link>
        </div>
        {dane.ulubione.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dane.ulubione.slice(0, 6).map((c) => (
              <CourtCard key={c.id} court={c} />
            ))}
          </div>
        ) : (
          <p className="szklo-pro mt-4 rounded-[28px] p-8 text-center text-[15px] text-muted">
            Nic tu jeszcze nie ma. Na karcie boiska kliknij „Do ulubionych”.
          </p>
        )}
      </section>

      {/* ---------- historia gry ---------- */}
      <section className="mt-12">
        <NaglowekSekcji tytul={`Gdzie grałeś (${dane.historia.length})`} />
        <p className="mt-2 text-[13px] text-muted">
          Lista powstaje z zapisów „idę dziś zagrać” - najnowsze na górze.
        </p>

        {dane.historia.length ? (
          <ul className="mt-4 space-y-2">
            {dane.historia.map((w, i) => (
              <li
                key={`${w.day}-${w.court?.slug ?? i}`}
                className="kafel flex items-center gap-4 px-4 py-3.5"
              >
                <span className="w-24 shrink-0 text-[13px] tabular-nums text-muted">
                  {new Date(w.day).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
                <span className="w-28 shrink-0 text-[14px] font-semibold tabular-nums text-glow">
                  {ZAKRES(w.hours)}
                </span>
                <span className="min-w-0 flex-1">
                  {w.court ? (
                    <Link
                      href={`/boisko/${w.court.slug}`}
                      className="block truncate text-[15px] font-medium transition hover:text-flame"
                    >
                      {w.court.name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] text-muted">
                      boisko usunięte z bazy
                    </span>
                  )}
                  {w.court && (
                    <span className="flex items-center gap-1.5 text-[12px] text-faint">
                      <PinIcon className="h-3 w-3 text-flame" /> {w.court.city}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="szklo-pro mt-4 rounded-[28px] p-8 text-center text-[15px] text-muted">
            Jeszcze nigdzie się nie zapisałeś. Na karcie boiska kliknij{" "}
            <span className="inline-flex items-center gap-1 text-ink">
              <FireBallIcon className="h-4 w-4" /> „Idę dziś zagrać”
            </span>
            .
          </p>
        )}
      </section>
    </main>
  );
}
