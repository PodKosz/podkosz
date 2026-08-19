import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { VisitPing } from "@/components/VisitPing";
import { SiteFooter } from "@/components/SiteFooter";
import { getSessionUser } from "@/lib/supabase/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { SCIEZKA_ZASLONY, ZASLONA } from "@/lib/zaslona";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
    Na stronie zasłony („Już niedługo") nie pokazujemy nawigacji ani stopki - nic nie ma
    prowadzić dalej. Ścieżkę podaje middleware nagłówkiem, bo układ jej sam nie widzi.
  */
  const naZaslonie = (await headers()).get("x-sciezka") === SCIEZKA_ZASLONY;
  const user = naZaslonie ? null : await getSessionUser();

  return (
    <html lang="pl">
      <body className="ambient antialiased">
        {!naZaslonie && (
          <TopNav
            user={user ? { name: user.name, avatar: user.avatar, isAdmin: user.isAdmin } : null}
          />
        )}
        <div className="relative z-10">{children}</div>
        {!naZaslonie && (
          <>
            <SiteFooter />
            <VisitPing />
          </>
        )}
      </body>
    </html>
  );
}
