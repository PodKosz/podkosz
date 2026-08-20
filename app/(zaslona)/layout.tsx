import type { Metadata } from "next";
import "../globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Osobny układ główny dla zasłony przed premierą.
 *
 * Serwis i zasłona to dwie odrębne grupy tras z własnymi układami (`app/(strona)`
 * i `app/(zaslona)`), więc zasłona nie ciągnie za sobą nawigacji, stopki ani licznika
 * wizyt - i, co ważniejsze, układ serwisu nie musi wiedzieć, jaki adres obsługuje.
 * Dopóki sprawdzał to nagłówkiem, każda podstrona była renderowana na żądanie.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  robots: { index: false, follow: false },
};

export default function ZaslonaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className="ambient antialiased">{children}</body>
    </html>
  );
}
