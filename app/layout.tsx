import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { VisitPing } from "@/components/VisitPing";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "PodKosz — baza boisk do koszykówki w Polsce",
  description:
    "Interaktywna mapa boisk do koszykówki w Polsce. Zdjęcia, nawierzchnia, liczba koszy i godziny dostępności — dodawane przez graczy.",
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
        <VisitPing />
      </body>
    </html>
  );
}
