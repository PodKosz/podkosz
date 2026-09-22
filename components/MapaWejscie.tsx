"use client";

import { useEffect, useRef, useState } from "react";
import { CourtOutline } from "./CourtOutline";

/**
 * Wejście mapy - kurtyna, która schodzi dopiero, gdy mapa ma czym się pokazać.
 *
 * Bez niej mapa wstawała na raty: podkład to kafelki rastrowe, więc najpierw było czarne
 * pole, potem wskakiwały po kolei kwadraty, a pinezki wisiały nad pustką, zanim pojawił
 * się pod nimi kraj. Technicznie wszystko działało, ale wyglądało jak awaria.
 *
 * Teraz przez cały czas ładowania stoi żar i rysujący się kontur boiska, a gdy MapLibre
 * zgłosi, że ma KOMPLET kafelków kadru (`idle` + `areTilesLoaded`), kurtyna rozstępuje się
 * od środka pierścieniem światła i odsłania gotowy obraz. Kwadratów nie widać nigdy.
 *
 * Kurtyna mieszka tutaj, a nie w MapView, bo MapLibre to najcięższa paczka serwisu
 * i przychodzi z opóźnieniem. Gdyby kurtyna była częścią mapy, przez pierwsze pół sekundy
 * stałby inny szkielet i obraz przeskoczyłby w połowie ładowania. Ta stoi od pierwszej
 * klatki strony i ciągnie jedną animację aż do odsłonięcia.
 */

/*
  Pełne wejście tylko raz na sesję. Powrót z karty boiska ma kafelki w pamięci podręcznej
  i mapa jest gotowa po ułamku sekundy - odgrywanie wtedy całego spektaklu byłoby karą
  za kliknięcie w boisko. Kolejne wejścia dostają samo krótkie odsłonięcie.
*/
const KLUCZ = "podkosz:mapa-wejscie";

export function MapaWejscie({ gotowa }: { gotowa: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [koniec, setKoniec] = useState(false);

  /*
    Odczyt w efekcie, nie w stanie początkowym - strona renderuje się też na serwerze,
    a tam pamięci sesji nie ma, więc klasa rozjechałaby się przy hydratacji. Znacznik kładziemy
    wprost na węźle, a nie przez stan: to jednorazowe ustawienie, a stan zmieniany w efekcie
    oznaczałby drugi render całej kurtyny tylko po to, żeby dopisać jedno słowo.
  */
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KLUCZ)) {
        // atrybut, nie klasa: React przepisuje `className` przy każdej zmianie `gotowa`
        // i zgubiłby dopisane słowo, a atrybutów spoza swoich właściwości nie rusza
        if (ref.current) ref.current.dataset.krotko = "";
      }
    } catch {
      /* prywatne okno bez pamięci - zostaje pełne wejście */
    }
  }, []);

  /* Znacznik stawiamy dopiero przy odsłonięciu, a nie przy montowaniu: tryb ścisły Reacta
     montuje komponent dwa razy i drugi raz zobaczyłby znacznik po pierwszym. */
  useEffect(() => {
    if (!gotowa) return;
    try {
      sessionStorage.setItem(KLUCZ, "1");
    } catch {
      /* bez pamięci po prostu następnym razem też będzie pełne wejście */
    }
  }, [gotowa]);

  if (koniec) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className={`mapa-wejscie${gotowa ? " odslania" : ""}`}
      onAnimationEnd={(e) => {
        // zdarzenia z animacji dzieci też tu bąbelkują - kończy nas tylko własna
        if (e.target === e.currentTarget) setKoniec(true);
      }}
    >
      <div className="mapa-wejscie-kurtyna">
        <span className="mapa-wejscie-luna" />
        <div className="mapa-wejscie-kontur">
          <CourtOutline uid="mapa-wejscie" />
        </div>
      </div>
      <span className="mapa-wejscie-brzeg" />
    </div>
  );
}
