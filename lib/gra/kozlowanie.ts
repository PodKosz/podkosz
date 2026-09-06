/**
 * Zasady minigry „kozły" - bez ani jednego odwołania do przeglądarki.
 *
 * Zadanie: jak najwięcej kozłowań w minutę. Kliknięcie W DOWOLNYM MIEJSCU EKRANU to jedno
 * kozłowanie - zawsze, bez wyjątku. Piłka nie ma własnego rytmu, w który trzeba trafić;
 * to ONA idzie w rytm klikania.
 *
 * ------------------------------------------------------------------ dlaczego tak
 *
 * Poprzednia wersja liczyła uderzenie tylko wtedy, gdy piłka była w zasięgu ręki, i karała
 * pudła blokadą. Na papierze to była gra o rytm, w praktyce - o zgadywanie: przy chybionym
 * stuknięciu gra nie robiła nic widocznego, a każde kolejne nerwowe kliknięcie odnawiało
 * blokadę, więc im mocniej ktoś próbował, tym pewniej nic się nie działo. Mechanika, która
 * karze człowieka za to, że myśli, że jest zepsuta, jest zepsuta.
 *
 * Teraz nie ma czego chybić. Została jedna rzecz do zrobienia i ona zawsze działa.
 *
 * ------------------------------------------------------------------ rytm
 *
 * Wysokość kozła bierze się z ODSTĘPU MIĘDZY KLIKNIĘCIAMI. Piłka puszczona z wysokości `h`
 * wraca do góry po `(1+odbicie)*sqrt(2h/g)` - odwracamy to i liczymy `h` z rytmu, który
 * gracz właśnie narzucił. Kto klika wolno, kozłuje wysoko i leniwie; kto szybko - nisko
 * przy parkiecie, jak przy zwodzie. Rytm jest wygładzany, żeby jedno szarpnięcie nie
 * przestawiało wysokości o pół ekranu.
 *
 * Pchnięcie liczymy tak, żeby piłka doszła do parkietu z prędkością, po której odbicie
 * wyniesie ją dokładnie na tę wysokość. Dzięki temu obraz zgadza się z rytmem sam z siebie
 * i nigdy nie trzeba piłki nigdzie przestawiać.
 */

/* wysokość świata gry - szerokość dolicza się z proporcji okna */
export const WYS = 1000;

/** parkiet: wysokość linii podłogi w ułamku wysokości świata */
export const PODLOGA = 0.82;
export const PILKA_R = 34;

export const GRAWITACJA = 2600;
/** ile prędkości zostaje po odbiciu od parkietu */
export const ODBICIE = 0.62;

/** najkrótszy i najdłuższy rytm, jaki gra bierze pod uwagę (sekundy między kliknięciami) */
const RYTM_MIN = 0.16;
const RYTM_MAX = 1.1;
/** rytm przyjęty przy pierwszym kliknięciu, zanim jest co mierzyć */
const RYTM_START = 0.5;

/** najniższy i najwyższy kozioł - żeby piłka nie znikła w parkiecie ani nie wyszła za kadr */
const KOZIOL_MIN = 26;
const KOZIOL_MAX = WYS * PODLOGA * 0.62;

/** minimalne pchnięcie w dół - każde kliknięcie ma być widoczne, nawet gdy piłka jest wysoko */
const MIN_PCHNIECIE = 260;

export const CZAS_RUNDY = 60;

export interface StanKozlowania {
  /** środek piłki */
  y: number;
  vy: number;
  /** ile kozłowań, czyli ile kliknięć */
  ile: number;
  /** sekundy od startu rundy */
  czas: number;
  /** czas ostatniego kliknięcia - do animacji i do mierzenia rytmu */
  uderzenie: number;
  /** czas ostatniego kontaktu z parkietem - do zgniecenia piłki */
  kontakt: number;
  /** wygładzony odstęp między kliknięciami */
  rytm: number;
  /** wysokość, na jaką piłka wraca przy tym rytmie */
  wysokoscKozla: number;
  /** obrót piłki w radianach */
  obrot: number;
  obrotV: number;
}

export function nowaRunda(): StanKozlowania {
  const wysokosc = wysokoscZRytmu(RYTM_START);
  return {
    /* piłka czeka w powietrzu na pierwsze kliknięcie */
    y: WYS * PODLOGA - PILKA_R - wysokosc,
    vy: 0,
    ile: 0,
    czas: 0,
    uderzenie: -99,
    kontakt: -99,
    rytm: RYTM_START,
    wysokoscKozla: wysokosc,
    obrot: 0,
    obrotV: 0,
  };
}

/** Wysokość dolnej krawędzi piłki nad parkietem. */
export function wysokosc(s: StanKozlowania) {
  return WYS * PODLOGA - PILKA_R - s.y;
}

/**
 * Wysokość kozła dla danego rytmu.
 *
 * Odwrócony czas lotu: piłka puszczona z wysokości `h` wraca na górę po
 * `(1 + odbicie) * sqrt(2h/g)`, więc z zadanego okresu wychodzi
 * `h = g/2 * (okres / (1 + odbicie))^2`.
 */
export function wysokoscZRytmu(okres: number) {
  const t = Math.min(Math.max(okres, RYTM_MIN), RYTM_MAX);
  const h = (GRAWITACJA * (t / (1 + ODBICIE)) ** 2) / 2;
  return Math.min(Math.max(h, KOZIOL_MIN), KOZIOL_MAX);
}

/** Jeden krok: grawitacja, lot i odbicie od parkietu. */
export function krokKozlowania(s: StanKozlowania, dt: number) {
  s.czas += dt;
  s.vy += GRAWITACJA * dt;
  s.y += s.vy * dt;
  s.obrot += s.obrotV * dt;

  const dol = WYS * PODLOGA - PILKA_R;
  if (s.y >= dol) {
    s.y = dol;
    if (s.vy > 40) {
      s.vy = -s.vy * ODBICIE;
      s.kontakt = s.czas;
    } else {
      /* piłka doszła do parkietu i nie ma z czego się odbić - leży i czeka na kliknięcie */
      s.vy = 0;
      s.obrotV *= 0.9;
    }
  }
}

export interface WynikUderzenia {
  /** zawsze prawda - w tej grze nie da się chybić; zostaje dla czytelności wywołań */
  ok: boolean;
  /** wysokość, na jaką piłka pójdzie po tym kozłowaniu */
  wysokosc: number;
}

/**
 * Kliknięcie: jedno kozłowanie.
 *
 * Zawsze się liczy i zawsze coś widać - piłka dostaje pchnięcie w dół (albo podbicie
 * w górę, jeśli leży na parkiecie) dobrane tak, żeby wróciła na wysokość wynikającą
 * z rytmu klikania.
 */
export function uderz(s: StanKozlowania): WynikUderzenia {
  const odstep = s.ile > 0 ? s.czas - s.uderzenie : RYTM_START;
  /*
    Wygładzanie: nowy rytm w 55%, poprzedni w 45%. Bez tego jedno spóźnione kliknięcie
    wyrzucałoby piłkę pod sufit, a jedno za szybkie wbijało ją w parkiet - wysokość skakałaby
    przy każdym kozłowaniu i rysunek przestałby przypominać kozłowanie.
  */
  s.rytm = s.ile === 0 ? RYTM_START : s.rytm * 0.45 + Math.min(Math.max(odstep, RYTM_MIN), RYTM_MAX) * 0.55;
  s.wysokoscKozla = wysokoscZRytmu(s.rytm);

  s.ile += 1;
  s.uderzenie = s.czas;

  const h = wysokosc(s);
  const doParkietu = Math.sqrt(2 * GRAWITACJA * s.wysokoscKozla) / ODBICIE;

  if (h <= 8) {
    /* piłka leży albo jest tuż nad parkietem - nie ma jej czym pchać w dół, więc podbijamy */
    s.vy = -Math.sqrt(2 * GRAWITACJA * s.wysokoscKozla);
  } else {
    const potrzebne = doParkietu * doParkietu - 2 * GRAWITACJA * h;
    s.vy = Math.max(potrzebne > 0 ? Math.sqrt(potrzebne) : 0, MIN_PCHNIECIE);
  }

  /*
    Obrót idzie za pchnięciem i przy każdym kozłowaniu w drugą stronę - kozłująca piłka wraca
    do ręki obracając się z powrotem, a nie kręci się bez końca w jedną stronę. Szybki rytm
    znaczy mocniejszy obrót.
  */
  const zwinnosc = 1 - Math.min(s.rytm / RYTM_MAX, 1);
  s.obrotV = (s.obrotV > 0 ? -1 : 1) * (4 + 7 * zwinnosc);

  return { ok: true, wysokosc: s.wysokoscKozla };
}
