"use client";

import { useEffect } from "react";

/**
 * Pojawianie się elementów podstron - rankingów, graczy, „O nas" i profilu.
 *
 * Element z atrybutem `data-wjazd` czeka niewidoczny, aż wejdzie w kadr, i wtedy odgrywa
 * swoje wejście. To, co widać od razu po otwarciu strony, wchodzi przy otwarciu; reszta -
 * w chwili, gdy dojedzie do niej przewijanie. Wartość atrybutu to nazwa ruchu, a każda
 * podstrona ma własny zestaw (patrz „pojawianie się elementów" w globals.css), więc ten
 * sam mechanizm daje cztery różne charaktery.
 *
 * Wcześniej rankingi wjeżdżały animacją sterowaną przewijaniem (`view()`). Miała jedną
 * wadę nie do obejścia: elementy widoczne od początku były już „za swoim przedziałem",
 * więc stały od razu gotowe i najważniejsza część strony - podium - nie miała wejścia.
 *
 * Elementy wchodzące naraz dostają rosnące opóźnienie w kolejności dokumentu: nagłówek
 * układa się linijka po linijce, a rząd kart od lewej do prawej, zamiast wszystkiego
 * jednym błyskiem.
 */

/** odstęp między kolejnymi elementami jednej fali */
const KROK_MS = 75;
/** więcej kroków nie ma sensu - dwunasty element czekałby prawie sekundę */
const NAJWIECEJ_KROKOW = 10;

export function Wjazdy() {
  useEffect(() => {
    const html = document.documentElement;
    /*
      Ukrywanie przed wejściem włącza skrypt w <head> (klasa `wjazdy`), jeszcze zanim
      przeglądarka narysuje treść - inaczej elementy mignęłyby raz w stanie końcowym.
      Ta klasa mówi arkuszowi, że mechanizm naprawdę działa; bez niej, po kilku sekundach,
      arkusz odsłania wszystko sam. Gdyby ten skrypt nie dojechał, strona nie może zostać pusta.
    */
    html.classList.add("wjazdy-zywe");

    const elementy = Array.from(document.querySelectorAll<HTMLElement>("[data-wjazd]"));

    // bez ruchu na życzenie systemu: od razu stan końcowy
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of elementy) el.classList.add("widac");
      return () => html.classList.remove("wjazdy-zywe");
    }

    const obserwator = new IntersectionObserver(
      (wpisy) => {
        const wchodzi = wpisy
          .filter((w) => w.isIntersecting)
          .map((w) => w.target as HTMLElement)
          .sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
          );
        wchodzi.forEach((el, i) => {
          el.style.setProperty("--wj-op", `${Math.min(i, NAJWIECEJ_KROKOW) * KROK_MS}ms`);
          el.classList.add("widac");
          obserwator.unobserve(el);
        });
      },
      // odrobinę nad dolną krawędzią, żeby element wchodził, kiedy już na niego patrzysz
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    for (const el of elementy) obserwator.observe(el);

    return () => {
      obserwator.disconnect();
      html.classList.remove("wjazdy-zywe");
    };
  }, []);

  return null;
}
