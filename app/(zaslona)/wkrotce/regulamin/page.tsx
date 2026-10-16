import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Punkt, RamaPrzed, TytulDokumentu } from "@/components/Dokument";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";

export const metadata: Metadata = {
  title: `Regulamin - ${SITE_NAME}`,
  description: "Zasady korzystania z PodKosza przed otwarciem: zapis na otwarcie i testy.",
  alternates: { canonical: "/regulamin" },
};

const AKTUALIZACJA = "16 października 2026";

/**
 * Regulamin w wersji „przed" otwarciem.
 *
 * Proxy podstawia go pod `/regulamin` każdemu, kogo zasłona nie wpuszcza (`WERSJE_PRZED`
 * w `proxy.ts`). Wpuszczeni widzą pełny regulamin z `app/(strona)/regulamin` - opis obu
 * wersji i wspólne klocki w `components/Dokument.tsx`.
 *
 * Tak jak zasłona, tekst celowo NIE mówi, czym jest serwis (decyzja z 16.10.2026).
 * Obejmuje tylko to, co da się zrobić przed otwarciem: zapis na otwarcie i wejście
 * dla zaproszonych do testów.
 */
export default function RegulaminPrzed() {
  /* po otwarciu ta wersja nie obowiązuje nikogo - jej adres prowadzi do pełnej */
  if (!ZASLONA) redirect("/regulamin");

  return (
    <RamaPrzed uid="regulamin-przed">
      <TytulDokumentu tytul="Regulamin" aktualizacja={AKTUALIZACJA} />

      <div className="mt-10 space-y-10">
        <Punkt nr={1} title="Czym jest strona">
          <p>
            {SITE_NAME} ({SITE_URL}) przygotowuje się do otwarcia. Do tego dnia strona pokazuje
            tylko zapowiedź, formularz zapisu na wiadomość o otwarciu i wejście dla osób
            zaproszonych do testów. Korzystanie z niej jest bezpłatne i nie wymaga konta.
          </p>
        </Punkt>

        <Punkt nr={2} title="Zapis na otwarcie">
          <p>
            Zapisać się może każdy, podając swój adres e-mail. Dostaniesz krótkie potwierdzenie
            i jedną wiadomość w dniu otwarcia - bez newslettera i bez reklam. Zapis do niczego nie
            zobowiązuje, a z listy wypiszesz się w każdej chwili, pisząc na <Mail />.
          </p>
          <p className="mt-3">
            Zapisując się, potwierdzasz, że adres należy do Ciebie. Co dzieje się z adresem,
            opisuje{" "}
            <Link href="/prywatnosc" className="text-flame">
              polityka prywatności
            </Link>
            .
          </p>
        </Punkt>

        <Punkt nr={3} title="Testy przed otwarciem">
          <p>
            Do wersji testowej wchodzą tylko osoby zaproszone przez autora serwisu, po zalogowaniu
            kontem Google, którego adres jest na liście testów. Zaproszenie jest imienne, nie
            przechodzi na inne osoby i może zostać w każdej chwili cofnięte.
          </p>
          <p className="mt-3">
            Wersja testowa może mieć błędy i zmieniać się z dnia na dzień, a dane wprowadzone
            w czasie testów mogą zostać przed otwarciem poprawione albo usunięte. Do dnia otwarcia
            prosimy nie pokazywać jej zawartości, zrzutów ekranu ani dostępu osobom spoza testów.
            Po zalogowaniu tester widzi pod tym samym adresem pełny regulamin serwisu, który
            obowiązuje go w czasie testów.
          </p>
        </Punkt>

        <Punkt nr={4} title="Zasady korzystania">
          <p>Nie wolno:</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>· obchodzić zabezpieczeń strony ani próbować wejść do wersji testowej bez zaproszenia,</li>
            <li>· zapisywać na listę cudzych adresów e-mail,</li>
            <li>· zalewać strony żądaniami ani zbierać z niej danych w sposób automatyczny.</li>
          </ul>
          <p className="mt-3">
            Za złamanie tych zasad możemy zablokować dostęp do strony, także dla adresu IP.
          </p>
        </Punkt>

        <Punkt nr={5} title="Odpowiedzialność i dostępność">
          <p>
            Serwis prowadzi jedna osoba w wolnym czasie. Nie gwarantujemy terminu otwarcia ani
            nieprzerwanej dostępności strony przed nim.
          </p>
        </Punkt>

        <Punkt nr={6} title="Kontakt">
          <p>
            W każdej sprawie pisz na <Mail />.
          </p>
        </Punkt>

        <Punkt nr={7} title="Zmiany regulaminu">
          <p>
            W dniu otwarcia ten regulamin zastąpi pełna wersja, opisująca serwis i zasady
            korzystania z niego - pod tym samym adresem. Wcześniejsze zmiany oznaczymy nową datą
            na górze strony.
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
    </RamaPrzed>
  );
}
