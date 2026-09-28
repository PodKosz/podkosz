import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Wypis z powiadomień - ${SITE_NAME}`,
  robots: { index: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strona z linku w stopce listu o wydarzeniu.
 *
 * Samo wejście NIC nie zmienia - wypis robi dopiero przycisk (POST do `/api/wypisz`).
 * Linki w listach otwierają też skanery poczty, więc strona, która wypisuje od wejścia,
 * wypisywałaby ludzi, którzy nawet nie przeczytali listu.
 */
export default async function WypiszPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const t = typeof p.t === "string" ? p.t.trim() : "";
  const wynik = typeof p.wynik === "string" ? p.wynik : "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 pb-24 pt-28">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Powiadomienia</p>

      {wynik === "ok" ? (
        <>
          <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.02em]">
            Wypisano
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Nie dostaniesz już od nas maili o wydarzeniach na boiskach. Jeśli zmienisz zdanie,
            włączysz je z powrotem w{" "}
            <Link href="/konto/ustawienia" className="text-flame">
              ustawieniach konta
            </Link>
            .
          </p>
        </>
      ) : wynik === "blad" || (t && !UUID.test(t)) ? (
        <>
          <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.02em]">
            Ten link nie działa
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Może został ucięty przy kopiowaniu. Powiadomienia wyłączysz też sam w{" "}
            <Link href="/konto/ustawienia" className="text-flame">
              ustawieniach konta
            </Link>{" "}
            albo pisząc do nas - adres jest w{" "}
            <Link href="/prywatnosc" className="text-flame">
              polityce prywatności
            </Link>
            .
          </p>
        </>
      ) : t ? (
        <>
          <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.02em]">
            Wypisać Cię z maili o wydarzeniach?
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            To jedyne listy, które wysyłamy bez Twojej prośby - o wydarzeniach na boiskach,
            które podpaliłeś albo na których zapisałeś się na grę, i w ich okolicy. Po wypisaniu
            nie przyjdzie żaden kolejny.
          </p>
          <form method="post" action={`/api/wypisz?t=${encodeURIComponent(t)}&z=strona`} className="mt-8">
            <button
              type="submit"
              className="rounded-2xl flame-gradient px-6 py-3 text-[14px] font-bold text-black transition hover:brightness-110"
            >
              Wypisz mnie
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.02em]">
            Wypis z powiadomień
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Link do wypisania jest w stopce każdego maila o wydarzeniu. Możesz też wyłączyć
            powiadomienia w{" "}
            <Link href="/konto/ustawienia" className="text-flame">
              ustawieniach konta
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
