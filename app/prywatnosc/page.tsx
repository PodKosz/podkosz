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
const AKTUALIZACJA = "19 sierpnia 2026";
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
            Serwis {SITE_NAME} ({SITE_URL}) prowadzi osoba prywatna, twórca projektu, występujący w
            serwisie jako Basket. Kontakt we wszystkich sprawach dotyczących danych:{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>
            .
          </p>
        </Sekcja>

        <Sekcja title="Co zbieramy i po co">
          <Lista
            items={[
              [
                "Konto Google (opcjonalnie)",
                "jeśli logujesz się przez Google, zapisujemy adres e-mail, nazwę i adres zdjęcia profilowego. Służą do rozpoznania Cię przy podpalaniu boisk, ulubionych i przy Twoich zgłoszeniach. Nie pobieramy z Google nic więcej i nie mamy dostępu do Twojej skrzynki ani kontaktów.",
              ],
              [
                "Zgłoszenia boisk",
                "zdjęcia, współrzędne, opis oraz - jeśli je podasz - nazwa i adres e-mail autora. E-mail używamy wyłącznie po to, żeby napisać Ci, czy boisko zostało opublikowane.",
              ],
              [
                "Opinie i zgłoszenia błędów",
                "treść wiadomości oraz opcjonalny kontakt, który sam podasz.",
              ],
              [
                "Skrót adresu IP",
                "przy zgłoszeniach i opiniach zapisujemy nieodwracalny skrót (hash) adresu IP, żeby ograniczyć liczbę wysyłek z jednego urządzenia. Nie przechowujemy adresów IP w czytelnej postaci.",
              ],
              [
                "Statystyka odwiedzin",
                "liczba wizyt w podziale na dni, bez profilowania i bez reklamowych plików cookie.",
              ],
              [
                "Lokalizacja",
                "kreator dodawania boiska prosi o dostęp do lokalizacji, żeby postawić pinezkę tam, gdzie stoisz. Współrzędne trafiają do zgłoszenia boiska - nie zapisujemy historii Twoich położeń.",
              ],
            ]}
          />
        </Sekcja>

        <Sekcja title="Podstawa prawna">
          <p>
            Dane konta, zgłoszenia i opinie przetwarzamy na podstawie Twojej zgody oraz w celu
            świadczenia usługi (art. 6 ust. 1 lit. a i b RODO). Skróty adresów IP i statystykę
            odwiedzin - na podstawie prawnie uzasadnionego interesu, jakim jest ochrona serwisu
            przed nadużyciami (art. 6 ust. 1 lit. f RODO).
          </p>
        </Sekcja>

        <Sekcja title="Komu powierzamy dane">
          <Lista
            items={[
              ["Supabase", "baza danych i pliki zdjęć, serwery w Unii Europejskiej (Frankfurt)."],
              ["Vercel", "hosting aplikacji."],
              ["Cloudflare", "ochrona i przyspieszenie ruchu do serwisu."],
              ["Google", "logowanie przez konto Google, jeśli z niego korzystasz."],
              ["Resend", "wysyłka wiadomości e-mail o zgłoszeniach i opiniach."],
              [
                "OpenStreetMap, CARTO",
                "podkład mapy i dane o miejscach. Do tych usług nie wysyłamy Twoich danych osobowych.",
              ],
            ]}
          />
          <p className="mt-4">
            Nie sprzedajemy danych, nie przekazujemy ich do celów reklamowych i nie profilujemy
            użytkowników.
          </p>
        </Sekcja>

        <Sekcja title="Jak długo trzymamy dane">
          <Lista
            items={[
              ["Konto", "do momentu, w którym poprosisz o jego usunięcie."],
              [
                "Opublikowane boiska",
                "bezterminowo, bo tworzą bazę serwisu. Na życzenie usuwamy z wpisu nazwę autora.",
              ],
              [
                "Odrzucone zgłoszenia",
                "do 12 miesięcy, jako ślad moderacyjny; potem znikają razem ze zdjęciami.",
              ],
              ["Opinie i zgłoszenia błędów", "do 24 miesięcy."],
              ["Skróty adresów IP", "do 30 dni."],
            ]}
          />
        </Sekcja>

        <Sekcja title="Twoje prawa">
          <p>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia
            przetwarzania, przeniesienia oraz wniesienia sprzeciwu. Wystarczy wiadomość na{" "}
            <a className="text-flame" href={`mailto:${KONTAKT}`}>
              {KONTAKT}
            </a>{" "}
            - odpowiadamy w ciągu 30 dni. Możesz też złożyć skargę do Prezesa Urzędu Ochrony Danych
            Osobowych.
          </p>
          <p className="mt-4">
            Usunięcie konta usuwa Twoje polubienia i ulubione oraz nazwę autora przy dodanych
            boiskach. Same wpisy boisk zostają, bo są treścią serwisu i nie zawierają danych
            osobowych.
          </p>
        </Sekcja>

        <Sekcja title="Pliki cookie">
          <p>
            Używamy wyłącznie plików niezbędnych do działania serwisu: ciasteczka sesji logowania
            (jeśli się logujesz) oraz jednorazowego znacznika wizyty w pamięci przeglądarki, żeby
            nie liczyć tej samej sesji dwa razy. Nie stosujemy cookie reklamowych ani
            analitycznych, które śledziłyby Cię między stronami.
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
