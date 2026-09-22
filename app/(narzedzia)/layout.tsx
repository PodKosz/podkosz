import "../globals.css";

/**
 * Układ stron narzędziowych - tylko dla skryptów w `scripts/`, nigdy dla ludzi.
 *
 * Osobna grupa, bo taka strona nie może mieć paska nawigacji, stopki ani bramki logowania
 * z układu serwisu: skrypt robi zrzut ekranu i wszystko poza samą mapą byłoby na nim śmieciem.
 * Arkusz jest ten sam co w serwisie, bo z niego mapa czyta barwy motywu.
 */
export default function NarzedziaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body style={{ margin: 0, background: "transparent" }}>{children}</body>
    </html>
  );
}
