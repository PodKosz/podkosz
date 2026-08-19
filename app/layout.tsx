import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { VisitPing } from "@/components/VisitPing";
import { SiteFooter } from "@/components/SiteFooter";
import { getSessionUser } from "@/lib/supabase/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html lang="pl">
      <body className="ambient antialiased">
        <TopNav
          user={user ? { name: user.name, avatar: user.avatar, isAdmin: user.isAdmin } : null}
        />
        <div className="relative z-10">{children}</div>
        <SiteFooter />
        <VisitPing />
      </body>
    </html>
  );
}
