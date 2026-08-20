import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Regulamin - ${SITE_NAME}`,
  description:
    "Zasady korzystania z PodKosza: dodawanie boisk, prawa do zdjęć, moderacja i odpowiedzialność.",
  alternates: { canonical: "/regulamin" },
};

const AKTUALIZACJA = "19 sierpnia 2026";
const KONTAKT = "podkoszpl@gmail.com";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Dokumenty</p>
      <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
        Regulamin
      </h1>
      <p className="mt-3 text-[14px] text-faint">Ostatnia aktualizacja: {AKTUALIZACJA}</p>

      <div className="mt-10 space-y-10">
        <Punkt nr={1} title="Czym jest serwis">
          <p>
            {SITE_NAME} ({SITE_URL}) to darmowa, tworzona przez społeczność mapa i baza boisk do
            koszykówki w Polsce. Korzystanie z serwisu jest bezpłatne i nie wymaga konta -
            logowanie przez Google potrzebne jest tylko do podpalania boisk i listy ulubionych.
          </p>
        </Punkt>

        <Punkt nr={2} title="Dodawanie boisk">
          <p>
            Każdy może zgłosić boisko. Zgłoszenie trafia do kolejki i pojawia się na mapie po
            sprawdzeniu przez autora serwisu, zwykle w ciągu doby. Zgłaszając boisko potwierdzasz,
            że:
          </p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>· zdjęcia zrobiłeś samodzielnie albo masz prawo je udostępnić,</li>
            <li>· nie przedstawiają rozpoznawalnych osób w zbliżeniu,</li>
            <li>· dane o boisku podajesz zgodnie ze swoją najlepszą wiedzą,</li>
            <li>· boisko jest ogólnodostępne albo dostępne na zasadach, które opisujesz.</li>
          </ul>
          <p className="mt-3">
            Zastrzegamy sobie prawo do odrzucenia zgłoszenia bez podania szczegółowego powodu,
            poprawienia opisu i kolejności zdjęć oraz usunięcia wpisu, który przestał być aktualny.
          </p>
        </Punkt>

        <Punkt nr={3} title="Prawa do zdjęć i treści">
          <p>
            Zdjęcia pozostają Twoje. Przesyłając je, udzielasz serwisowi nieodpłatnej,
            niewyłącznej i nieograniczonej czasowo zgody na ich publikację w serwisie {SITE_NAME},
            w podglądach linków w mediach społecznościowych i w wynikach wyszukiwania. Możesz w
            każdej chwili poprosić o usunięcie swoich zdjęć - napisz na{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>
            .
          </p>
          <p className="mt-3">
            Dane o lokalizacjach pochodzące z OpenStreetMap wykorzystujemy na licencji ODbL, z
            zachowaniem informacji o źródle na mapie.
          </p>
        </Punkt>

        <Punkt nr={4} title="Zasady korzystania">
          <p>Nie wolno:</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>· zgłaszać boisk, które nie istnieją, oraz duplikatów już opisanych miejsc,</li>
            <li>· wgrywać zdjęć niezwiązanych z boiskiem, obraźliwych ani cudzych,</li>
            <li>· sztucznie zawyżać liczby polubień ani obchodzić limitów zgłoszeń,</li>
            <li>· zbierać danych z serwisu w sposób automatyczny bez zgody autora,</li>
            <li>· wykorzystywać serwisu do reklamy.</li>
          </ul>
          <p className="mt-3">
            Za złamanie tych zasad możemy zablokować konto albo dostęp do dodawania boisk.
          </p>
        </Punkt>

        <Punkt nr={5} title="Odpowiedzialność">
          <p>
            Dane o boiskach pochodzą od użytkowników i mogą być nieaktualne: bramy bywają
            zamykane, nawierzchnie się psują, obręcze znikają. Serwis udostępnia informacje w
            dobrej wierze, ale nie gwarantuje ich poprawności i nie odpowiada za skutki decyzji
            podjętych na ich podstawie ani za zdarzenia na samych boiskach. Grasz na własną
            odpowiedzialność i szanujesz zasady obowiązujące na terenie obiektu.
          </p>
        </Punkt>

        <Punkt nr={6} title="Dostępność serwisu">
          <p>
            Serwis prowadzi jedna osoba w wolnym czasie. Nie gwarantujemy nieprzerwanej dostępności
            ani terminu wprowadzenia zmian, a funkcje mogą się zmieniać. O istotnych zmianach
            regulaminu informujemy na stronie głównej.
          </p>
        </Punkt>

        <Punkt nr={7} title="Zgłoszenia i kontakt">
          <p>
            Błąd we wpisie zgłosisz przyciskiem „Zgłoś błąd&rdquo; na karcie boiska, a wszystko inne -
            przez okienko opinii na stronie <Link href="/o-nas" className="text-flame">O nas</Link>{" "}
            albo mailem na{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>
            . Naruszenia praw autorskich i prośby o usunięcie zdjęć rozpatrujemy niezwłocznie.
          </p>
        </Punkt>
      </div>

      <div className="glass mt-14 rounded-[24px] p-6 text-[14px] text-muted">
        Zobacz też{" "}
        <Link href="/prywatnosc" className="text-flame">
          politykę prywatności
        </Link>
        .
      </div>
    </main>
  );
}

function Punkt({
  nr,
  title,
  children,
}: {
  nr: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        {nr}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}
