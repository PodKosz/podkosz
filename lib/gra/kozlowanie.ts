/**
 * Zasady minigry „kozłowanie" - bez ani jednego odwołania do przeglądarki.
 *
 * Zadanie: jak najwięcej kozłowań w minutę. Piłka skacze sama, a stuknięcie w ekran liczy
 * się tylko wtedy, gdy dochodzi do ręki - czyli wysoko, blisko szczytu odbicia. Klikanie
 * na oślep nie daje nic, bo nie o to chodzi: to gra o rytm, nie o szybkość palca. Gdyby
 * liczyło każde kliknięcie, najlepszym graczem byłaby mysz z makrem.
 *
 * ------------------------------------------------------------------ pchnięcie
 *
 * Siły uderzenia gracz nie ustala. Przy stuknięciu liczymy ją tak, żeby piłka po odbiciu
 * od parkietu wróciła dokładnie do linii ręki - i to jest sedno tej mechaniki. Rytm sam
 * się utrzymuje, dopóki gracz trafia w moment, więc gra mierzy WYCZUCIE CZASU, a nie to,
 * jak mocno ktoś klika. Bez tego przeliczenia każde kozłowanie wychodziłoby na inną
 * wysokość, rytm rozjeżdżałby się po trzech uderzeniach i nie dałoby się go złapać.
 *
 * ------------------------------------------------------------------ podniesienie
 *
 * Piłka odbita od parkietu bez pomocy ręki wraca dużo niżej, niż z niej wyszła: po odbiciu
 * zostaje 62% prędkości, czyli 38% wysokości. Z linii ręki na 42% wysokości hali swobodne
 * odbicie wynosi ją na 16% - GŁĘBOKO POD ZASIĘGIEM RĘKI, i już nigdy sama do niej nie
 * wróci. Bez wyjścia awaryjnego jedno spudłowane stuknięcie kończyło rundę na dobre:
 * piłka dogasała na parkiecie, a każde następne kliknięcie było pudłem. Gra wyglądała jak
 * zepsuta, bo w praktyce była.
 *
 * Dlatego stuknięcie poza zasięgiem ręki nie jest karą samą w sobie - PODNOSI piłkę
 * z powrotem na linię ręki. Nie liczy się jako kozłowanie, zeruje serię i włącza karę,
 * ale rytm da się odzyskać. Kosztem jest czas: podniesienie wraca na linię po pół sekundy,
 * a przez pierwsze 0,35 s ręka nic nie łapie, więc kto wali bez rytmu, ten tylko bez
 * końca podnosi piłkę i nie zalicza ani jednego kozłowania.
 *
 * ------------------------------------------------------------------ jak się zaostrza
 *
 * Linia ręki opada wraz z liczbą kozłowań: z 42% wysokości nad parkietem do 18%. Niższe
 * kozłowanie znaczy krótszy lot, czyli szybszy rytm i węższe okno w czasie - ta sama
 * dokładność ręki jest przy setnym kozłowaniu trudniejsza niż przy pierwszym, choć zasada
 * nie zmienia się ani o jotę. Prawdziwe kozłowanie zaostrza się dokładnie tak samo.
 */

/* wysokość świata gry - szerokość dolicza się z proporcji okna */
export const WYS = 1000;

/** parkiet: wysokość linii podłogi w ułamku wysokości świata */
export const PODLOGA = 0.82;
export const PILKA_R = 34;

export const GRAWITACJA = 2600;
/** ile prędkości zostaje po odbiciu od parkietu */
export const ODBICIE = 0.62;

/** linia ręki przy pierwszym i przy setnym kozłowaniu (ułamek wysokości nad parkietem) */
const RECZNA_START = 0.42;
const RECZNA_KONIEC = 0.18;
const ROZPEDZANIE = 90;

/** jak blisko szczytu trzeba stuknąć, żeby uderzenie było „czyste" (w pikselach na sekundę) */
const CZYSTE_DO = 260;

/**
 * Ile czasu po spudłowanym stuknięciu ręka nie łapie piłki.
 *
 * To jedyna obrona przed młotkowaniem myszką i jest konieczna. Bez niej gra nagradzała
 * dokładnie to, czym nie miała być: symulowany gracz klikający co 80 ms zdobywał 159
 * kozłowań przy 562 pudłach, a gracz trafiający idealnie w rytm - 105. Pudło nic nie
 * kosztowało, więc opłacało się strzelać na oślep i czekać, aż piłka sama wejdzie w zasięg.
 *
 * Kara odnawia się przy każdym stuknięciu w czasie blokady. Kto wali bez opamiętania, nie
 * zalicza ani jednego kozłowania; kto pomylił rytm raz, czeka trzy dziesiąte sekundy.
 */
const KARA = 0.35;

export const CZAS_RUNDY = 60;

export interface StanKozlowania {
  /** środek piłki */
  y: number;
  vy: number;
  /** ile kozłowań zaliczonych */
  ile: number;
  /** ile pod rząd bez spudłowanego stuknięcia */
  seria: number;
  /** sekundy od startu rundy */
  czas: number;
  /** czas ostatniego zaliczonego uderzenia - do animacji */
  uderzenie: number;
  /** czas ostatniego kontaktu z parkietem - do animacji */
  kontakt: number;
  /** czas ostatniego pudła - do animacji */
  pudlo: number;
  /** do kiedy ręka nie łapie piłki po pudle */
  blokadaDo: number;
  /** obrót piłki w radianach */
  obrot: number;
  obrotV: number;
}

export function nowaRunda(): StanKozlowania {
  const podloga = WYS * PODLOGA;
  return {
    /* piłka startuje w ręce, żeby pierwsze uderzenie było możliwe od razu */
    y: podloga - PILKA_R - liniaReki(0),
    vy: 0,
    ile: 0,
    seria: 0,
    czas: 0,
    uderzenie: -99,
    kontakt: -99,
    pudlo: -99,
    blokadaDo: -99,
    obrot: 0,
    obrotV: 0,
  };
}

/** Wysokość linii ręki nad parkietem przy danej liczbie kozłowań. */
export function liniaReki(ile: number) {
  const t = Math.min(ile / ROZPEDZANIE, 1);
  const ulamek = RECZNA_START + (RECZNA_KONIEC - RECZNA_START) * t;
  return WYS * PODLOGA * ulamek;
}

/** Wysokość dolnej krawędzi piłki nad parkietem. */
export function wysokosc(s: StanKozlowania) {
  return WYS * PODLOGA - PILKA_R - s.y;
}

/** Czy piłka jest w zasięgu ręki - tylko wtedy stuknięcie się liczy. */
export function wRece(s: StanKozlowania) {
  return wysokosc(s) >= liniaReki(s.ile) * 0.85;
}

/** Czy ręka jest w tej chwili zablokowana po pudle. */
export function zablokowana(s: StanKozlowania) {
  return s.czas < s.blokadaDo;
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
      /* piłka doszła do parkietu i już nie ma z czego się odbić - leży */
      s.vy = 0;
      s.obrotV *= 0.9;
    }
  }
}

export interface WynikUderzenia {
  ok: boolean;
  /** 0-1: jak blisko szczytu odbicia padło uderzenie */
  jakosc: number;
  /** stuknięcie poza zasięgiem podniosło piłkę z powrotem na linię ręki */
  podniesienie: boolean;
}



/**
 * Stuknięcie w ekran.
 *
 * Zalicza się tylko wtedy, gdy piłka jest w zasięgu ręki. Pchnięcie liczymy z tego, jak
 * wysoko ma wrócić po odbiciu - patrz opis na górze pliku.
 */
export function uderz(s: StanKozlowania): WynikUderzenia {
  /* w czasie blokady stuknięcie tylko ją odnawia - patrz `KARA` */
  if (zablokowana(s)) {
    s.blokadaDo = s.czas + KARA;
    return { ok: false, jakosc: 0, podniesienie: false };
  }

  if (!wRece(s)) {
    s.seria = 0;
    s.pudlo = s.czas;
    s.blokadaDo = s.czas + KARA;

    /*
      Podniesienie: piłka jedzie W GÓRĘ, dokładnie na linię ręki - patrz opis na górze
      pliku. Nie liczymy tego jako kozłowania, ale i nie zostawiamy piłki na parkiecie,
      bo sama się z niego nie podniesie.

      W górę, a nie w dół z przeliczeniem przez odbicie: pchnięcie w dół z parkietu to
      2158 px/s, czyli błysk w jedną klatkę, i nie widać z niego nic. Uniesienie do ręki
      czyta się jak podniesienie piłki i trwa tyle, ile ma trwać - pół sekundy.
    */
    const brak = Math.max(0, liniaReki(s.ile) - wysokosc(s));
    s.vy = -Math.sqrt(2 * GRAWITACJA * brak);
    return { ok: false, jakosc: 0, podniesienie: true };
  }

  const jakosc = Math.max(0, 1 - Math.abs(s.vy) / CZYSTE_DO);

  s.ile += 1;
  s.seria += 1;
  s.uderzenie = s.czas;

  /*
    Prędkość pchnięcia w dół dobrana tak, żeby po odbiciu piłka wróciła na linię ręki.
    Z zachowania energii: żeby wznieść się na `h`, po odbiciu trzeba mieć `sqrt(2gh)`,
    a odbicie zabiera część prędkości - więc do parkieta trzeba dojechać z `v/ODBICIE`.
    Odejmujemy to, co i tak da grawitacja na drodze do parkietu.
  */
  const doceloweWzniesienie = liniaReki(s.ile);
  const poOdbiciu = Math.sqrt(2 * GRAWITACJA * doceloweWzniesienie);
  const przyParkiecie = poOdbiciu / ODBICIE;
  const droga = Math.max(0, WYS * PODLOGA - PILKA_R - s.y);
  const potrzebne = przyParkiecie * przyParkiecie - 2 * GRAWITACJA * droga;

  s.vy = potrzebne > 0 ? Math.sqrt(potrzebne) : 60;

  /*
    Obrót idzie za pchnięciem, ale w drugą stronę niż poprzednie - kozłująca piłka wraca do
    ręki obracając się z powrotem, a nie kręci się bez końca w jedną stronę.
  */
  s.obrotV = (s.obrotV > 0 ? -1 : 1) * (5 + jakosc * 5);

  return { ok: true, jakosc, podniesienie: false };
}
