import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lista, Mail, RamaPrzed, Sekcja, TytulDokumentu } from "@/components/Dokument";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";

export const metadata: Metadata = {
  title: `Polityka prywatności - ${SITE_NAME}`,
  description: "Jakie dane zbiera PodKosz przed otwarciem, po co i jak długo je trzyma.",
  alternates: { canonical: "/prywatnosc" },
};

const AKTUALIZACJA = "16 października 2026";

/**
 * Polityka prywatności w wersji „przed" otwarciem.
 *
 * Proxy podstawia ją pod `/prywatnosc` każdemu, kogo zasłona nie wpuszcza (`WERSJE_PRZED`
 * w `proxy.ts`), więc w pasku adresu stoi zwykłe `/prywatnosc`. Wpuszczeni widzą pełną
 * wersję z `app/(strona)/prywatnosc` - opis obu i wspólne klocki w `components/Dokument.tsx`.
 *
 * Tekst celowo NIE mówi, czym jest serwis, tak jak sama zasłona (decyzja z 16.10.2026).
 * Opisuje za to wszystko, co dzieje się z danymi osoby spoza testów, zanim serwis ruszy:
 * zapis na otwarcie, logowanie przyciskiem dla testerów, ochronę przed nadużyciami.
 * Zmieniając którąś z tych rzeczy w kodzie, popraw też ten tekst.
 */
export default function PrywatnoscPrzed() {
  /* po otwarciu ta wersja nie obowiązuje nikogo - jej adres prowadzi do pełnej */
  if (!ZASLONA) redirect("/prywatnosc");

  return (
    <RamaPrzed uid="prywatnosc-przed">
      <TytulDokumentu tytul="Polityka prywatności" aktualizacja={AKTUALIZACJA} />

      <p className="mt-6 text-[16px] leading-relaxed text-muted">
        Serwis jeszcze nie ruszył. Ta wersja polityki obowiązuje do dnia otwarcia i opisuje to,
        co dzieje się z danymi przed nim: zapis na wiadomość o otwarciu, logowanie osób
        zaproszonych do testów i ochronę strony przed nadużyciami.
      </p>

      <div className="mt-10 space-y-10">
        <Sekcja title="Kto odpowiada za dane">
          <p>
            Administratorem danych jest Szymon Tyszkowski, twórca serwisu {SITE_NAME} ({SITE_URL}).
            We wszystkich sprawach dotyczących danych pisz na <Mail />.
          </p>
        </Sekcja>

        <Sekcja title="Co zbieramy, po co i na jakiej podstawie">
          <Lista
            items={[
              [
                "Zapis na otwarcie",
                "adres e-mail podany w formularzu „Zapisz się na otwarcie”. Wysyłamy na niego krótkie potwierdzenie zapisu i jedną wiadomość w dniu otwarcia serwisu - bez newslettera i bez reklam. Podstawa: Twoja zgoda (art. 6 ust. 1 lit. a RODO), którą możesz wycofać w każdej chwili, pisząc do nas.",
              ],
              [
                "Ochrona formularza zapisu",
                "razem z adresem zapisujemy skrót (hash) adresu IP, z którego przyszedł zapis, żeby ograniczyć liczbę zapisów z jednego urządzenia i nie dało się hurtowo wpisywać na listę cudzych adresów. To pseudonim, a nie anonim, dlatego znika razem z adresem e-mail. Podstawa: prawnie uzasadniony interes, jakim jest bezpieczeństwo strony (lit. f).",
              ],
              [
                "Logowanie dla zaproszonych do testów",
                "przycisk dla testerów loguje przez konto Google. Dostajemy wtedy adres e-mail, nazwę i adres zdjęcia profilowego - nie mamy dostępu do Twojej skrzynki ani kontaktów. Po adresie sprawdzamy, czy jesteś na liście osób zaproszonych do testów; zaproszone osoby dostają dostęp do wersji testowej i jednorazowe powitanie mailem. Jeśli Twojego adresu nie ma na liście, konto i tak powstaje, ale do dnia otwarcia nie daje dostępu do niczego - potem działa jak zwykłe konto w serwisie. Podstawa: świadczenie usługi, o którą prosisz, logując się (lit. b).",
              ],
              [
                "Lista zaproszonych do testów",
                "adresy e-mail osób, które zaprosiliśmy do testów - tylko po to, żeby wpuścić je po zalogowaniu. Podstawa: prawnie uzasadniony interes, jakim jest sprawdzenie serwisu przed otwarciem (lit. f).",
              ],
              [
                "Wiadomości do nas",
                "jeśli napiszesz na nasz adres, mamy Twój adres e-mail i treść wiadomości - po to, żeby odpowiedzieć. Podstawa: prawnie uzasadniony interes, jakim jest odpowiadanie na wiadomości (lit. f).",
              ],
              [
                "Ochrona przed nadużyciami",
                "przy każdym wejściu serwer sprawdza, czy adres IP nie jest zablokowany, i liczy żądania z jednego adresu, żeby strony nie dało się zalać. Ten licznik żyje kilka minut w pamięci serwera i nigdzie go nie zapisujemy. Przy rażących nadużyciach administrator może zablokować adres IP - wtedy adres jest przechowywany w czytelnej postaci przez czas blokady. Niezależnie od tego dostawcy hostingu wymienieni niżej odnotowują w dziennikach technicznych adres IP i czas żądania, jak przy każdej stronie w internecie. Podstawa: prawnie uzasadniony interes, jakim jest bezpieczeństwo strony (lit. f).",
              ],
            ]}
          />
          <p className="mt-4">
            Podanie danych jest dobrowolne - stronę zapowiedzi obejrzysz bez podawania czegokolwiek.
            Nie liczymy odwiedzin, nie podejmujemy wobec nikogo decyzji w sposób zautomatyzowany
            i nie profilujemy nikogo.
          </p>
        </Sekcja>

        <Sekcja title="Komu powierzamy dane">
          <Lista
            items={[
              ["Supabase", "baza danych i logowanie, serwery w Unii Europejskiej (Frankfurt)."],
              ["Vercel", "hosting strony."],
              ["Cloudflare", "ochrona i przyspieszenie ruchu do strony."],
              ["Google", "logowanie przez konto Google oraz skrzynka, na którą do nas piszesz."],
              ["Resend", "wysyłka wiadomości e-mail."],
            ]}
          />
          <p className="mt-4">
            Vercel, Cloudflare, Google i Resend to firmy z siedzibą w USA, więc dane mogą trafić
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
              [
                "Zapis na otwarcie",
                "adres e-mail i skrót adresu IP - do 30 dni po wysłaniu wiadomości o otwarciu, a jeśli wcześniej wycofasz zgodę, do chwili jej wycofania.",
              ],
              [
                "Konto założone przy logowaniu",
                "dopóki go nie usuniesz. Przed otwarciem wystarczy do nas napisać, po otwarciu zrobisz to sam w ustawieniach konta.",
              ],
              ["Lista zaproszonych do testów", "do końca testów."],
              ["Wiadomości do nas", "do zamknięcia sprawy, a potem najwyżej 24 miesiące, gdyby sprawa wróciła."],
              ["Blokady adresów IP", "przez czas blokady i 30 dni po jej końcu."],
            ]}
          />
          <p className="mt-4">
            Zapisy i blokady usuwa automat, który co noc kasuje to, co się przeterminowało.
          </p>
        </Sekcja>

        <Sekcja title="Twoje prawa">
          <p>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia
            przetwarzania i przeniesienia. Zgodę na wiadomość o otwarciu możesz wycofać w każdej
            chwili - nie wpływa to na to, co zrobiliśmy przed jej wycofaniem. Możesz też
            sprzeciwić się przetwarzaniu opartemu na naszym prawnie uzasadnionym interesie.
            Wystarczy wiadomość na <Mail /> - odpowiadamy w ciągu 30 dni. Masz też prawo złożyć
            skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa,
            uodo.gov.pl).
          </p>
        </Sekcja>

        <Sekcja title="Pliki cookie i pamięć przeglądarki">
          <p>
            Używamy wyłącznie tego, co jest niezbędne do działania strony: ciasteczek sesji
            logowania (tylko jeśli logujesz się jako tester) i zapamiętanego w przeglądarce wyglądu
            strony. Nie stosujemy cookie reklamowych ani analitycznych, które śledziłyby Cię między
            stronami, dlatego nie pytamy o zgodę na cookie.
          </p>
        </Sekcja>

        <Sekcja title="Testy, otwarcie i zmiany polityki">
          <p>
            Osoby zaproszone do testów po zalogowaniu korzystają z wersji testowej serwisu i pod
            tym samym adresem widzą wtedy pełną politykę prywatności - to ona opisuje, co dzieje
            się z ich danymi w czasie testów. W dniu otwarcia pełna wersja zastąpi tę stronę dla
            wszystkich. Jeśli zmiana będzie dotyczyć nowego celu, w jakim używamy danych, które
            już mamy, zapytamy o to wcześniej.
          </p>
        </Sekcja>
      </div>

      <div className="glass mt-14 rounded-[24px] p-6 text-[14px] text-muted">
        Zobacz też <Link href="/regulamin" className="text-flame">regulamin</Link>.
      </div>
    </RamaPrzed>
  );
}
