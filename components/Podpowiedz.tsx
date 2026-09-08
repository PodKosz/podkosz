"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Podpowiedź po najechaniu - własna, nie ta z przeglądarki.
 *
 * Atrybut `title` daje szarą chmurkę systemową: pojawia się z sekundowym opóźnieniem,
 * ma czcionkę systemu, kanciasty narożnik i wygląda jak wyrwana z innej strony. Nie da się
 * jej ostylować w żaden sposób - jedyne wyjście to nie używać `title` i narysować własną.
 *
 * ------------------------------------------------------------------ dlaczego portal
 *
 * Chmurka ląduje w `document.body`, a nie obok plakietki. Plakietki stoją w kartach boisk,
 * w wierszach rankingu i w wizytówce nad pinezką - a te mają `overflow: hidden` (zaokrąglone
 * narożniki), `backdrop-filter` (szkło) i `scale` przy najechaniu. Każde z tych trzech
 * przycięłoby chmurkę albo przesunęło ją razem z kartą; `position: fixed` też nie pomaga,
 * bo transformacja i filtr na przodku tworzą dla niej nowy blok odniesienia. Portal wynosi
 * ją poza to wszystko.
 *
 * Pozycję liczymy z `getBoundingClientRect()` kotwicy w chwili najechania i przycinamy
 * do ekranu po zmierzeniu chmurki - plakietka przy prawej krawędzi listy inaczej
 * wypchnęłaby napis za widok.
 *
 * ------------------------------------------------------------------ dotyk
 *
 * `pointerenter` przychodzi także z palca, więc na telefonie chmurka pojawiałaby się po
 * dotknięciu i zostawała na ekranie do następnego dotknięcia gdzie indziej. Dlatego
 * reagujemy tylko na mysz i rysik. Na telefonie plakietka nie ma podpowiedzi i nie musi
 * mieć - jest tam sama ikona bez napisu, a jej znaczenie tłumaczy karta boiska.
 */
export function Podpowiedz({
  tekst,
  className = "",
  children,
}: {
  tekst: string;
  /** klasy układu dla kotwicy - marginesy, `shrink` w wierszu z innymi plakietkami */
  className?: string;
  children: React.ReactNode;
}) {
  const kotwica = useRef<HTMLSpanElement>(null);
  const chmurka = useRef<HTMLSpanElement>(null);
  const [gdzie, setGdzie] = useState<{ x: number; y: number } | null>(null);

  const ukryj = useCallback(() => setGdzie(null), []);

  const pokaz = useCallback((e: React.PointerEvent | React.FocusEvent) => {
    if ("pointerType" in e && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const r = kotwica.current?.getBoundingClientRect();
    if (r) setGdzie({ x: r.left + r.width / 2, y: r.top });
  }, []);

  /* Przycięcie do ekranu - dopiero tutaj, bo szerokość chmurki znamy po jej narysowaniu. */
  useLayoutEffect(() => {
    const el = chmurka.current;
    if (!gdzie || !el) return;
    const r = el.getBoundingClientRect();
    const margines = 10;
    const poza = Math.max(0, margines - r.left) - Math.max(0, r.right - (window.innerWidth - margines));
    if (poza !== 0) el.style.setProperty("--przesuniecie", `${poza}px`);
  }, [gdzie]);

  /*
    Przewinięcie i zmiana rozmiaru okna zostawiłyby chmurkę w starym miejscu, bo jej
    pozycja jest policzona raz. Zamiast przeliczać ją w kółko - gasimy: kursor i tak
    zjeżdża wtedy z plakietki.
  */
  useEffect(() => {
    if (!gdzie) return;
    window.addEventListener("scroll", ukryj, true);
    window.addEventListener("resize", ukryj);
    return () => {
      window.removeEventListener("scroll", ukryj, true);
      window.removeEventListener("resize", ukryj);
    };
  }, [gdzie, ukryj]);

  return (
    <span
      ref={kotwica}
      className={`inline-flex shrink-0 ${className}`}
      onPointerEnter={pokaz}
      onPointerLeave={ukryj}
      onFocus={pokaz}
      onBlur={ukryj}
    >
      {children}
      {gdzie !== null &&
        createPortal(
          <span
            ref={chmurka}
            role="tooltip"
            className="podpowiedz"
            style={{ left: gdzie.x, top: gdzie.y }}
          >
            {tekst}
          </span>,
          document.body
        )}
    </span>
  );
}
