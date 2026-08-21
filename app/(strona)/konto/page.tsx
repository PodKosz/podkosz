import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { pobierzKonto } from "@/lib/konto";
import { statystykiGracza } from "@/lib/profil";
import { Odznaczenia } from "@/components/Odznaczenia";
import { plural, slugifyPlace } from "@/lib/site";
import { CourtCard } from "@/components/CourtCard";
import { ZmianaNicku } from "@/components/konto/ZmianaNicku";
import { UsunKonto } from "@/components/konto/UsunKonto";
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
      <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
        <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Moje konto</p>
        <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
          Twoje konto
        </h1>
        <p className="glass mt-8 rounded-[24px] p-8 text-center text-[15px] text-muted">
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
    <main className="mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28">
      <header className="flex flex-wrap items-center gap-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full flame-gradient text-[22px] font-bold text-black">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.name.slice(0, 1).toUpperCase()
          )}
        </span>

        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Moje konto</p>
          <h1 className="mt-1 truncate text-[clamp(28px,4vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
            {user.name}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {user.email}
            {user.isAdmin && <span className="ml-2 text-flame">· administrator</span>}
          </p>
        </div>

        <Link
          href={`/gracz/${slugifyPlace(user.name)}`}
          className="glass ml-auto rounded-full px-5 py-2.5 text-[13px] font-medium text-muted transition hover:text-ink"
        >
          Twój publiczny profil
        </Link>
      </header>

      {user.isBanned && (
        <p className="mt-8 rounded-[24px] border border-ember/40 bg-ember/10 px-6 py-5 text-[14px] leading-relaxed text-ember">
          <span className="font-semibold">Konto jest zablokowane.</span> Możesz przeglądać serwis,
          ale dodawanie boisk, podpalanie, ulubione i zapisy na grę są wyłączone. Jeśli to
          pomyłka, napisz do nas przez formularz opinii.
        </p>
      )}

      {/* ---------- statystyki ---------- */}
      <section className="mt-10">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Twoje liczby</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kafelki.map(([label, wartosc]) => (
            <div key={label} className="glass rounded-[20px] p-4">
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

      {/* ---------- nick ---------- */}
      <section className="mt-10">
        <ZmianaNicku
          nick={user.name}
          ostatniaZmiana={dane.nickZmieniony}
          zablokowane={user.isBanned}
        />
      </section>

      {/* ---------- moje boiska ---------- */}
      <section className="mt-12">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
          Boiska, które dodałeś ({dane.dodane.length})
        </h2>
        {dane.dodane.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dane.dodane.map((c) => (
              <CourtCard key={c.id} court={c} />
            ))}
          </div>
        ) : (
          <p className="glass mt-4 rounded-[24px] p-8 text-center text-[15px] text-muted">
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
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
            Ulubione ({dane.ulubione.length})
          </h2>
          <Link
            href="/ulubione"
            className="text-[13px] text-muted transition hover:text-flame"
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
          <p className="glass mt-4 rounded-[24px] p-8 text-center text-[15px] text-muted">
            Nic tu jeszcze nie ma. Na karcie boiska kliknij „Do ulubionych”.
          </p>
        )}
      </section>

      {/* ---------- historia gry ---------- */}
      <section className="mt-12">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
          Gdzie grałeś ({dane.historia.length})
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Lista powstaje z zapisów „idę dziś zagrać” - najnowsze na górze.
        </p>

        {dane.historia.length ? (
          <ul className="mt-4 space-y-2">
            {dane.historia.map((w, i) => (
              <li
                key={`${w.day}-${w.court?.slug ?? i}`}
                className="glass flex items-center gap-4 rounded-[20px] px-4 py-3.5"
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
          <p className="glass mt-4 rounded-[24px] p-8 text-center text-[15px] text-muted">
            Jeszcze nigdzie się nie zapisałeś. Na karcie boiska kliknij{" "}
            <span className="inline-flex items-center gap-1 text-ink">
              <FireBallIcon className="h-4 w-4" /> „Idę dziś zagrać”
            </span>
            .
          </p>
        )}
      </section>

      {/* ---------- usunięcie konta ---------- */}
      <section className="mt-14">
        <UsunKonto />
      </section>
    </main>
  );
}
