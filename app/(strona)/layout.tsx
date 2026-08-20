import type { Metadata } from "next";
import "../globals.css";
import { TopNav } from "@/components/TopNav";
import { VisitPing } from "@/components/VisitPing";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { ZASLONA } from "@/lib/zaslona";

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
    <html lang="pl">
      <body className="ambient antialiased">
        <TopNav />
        <div className="relative z-10">{children}</div>
        <SiteFooter />
        <VisitPing />
      </body>
    </html>
  );
}
