import { getSessionUser } from "@/lib/supabase/server";

/**
 * Stan konfiguracji serwisu - dla administratora, w kokpicie.
 *
 * Powstało z konkretnej lekcji: najgorsze awarie tego projektu nie polegały na tym, że coś
 * rzucało błędem, tylko że coś po cichu nie działało. Brak `FEEDBACK_FROM` nie wywala
 * niczego - po prostu maile powitalne nie docierają. Brak `NEXT_PUBLIC_CARTO_KEY` nie
 * wywala mapy - po prostu mapa wygląda inaczej. O jednym i drugim człowiek dowiaduje się
 * przypadkiem, po tygodniach.
 *
 * Ta trasa nie oddaje ŻADNYCH wartości - wyłącznie informację, czy zmienna jest ustawiona.
 * Dzięki temu nawet gdyby kiedyś wyciekła, nie ma z niej czego wyciągnąć.
 */
export const dynamic = "force-dynamic";

interface Pozycja {
  klucz: string;
  ustawione: boolean;
  /** waga: „krytyczne" psuje serwis, „wazne" psuje po cichu, „opcjonalne" to dodatek */
  waga: "krytyczne" | "wazne" | "opcjonalne";
  /** co konkretnie nie działa bez tego */
  skutek: string;
}

const jest = (v?: string) => Boolean(v && v.trim());

export async function GET() {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return Response.json({ blad: "tylko administrator" }, { status: 403 });
  }

  const pozycje: Pozycja[] = [
    {
      klucz: "NEXT_PUBLIC_SUPABASE_URL",
      ustawione: jest(process.env.NEXT_PUBLIC_SUPABASE_URL),
      waga: "krytyczne",
      skutek: "Bez tego nie działa baza, logowanie ani zdjęcia.",
    },
    {
      klucz: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ustawione: jest(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      waga: "krytyczne",
      skutek: "Bez tego nie działa baza, logowanie ani zdjęcia.",
    },
    {
      klucz: "RESEND_API_KEY",
      ustawione: jest(process.env.RESEND_API_KEY),
      waga: "wazne",
      skutek: "Bez tego nie wychodzi żaden mail.",
    },
    {
      klucz: "FEEDBACK_FROM",
      ustawione: jest(process.env.FEEDBACK_FROM),
      waga: "wazne",
      skutek:
        "Bez tego listy do użytkowników nie są wysyłane - adres testowy Resend pisze " +
        "tylko do właściciela konta.",
    },
    {
      klucz: "FEEDBACK_TO",
      ustawione: jest(process.env.FEEDBACK_TO),
      waga: "opcjonalne",
      skutek: "Bez tego opinie zostają w panelu, ale nie przychodzą mailem.",
    },
    {
      klucz: "NEXT_PUBLIC_CDN_OBRAZKI",
      ustawione: jest(process.env.NEXT_PUBLIC_CDN_OBRAZKI),
      waga: "opcjonalne",
      skutek:
        "Bez tego skalowanie zdjęć idzie przez Supabase: płatne od tysiąca obrazów " +
        "źródłowych miesięcznie i liczone do puli transferu. Z tym - przez Cloudflare, " +
        "gdzie transfer z brzegu jest darmowy.",
    },
    {
      klucz: "PODKOSZ_ZA_CLOUDFLARE",
      ustawione: jest(process.env.PODKOSZ_ZA_CLOUDFLARE),
      waga: "wazne",
      skutek:
        "Ustawiać WYŁĄCZNIE gdy domena idzie przez Cloudflare. Wtedy prawdziwy adres " +
        "odwiedzającego jest w nagłówku cf-connecting-ip; bez tego wszystkie limity " +
        "i blokady IP liczyłyby jeden adres Cloudflare dla wszystkich naraz. " +
        "Ustawione bez Cloudflare jest gorsze niż nieustawione - adres da się podrobić.",
    },
    {
      klucz: "NEXT_PUBLIC_CARTO_KEY",
      ustawione: jest(process.env.NEXT_PUBLIC_CARTO_KEY),
      waga: "opcjonalne",
      skutek: "Bez tego mapa jedzie na zapasowym podkładzie Esri.",
    },
    {
      klucz: "NEXT_PUBLIC_INSTAGRAM",
      ustawione: jest(process.env.NEXT_PUBLIC_INSTAGRAM),
      waga: "opcjonalne",
      skutek: "Bez tego Google nie wiąże strony z profilem na Instagramie.",
    },
    {
      klucz: "CRON_SECRET",
      ustawione: jest(process.env.CRON_SECRET),
      waga: "opcjonalne",
      skutek: "Bez tego zadanie utrzymaniowe działa, ale jest otwarte dla każdego.",
    },
  ];

  return Response.json(
    {
      pozycje,
      zaslona: process.env.PODKOSZ_OTWARTA !== "1",
      srodowisko: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "nieznane",
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
