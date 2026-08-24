/**
 * Ikony odznaczeń - jedna na każdą czynność.
 *
 * Wszystkie odznaczenia miały wcześniej ten sam płomyk, więc mini-plakietka pod avatarem
 * w rankingu nie mówiła nic poza „coś tam zdobył". Teraz kształt mówi, ZA CO jest odznaka,
 * a kolor medalu (tło i obwódka) - na jakim jest stopniu.
 *
 * Rysunek jest zawsze w `currentColor`, więc barwę nadaje klasa medalu. Kreski są włosowe
 * i bez wypełnień - to ta sama kreska co w konturze boiska i koszu w tle.
 */

const WSPOLNE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Ścieżki ikon: klucz to identyfikator odznaczenia z lib/odznaczenia. */
const IKONY: Record<string, React.ReactNode> = {
  /* pinezka - dodane boiska */
  odkrywca: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),

  /*
    Płomień z językiem w środku - bez niego sam obrys czytał się jak kropla wody, zwłaszcza
    przy 17 pikselach na mini-plakietce.
  */
  podpalacz: (
    <>
      <path d="M12.4 2.6c.5 2.4-.8 3.7-2.2 5-1.8 1.7-2.8 3.2-2.5 5.1.1 1 .7 1.8.7 1.8s-1.7-.4-2.5-1.9c-.8 1.4-1.1 2.9-1.1 4.1 0 2.9 2.6 4.9 7.2 4.9 4.3 0 7.2-2.1 7.2-5.2 0-4.5-3.4-6.6-4.8-9.2-.8-1.5-1.1-3.2-2-4.6Z" />
      <path d="M12 12.6c.9 1 1.3 1.9 1.3 2.9 0 1.4-1 2.4-2.2 2.4-1 0-1.9-.7-1.9-1.8 0-1.3 1.4-2 2.8-3.5Z" />
    </>
  ),

  /* serce - ulubione */
  kolekcjoner: (
    <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6c0 5-7.5 9.4-7.5 9.4Z" />
  ),

  /* zegar - godziny na boisku */
  bywalec: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.4 2" />
    </>
  ),

  /* kalendarz - różne dni z grą */
  regularny: (
    <>
      <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.4" />
      <path d="M3.6 10.2h16.8M8.4 3.6v3.4M15.6 3.6v3.4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.4h.01M12 17.4h.01" />
    </>
  ),

  /* gwiazda - uznanie innych, czyli zebrane podpalenia */
  gospodarz: (
    <path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.8L12 3.4Z" />
  ),

  /* kompas - miejscowości */
  podroznik: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M15.4 8.6l-2 4.8-4.8 2 2-4.8 4.8-2Z" />
    </>
  ),

  /* złożona mapa - województwa */
  kartograf: (
    <>
      <path d="M3.4 6.6l5.6-2 6 2 5.6-2v13l-5.6 2-6-2-5.6 2v-13Z" />
      <path d="M9 4.6v13M15 6.6v13" />
    </>
  ),

  /* aparat - zdjęcia w bazie */
  fotograf: (
    <>
      <path d="M3.6 8.6h3.2l1.6-2.4h7.2l1.6 2.4h3.2v10.2H3.6V8.6Z" />
      <circle cx="12" cy="13.6" r="3.2" />
    </>
  ),

  /* flaga - pionier */
  pionier: (
    <>
      <path d="M6.4 21V3.6" />
      <path d="M6.4 4.4c4-1.6 7.6 1.6 11.2 0v7.4c-3.6 1.6-7.2-1.6-11.2 0V4.4Z" />
    </>
  ),

  /* księżyc - nocny marek */
  "nocny-marek": (
    <path d="M19.4 14.6A8 8 0 0 1 9.4 4.6a8.4 8.4 0 1 0 10 10Z" />
  ),

  /* wschód słońca - ranny ptaszek */
  "ranny-ptaszek": (
    <>
      <path d="M3.4 17.4h17.2" />
      <path d="M6.6 17.4a5.4 5.4 0 0 1 10.8 0" />
      <path d="M12 4.4v2.4M4.8 8l1.7 1.7M19.2 8l-1.7 1.7" />
    </>
  ),

  /* miasto z gwiazdą - pierwsze boisko w miejscowości */
  "pierwszy-w-miescie": (
    <>
      <path d="M3.6 20.4h16.8" />
      <path d="M5.6 20.4v-7.8h4.2v7.8M13.4 20.4V9.4h5v11" />
      <path d="M15.9 3.2l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9Z" />
    </>
  ),

  /* maszt z reflektorem - boisko z oświetleniem */
  oswietlone: (
    <>
      <path d="M6.2 4.2h11.6l-1.4 4.6H7.6L6.2 4.2Z" />
      <path d="M12 8.8V21M9 21h6" />
      <path d="M8.6 11.6l-2 2.4M15.4 11.6l2 2.4M12 11.8v2.6" />
    </>
  ),

  /* tarcza z ptaszkiem - plakietka twórcy */
  approved: (
    <>
      <path d="M12 3.2l7 2.6v5.6c0 4.2-2.9 7.4-7 9.4-4.1-2-7-5.2-7-9.4V5.8l7-2.6Z" />
      <path d="M8.8 11.8l2.4 2.4 4-4.4" />
    </>
  ),

  /* uśmiech - „śmieszne boisko" */
  smieszne: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.2 9.6h.01M14.8 9.6h.01" />
      <path d="M8.4 14c1.6 1.8 5.8 1.8 7.2-.4" />
    </>
  ),

  /* sześć kadrów - komplet zdjęć boiska */
  komplet: (
    <>
      <rect x="3.4" y="4.6" width="5.6" height="5.6" rx="1.2" />
      <rect x="10.2" y="4.6" width="5.6" height="5.6" rx="1.2" />
      <rect x="17" y="4.6" width="3.6" height="5.6" rx="1.2" />
      <rect x="3.4" y="13.8" width="5.6" height="5.6" rx="1.2" />
      <rect x="10.2" y="13.8" width="5.6" height="5.6" rx="1.2" />
      <rect x="17" y="13.8" width="3.6" height="5.6" rx="1.2" />
    </>
  ),

  /* warstwy przekroju - różne nawierzchnie */
  nawierzchnie: (
    <>
      <path d="M12 3.2l8.4 4-8.4 4-8.4-4 8.4-4Z" />
      <path d="M3.6 11.6l8.4 4 8.4-4" />
      <path d="M3.6 16.2l8.4 4 8.4-4" />
    </>
  ),

  /* trzy bryły - otwarte, kryte, streetball */
  typy: (
    <>
      <rect x="2.6" y="13" width="7" height="7" rx="1.4" />
      <path d="M13 20v-4.6l3.8-3 3.8 3V20h-7.6Z" />
      <circle cx="8.4" cy="6.6" r="3.6" />
      <path d="M4.8 6.6h7.2M8.4 3v7.2" />
    </>
  ),

  /* słońce i księżyc - gra od świtu do nocy */
  "swit-i-noc": (
    <>
      <path d="M2.6 18.6h8.8" />
      <path d="M4.4 18.6a3.4 3.4 0 0 1 6.6-1" />
      <path d="M7.4 8.8v1.8M3.6 12.2l1.3 1.3M11.6 12.2l-1.3 1.3" />
      <path d="M20.6 12.4A5.6 5.6 0 0 1 14 5.8a6 6 0 1 0 6.6 6.6Z" />
    </>
  ),

  /* kalendarz z zakreślonym weekendem */
  weekend: (
    <>
      <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.4" />
      <path d="M3.6 10.2h16.8M8.4 3.6v3.4M15.6 3.6v3.4" />
      <rect x="14.2" y="12.6" width="4.6" height="5.2" rx="1.2" fill="currentColor" stroke="none" opacity=".55" />
    </>
  ),

  /* klepsydra - sześć godzin w jednym dniu */
  maraton: (
    <>
      <path d="M6.6 3.4h10.8M6.6 20.6h10.8" />
      <path d="M8 3.4v3.2c0 2.2 4 3.6 4 5.4 0 1.8-4 3.2-4 5.4v3.2" />
      <path d="M16 3.4v3.2c0 2.2-4 3.6-4 5.4 0 1.8 4 3.2 4 5.4v3.2" />
    </>
  ),

  /* ogniwa łańcucha - seria dni pod rząd */
  "seria-tygodnia": (
    <>
      <rect x="2.6" y="8.6" width="10" height="6.8" rx="3.4" />
      <rect x="11.4" y="8.6" width="10" height="6.8" rx="3.4" />
      <path d="M9.6 12h4.8" />
    </>
  ),

  /* śnieżynka - gra zimą */
  zima: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M9.6 5.4L12 7.8l2.4-2.4M9.6 18.6L12 16.2l2.4 2.4" />
      <path d="M4.6 11.1l.4-2.7 2.7.4M19.4 12.9l-.4 2.7-2.7-.4" />
      <path d="M7.7 15.2l-2.7.4-.4-2.7M16.3 8.8l2.7-.4.4 2.7" />
    </>
  ),

  /* szesnaście kropek - jedna na województwo */
  "pelna-mapa": (
    <>
      {[6.6, 10.4, 14.2, 18].map((y) =>
        [6.6, 10.4, 14.2, 18].map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.05" fill="currentColor" stroke="none" />
        ))
      )}
    </>
  ),
};

export function IkonaOdznaczenia({ id, className = "" }: { id: string; className?: string }) {
  const rysunek = IKONY[id];

  /* nieznany identyfikator nie może wywalić strony - zostaje neutralne kółko */
  return (
    <svg {...WSPOLNE} className={className || "h-6 w-6"}>
      {rysunek ?? <circle cx="12" cy="12" r="7.6" />}
    </svg>
  );
}
