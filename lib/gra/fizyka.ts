/**
 * Fizyka i zasady minigry „rzut do kosza" - bez ani jednego odwołania do przeglądarki.
 *
 * Wydzielone z komponentu z jednego powodu: w grze, w której wszystko zależy od wyczucia
 * lotu, „wygląda dobrze" nie jest sprawdzeniem. Tu da się policzyć, ile pikseli błędu
 * celowania jeszcze wpada, czy pełna moc nie wyrzuca piłki za kadr i czy martwa strefa
 * naprawdę odsiewa drgnięcia - a tego nie policzy się w komponencie, który do pierwszej
 * linijki potrzebuje kanwy i klatek animacji.
 *
 * Komponent (`components/gra/RzutDoKosza.tsx`) trzyma teraz tylko rysowanie i sterowanie.
 */

/* ---------------------------------------------------------------- świat */

/*
  Wysokość świata jest stała, szerokość dolicza się z proporcji okna. Wszystkie rozmiary
  wychodzą z wysokości, nie z szerokości - inaczej na telefonie obręcz byłaby wąska jak
  piłka, a na szerokim monitorze rozjechałaby się na pół ekranu.
*/
export const WYS = 1000;

/*
  Liczby poniżej nie są zgadnięte. Pierwsza wersja tej gry miała je „na oko" i wyszło
  z tego coś, w co nie dało się grać: przy skanie pięciu tysięcy celowań wpadało 0,4%,
  wyłącznie przy pełnej mocy i w oknie trzech stopni. Nie było tego jak zobaczyć na
  ekranie - w tym środowisku żadna karta przeglądarki nie tyka klatek animacji - więc
  fizyka wylądowała w osobnym pliku i przeszła dobór liczbowy.

  Kryteria doboru były trzy:

    ROZPIĘTOŚĆ MOCY  ile z zakresu przeciągnięcia w ogóle pozwala trafić. Jeśli trafia
                     tylko pełna moc, oś siły jest ozdobą, a przy samym ograniczeniu
                     odpowiedź na ruch ręki i tak się wypłaszcza.
    OKNO POZIOME     ile pikseli błędu celowania jeszcze wpada. To jedyna z tych liczb,
                     którą czuje ręka.
    APOGEUM          czy piłka zostaje w kadrze. Znikająca piłka nie mówi graczowi nic
                     o tym, co zrobił źle.

  Wybrany zestaw daje (mierzone, nie szacowane):

    na monitorze 16:9  trafia moc od 0,40 do 1,00 (rozpiętość 0,60), okno do 172 px
    na telefonie 9:19,5 trafia moc od 0,35 do 1,00 (rozpiętość 0,65), okno do 98 px
    piłka wychodzi nad górną krawędź tylko przy mocy bliskiej maksimum

  Skrypt doboru leżał w katalogu roboczym i nie ma go w repozytorium - ale przy każdej
  zmianie tych liczb warto go napisać od nowa, bo „wygląda dobrze" nie jest sprawdzeniem.
*/
export const GRAWITACJA = 1300;
/** opór powietrza: tyle prędkości zostaje po sekundzie lotu */
export const OPOR = 0.8;

export const PILKA_R = 24;
export const OBRECZ_R = 80;
export const ZELAZO_R = 7;
export const TABLICA_SZER = 320;
export const TABLICA_WYS = 130;

/** wysokość obręczy i pozycja piłki, w ułamku wysokości świata */
export const KOSZ_Y = 0.38;
export const PILKA_Y = 0.86;

/**
 * Jak daleko od kosza w bok stoi piłka.
 *
 * Nie pod obręczą, i to jest ważne: rzut prosto w górę wraca tą samą linią, więc cała
 * nadwyżka siły idzie w wysokość, a przy takim układzie trafia wyłącznie pełna moc.
 * Odsunięcie w bok zmienia rzut w łuk - nadwyżka siły idzie wtedy w zasięg, nie w pułap,
 * i pojawia się prawdziwa wymiana między kątem a mocą.
 *
 * Na wąskim ekranie odsunięcie schodzi do 30% szerokości, bo pełne wypchnęłoby piłkę
 * za krawędź.
 */
export const ODSUNIECIE_PILKI = 340;

/** ile pikseli przeciągnięcia daje pełną moc */
export const ZASIEG_MOCY = 320;
/** krótsze przeciągnięcie to nie rzut, tylko drgnięcie ręki */
export const MARTWA_STREFA = 26;
/*
  Dolna granica siły jest wysoka z rozmysłem. Przy 620 px/s najsłabsze rzuty nie sięgały
  nawet połowy drogi do obręczy, więc dolne dwie trzecie przeciągnięcia nie robiły nic
  poza pokazywaniem, że jest za słabo. Teraz najsłabszy rzut ledwo nie dochodzi - i to
  jest informacja, na której da się poprawić następny.
*/
export const MIN_PREDKOSC = 1100;
export const MAKS_PREDKOSC = 1650;

/** stały krok fizyki - ten sam w locie i w podglądzie toru */
export const KROK = 1 / 120;

/** Gdzie stoi piłka przy danej szerokości planszy - patrz `ODSUNIECIE_PILKI`. */
export function pozycjaPilki(szer: number) {
  const koszX = szer / 2;
  return {
    x: koszX - Math.min(ODSUNIECIE_PILKI, szer * 0.3),
    y: WYS * PILKA_Y,
  };
}

export interface Cialo {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Wektor rzutu z punktu piłki do punktu celowania albo `null`, gdy gest był za krótki.
 *
 * Ta sama funkcja karmi podgląd toru i sam rzut - i to jest cały sens jej istnienia.
 * Gdyby podgląd liczył cokolwiek innego niż rzut, byłby kłamstwem, a gracz nie miałby
 * z niego żadnego pożytku.
 *
 * Krzywa siły jest wypukła (`^1.35`): przy krótkim przeciągnięciu przyrost jest łagodny,
 * przy długim szybszy. Delikatne poprawki celowania są więc naprawdę delikatne, a pełną
 * moc trzeba świadomie wyciągnąć.
 */
export function wektorRzutu(
  pilkaX: number,
  pilkaY: number,
  celX: number,
  celY: number
): { vx: number; vy: number; moc: number } | null {
  const dx = celX - pilkaX;
  const dy = celY - pilkaY;
  const d = Math.hypot(dx, dy);
  if (d < MARTWA_STREFA) return null;

  const t = Math.min(d / ZASIEG_MOCY, 1);
  const moc = MIN_PREDKOSC + (MAKS_PREDKOSC - MIN_PREDKOSC) * Math.pow(t, 1.35);
  return { vx: (dx / d) * moc, vy: (dy / d) * moc, moc: t };
}

/** Jeden krok lotu: grawitacja, opór i odbicia od dwóch krańców obręczy. */
export function krokLotu(c: Cialo, dt: number, koszX: number, koszY: number) {
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.vy += GRAWITACJA * dt;

  const opor = Math.pow(OPOR, dt);
  c.vx *= opor;
  c.vy *= opor;

  /*
    Krawędzie obręczy odbijają piłkę i to one dają grze dramaturgię: rzut trochę za mocny
    nie leci po prostu obok, tylko puka o żelazo i czasem jednak wpada.
  */
  for (const kraniec of [koszX - OBRECZ_R, koszX + OBRECZ_R]) {
    const dx = c.x - kraniec;
    const dy = c.y - koszY;
    const d = Math.hypot(dx, dy);
    const min = PILKA_R + ZELAZO_R;
    if (d < min && d > 0.001) {
      const nx = dx / d;
      const ny = dy / d;
      const rzut = c.vx * nx + c.vy * ny;
      c.vx = (c.vx - 2 * rzut * nx) * 0.58;
      c.vy = (c.vy - 2 * rzut * ny) * 0.58;
      c.x = kraniec + nx * min;
      c.y = koszY + ny * min;
    }
  }
}

/**
 * Czy to jest trafienie.
 *
 * Trzy warunki naraz: piłka opada, jest w świetle obręczy i była wcześniej NAD nią.
 * Ten ostatni jest konieczny - bez niego rzut przechodzący obok obręczy od dołu liczyłby
 * się jak wpadnięcie do kosza od spodu.
 */
export function czyTrafienie(c: Cialo, koszX: number, koszY: number, nadObreczka: boolean) {
  return (
    c.vy > 0 &&
    nadObreczka &&
    Math.abs(c.y - koszY) < 22 &&
    Math.abs(c.x - koszX) < OBRECZ_R - PILKA_R * 0.35
  );
}

/**
 * Rozegranie całego rzutu bez rysowania - do sprawdzania zasad i do podglądu toru.
 *
 * Zwraca, czy wpadł, oraz tor, którym piłka poleciała. Kosz stoi w miejscu: ruchomy
 * należy do poziomów trudności i nie ma go po co mieszać do sprawdzania samej mechaniki.
 */
export function rozegrajRzut(
  pilkaX: number,
  pilkaY: number,
  celX: number,
  celY: number,
  koszX: number,
  koszY: number,
  szer: number
): { trafiony: boolean; tor: { x: number; y: number }[]; szczyt: number; poza: boolean } {
  const rzut = wektorRzutu(pilkaX, pilkaY, celX, celY);
  if (!rzut) return { trafiony: false, tor: [], szczyt: pilkaY, poza: false };

  const c: Cialo = { x: pilkaX, y: pilkaY, vx: rzut.vx, vy: rzut.vy };
  const tor: { x: number; y: number }[] = [];
  let nad = false;
  let szczyt = pilkaY;
  let poza = false;

  for (let i = 0; i < 1200; i++) {
    krokLotu(c, KROK, koszX, koszY);
    if (i % 6 === 0) tor.push({ x: c.x, y: c.y });
    szczyt = Math.min(szczyt, c.y);
    if (c.y < koszY - PILKA_R) nad = true;
    if (czyTrafienie(c, koszX, koszY, nad)) return { trafiony: true, tor, szczyt, poza };
    /* wylot poza kadr w bok albo w górę - to znaczy, że gracz stracił piłkę z oczu */
    if (c.x < -PILKA_R || c.x > szer + PILKA_R || c.y < -PILKA_R) poza = true;
    if (c.y > WYS + 160) break;
  }

  return { trafiony: false, tor, szczyt, poza };
}
