import type { Metadata } from "next";
import "../globals.css";
import { TopNav } from "@/components/TopNav";
import { VisitPing } from "@/components/VisitPing";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";
import { SKRYPT_MOTYWU } from "@/lib/motyw";

const TITLE = "PodKosz - baza boisk do koszykówki w Polsce";

export const metadata: Metadata = {
  // metadataBase sprawia, że wszystkie względne adresy w metadanych (obrazki, kanoniczne)
  // wychodzą jako pełne URL-e - bez tego serwisy społecznościowe nie pobiorą podglądu.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SITE_DESCRIPTION },
  // przed premierą nic nie ma trafić do wyszukiwarek
  ...(ZASLONA ? { robots: { index: false, follow: false } } : {}),
};

/**
 * Układ serwisu.
 *
 * Świadomie nie czyta tu nic z ciasteczek ani nagłówków: gdyby czytał, każda podstrona
 * musiałaby być renderowana na żądanie. Kto jest zalogowany, dociąga sobie sam pasek
 * nawigacji (po stronie przeglądarki, z `/api/sesja`), dzięki czemu strony bez treści
 * zależnej od użytkownika mogą się cache'ować.
 */
export default function StronaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      `suppressHydrationWarning` dotyczy jednej rzeczy: atrybutu `data-motyw`, który skrypt
      niżej dopisuje jeszcze przed hydracją. Serwer nie zna wyboru urządzenia, więc React
      widzi element z atrybutem, którego sam nie wygenerował, i zgłasza rozbieżność - mimo
      że to my go tam położyliśmy i ma tam zostać. Tłumienie jest płytkie: obejmuje sam
      element `html`, nie jego drzewo, więc prawdziwe rozjazdy w treści dalej się zgłoszą.
    */
    <html lang="pl" suppressHydrationWarning>
      <body className="ambient antialiased">
        {/*
          Motyw nadajemy przed treścią, w trakcie parsowania dokumentu. Wczytany razem
          z resztą JavaScriptu przestawiałby barwy dopiero po pierwszej klatce, a to przy
          ciemnym tle widać jak mrugnięcie.
        */}
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }} />
        <TopNav />
        <div className="relative z-10">{children}</div>
        <SiteFooter />
        <VisitPing />
      </body>
    </html>
  );
}
