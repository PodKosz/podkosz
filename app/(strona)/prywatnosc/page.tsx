import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Polityka prywatności - ${SITE_NAME}`,
  description:
    "Jakie dane zbiera PodKosz, po co, jak długo je trzyma i jak zażądać ich usunięcia.",
  alternates: { canonical: "/prywatnosc" },
};

/** Ostatnia zmiana treści - pokazywana na stronie i przydatna przy weryfikacji Google OAuth. */
const AKTUALIZACJA = "28 września 2026";
const KONTAKT = "podkoszpl@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Dokumenty</p>
      <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
        Polityka prywatności
      </h1>
      <p className="mt-3 text-[14px] text-faint">Ostatnia aktualizacja: {AKTUALIZACJA}</p>

      <div className="mt-10 space-y-10">
        <Sekcja title="Kto odpowiada za dane">
          <p>
            Administratorem danych jest twórca serwisu {SITE_NAME} ({SITE_URL}) - osoba prywatna,
            występująca w serwisie jako Basket. We wszystkich sprawach dotyczących danych pisz na{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>
            .
          </p>
        </Sekcja>

        <Sekcja title="Co zbieramy, po co i na jakiej podstawie">
          <Lista
            items={[
              [
                "Konto Google",
                "przy logowaniu przez Google dostajemy adres e-mail, nazwę i adres zdjęcia profilowego. Konto służy do podpalania boisk, ulubionych, deklaracji gry, zgłoszeń i odznaczeń. Nie mamy dostępu do Twojej skrzynki ani kontaktów. Podstawa: świadczenie usługi, o którą prosisz, zakładając konto (art. 6 ust. 1 lit. b RODO).",
              ],
              [
                "Profil publiczny",
                "Twój nick, zdjęcie profilowe, dodane boiska, odznaczenia i miejsce w rankingu widzą wszyscy odwiedzający (strona gracza, ranking, wyniki mini-gry). Adresu e-mail nie pokazujemy nikomu. Nick zmienisz w ustawieniach konta. Podstawa: świadczenie usługi (lit. b).",
              ],
              [
                "Deklaracje gry",
                "dzień, godziny i boisko, na którym deklarujesz grę. Inni widzą tylko liczbę osób na daną godzinę, nie to, kto się zapisał. Historia deklaracji liczy Twoje odznaczenia. Podstawa: świadczenie usługi (lit. b).",
              ],
              [
                "Zgłoszenia boisk i poprawki zdjęć",
                "zdjęcia, współrzędne boiska, opis oraz Twój adres, żeby napisać, czy boisko zostało opublikowane. Przy zdjęciu z aparatu zapisujemy tylko odległość pinezki od miejsca zrobienia zdjęcia (w metrach), żeby wyłapać pomyłki - samego położenia nie. Zdjęcia są przekodowywane w przeglądarce, więc metadane z telefonu (w tym GPS) nie trafiają na serwer. Podstawa: świadczenie usługi (lit. b).",
              ],
              [
                "Lista na otwarcie",
                "adres e-mail podany w formularzu „Zapisz się na otwarcie” - wyłącznie do jednej wiadomości w dniu otwarcia serwisu. Podstawa: Twoja zgoda (lit. a), którą możesz wycofać w każdej chwili, pisząc do nas.",
              ],
              [
                "Wiadomości e-mail z serwisu",
                "wysyłamy jednorazowe powitanie po założeniu konta, wiadomość o decyzji w sprawie zgłoszonego boiska i powiadomienia o wydarzeniach na boiskach, które podpaliłeś albo na których deklarowałeś grę, lub w ich okolicy. Nie wysyłamy newslettera ani reklam. Podstawa powitania i wiadomości o zgłoszeniu: świadczenie usługi (lit. b). Podstawa powiadomień o wydarzeniach: nasz prawnie uzasadniony interes, jakim jest informowanie graczy o tym, co dzieje się na ich boiskach (lit. f) - każdy taki mail ma link do wypisania się jednym kliknięciem, a powiadomienia wyłączysz też w ustawieniach konta.",
              ],
              [
                "Opinie i zgłoszenia błędów",
                "treść wiadomości i kontakt, jeśli go podasz. Podstawa: nasz prawnie uzasadniony interes, jakim jest odpowiadanie na wiadomości i poprawianie danych o boiskach (lit. f).",
              ],
              [
                "Ochrona przed nadużyciami",
                "przy zgłoszeniach, opiniach i raportach zapisujemy skrót (hash) adresu IP, żeby ograniczyć liczbę wysyłek z jednego urządzenia. To pseudonim, a nie anonim - dlatego kasujemy go po 30 dniach. Przy rażących nadużyciach administrator może zablokować adres IP; wtedy adres jest przechowywany w czytelnej postaci przez czas blokady. Podstawa: prawnie uzasadniony interes, jakim jest bezpieczeństwo serwisu (lit. f).",
              ],
              [
                "Statystyka odwiedzin",
                "dla każdego dnia: skrót adresu IP i liczba odsłon, żeby policzyć, ilu gości było na stronie - bez profilowania, bez reklamowych plików cookie i bez śledzenia między stronami. Licznik „ilu teraz na stronie” trzyma skrót przez dobę. Podstawa: prawnie uzasadniony interes, jakim jest wiedza o tym, czy serwis jest używany (lit. f).",
              ],
              [
                "Lokalizacja",
                "kreator dodawania boiska prosi przeglądarkę o dostęp do lokalizacji, żeby postawić pinezkę tam, gdzie stoisz, a mapa - żeby pokazać boiska w pobliżu. Twoje położenie nie jest nigdzie zapisywane; do zgłoszenia trafiają współrzędne boiska.",
              ],
            ]}
          />
          <p className="mt-4">
            Podanie danych jest dobrowolne. Bez konta możesz przeglądać mapę i boiska; konto jest
            potrzebne tylko do tego, co zmienia mapę. Nie podejmujemy wobec nikogo decyzji
            w sposób zautomatyzowany i nie profilujemy użytkowników.
          </p>
        </Sekcja>

        <Sekcja title="Komu powierzamy dane">
          <Lista
            items={[
              ["Supabase", "baza danych i logowanie, serwery w Unii Europejskiej (Frankfurt)."],
              ["Cloudflare", "przechowywanie zdjęć (R2) oraz ochrona i przyspieszenie ruchu do serwisu."],
              ["Vercel", "hosting aplikacji."],
              ["Google", "logowanie przez konto Google."],
              ["Resend", "wysyłka wiadomości e-mail."],
              [
                "OpenStreetMap, CARTO, Esri",
                "podkład mapy. Twoja przeglądarka pobiera od nich kafelki mapy, więc widzą Twój adres IP - tak jak przy każdej stronie z mapą. Danych konta im nie przekazujemy.",
              ],
            ]}
          />
          <p className="mt-4">
            Cloudflare, Vercel, Google i Resend to firmy z siedzibą w USA, więc dane mogą trafić
            poza Europejski Obszar Gospodarczy. Odbywa się to na podstawie decyzji Komisji
            Europejskiej stwierdzającej odpowiedni poziom ochrony (EU-US Data Privacy Framework)
            albo standardowych klauzul umownych zatwierdzonych przez Komisję.
          </p>
          <p className="mt-4">
            Nie sprzedajemy danych, nie przekazujemy ich do celów reklamowych i nie udostępniamy
            ich innym firmom na ich własne potrzeby.
          </p>
        </Sekcja>

        <Sekcja title="Jak długo trzymamy dane">
          <Lista
            items={[
              ["Konto, deklaracje gry, ulubione", "dopóki masz konto."],
              [
                "Usunięte konto",
                "po usunięciu konta adres e-mail, nazwa i zdjęcie profilowe zostają w archiwum przez 180 dni - tylko po to, żeby dało się przywrócić konto usunięte przez pomyłkę. Po tym czasie znikają bezpowrotnie. Jeśli chcesz, żeby zniknęły od razu, napisz do nas.",
              ],
              [
                "Opublikowane boiska",
                "bezterminowo, bo tworzą bazę serwisu. Na życzenie usuwamy z wpisu nazwę autora.",
              ],
              [
                "Odrzucone zgłoszenia i poprawki zdjęć",
                "12 miesięcy od decyzji, jako ślad moderacyjny; potem znikają razem ze zdjęciami.",
              ],
              ["Lista na otwarcie", "do 30 dni po wysłaniu wiadomości o otwarciu."],
              ["Opinie i zgłoszenia błędów", "24 miesiące."],
              ["Skróty adresów IP przy zgłoszeniach", "30 dni."],
              ["Statystyka odwiedzin", "12 miesięcy; licznik osób na stronie - doba."],
              ["Blokady adresów IP", "przez czas blokady i 30 dni po jej końcu."],
            ]}
          />
          <p className="mt-4">Terminy pilnuje automat, który co noc usuwa to, co się przeterminowało.</p>
        </Sekcja>

        <Sekcja title="Twoje prawa">
          <p>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia
            przetwarzania i przeniesienia. Zgodę możesz wycofać w każdej chwili - nie wpływa to na
            to, co zrobiliśmy przed jej wycofaniem. Możesz też w każdej chwili sprzeciwić się
            przetwarzaniu opartemu na naszym prawnie uzasadnionym interesie, w tym powiadomieniom
            o wydarzeniach. Wystarczy wiadomość na{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>{" "}
            - odpowiadamy w ciągu 30 dni. Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony
            Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).
          </p>
          <p className="mt-4">
            Konto usuniesz sam w ustawieniach konta. Usunięcie konta kasuje Twoje podpalenia,
            ulubione i deklaracje gry oraz nazwę autora przy dodanych boiskach. Same wpisy boisk
            zostają, bo są treścią serwisu i nie zawierają danych osobowych.
          </p>
        </Sekcja>

        <Sekcja title="Pliki cookie i pamięć przeglądarki">
          <p>
            Używamy wyłącznie tego, co jest niezbędne do działania serwisu: ciasteczek sesji
            logowania (jeśli się logujesz), zapamiętanego motywu jasny/ciemny oraz jednorazowego
            znacznika wizyty w pamięci karty przeglądarki, żeby nie liczyć tej samej wizyty dwa
            razy. Nie stosujemy cookie reklamowych ani analitycznych, które śledziłyby Cię między
            stronami, dlatego nie pytamy o zgodę na cookie.
          </p>
        </Sekcja>

        <Sekcja title="Zdjęcia i wizerunek">
          <p>
            Zdjęcia boisk publikujemy w serwisie i w wynikach wyszukiwania. Prosimy, żeby nie
            fotografować ludzi w zbliżeniu - zgłoszenia z rozpoznawalnymi twarzami odrzucamy. Jeśli
            znajdziesz na zdjęciu siebie i chcesz, żeby zniknęło, napisz na adres powyżej; usuwamy
            takie zdjęcia bez pytania o powód.
          </p>
        </Sekcja>

        <Sekcja title="Zmiany polityki">
          <p>
            Gdy zmienimy zasady, zaktualizujemy datę na górze tej strony. Jeśli zmiana będzie
            dotyczyć nowego celu, w jakim używamy Twoich danych, zapytamy o to wcześniej.
          </p>
        </Sekcja>
      </div>

      <div className="glass mt-14 rounded-[24px] p-6 text-[14px] text-muted">
        Zobacz też <Link href="/regulamin" className="text-flame">regulamin serwisu</Link>.
      </div>
    </main>
  );
}

function Sekcja({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

function Lista({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-3">
      {items.map(([name, desc]) => (
        <li key={name} className="border-l-2 border-flame/40 pl-4">
          <span className="font-semibold">{name}</span> - <span className="text-muted">{desc}</span>
        </li>
      ))}
    </ul>
  );
}
