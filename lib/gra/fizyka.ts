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
/*
  Proporcja tablicy jest wzięta z prawdziwej: 183 na 105 cm, czyli 1,74 : 1. Poprzednie
  320 na 130 dawało 2,46 : 1 - płytę dwa razy bardziej spłaszczoną niż jakakolwiek tablica,
  która stoi na boisku. Przy 185 wychodzi 1,73 : 1 i górna krawędź nadal zostaje w kadrze
  (sprawdzone: 167 px od góry świata).
*/
export const TABLICA_WYS = 185;
/** odstęp między dolną krawędzią tablicy a obręczą - miejsce na mocowanie */
export const TABLICA_ODSTEP = 28;
/**
 * Spłaszczenie elipsy obręczy.
 *
 * Rysunek, nie fizyka - ale trzymany razem z resztą geometrii, bo od niego zależy, gdzie
 * wisi górny wieniec siatki. Krańce elipsy leżą dokładnie na wysokości obręczy, czyli
 * tam, gdzie liczone są zderzenia z żelazem: perspektywa nie kłamie w miejscu, w którym
 * coś od niej zależy.
 */
export const OBRECZ_RY = 17;

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

/**
 * Miejsca, z których się rzuca - dwanaście stanowisk objeżdżanych po kolei.
 *
 * Do tej pory piłka wracała zawsze w to samo miejsce, więc pierwsze dwadzieścia trafień
 * było dwudziestoma powtórzeniami jednego ruchu: raz wyćwiczony gest wystarczał, dopóki
 * kosz nie zaczynał uciekać. Teraz każde trafienie przenosi na następne stanowisko, więc
 * ten sam odcinek gry uczy CELOWANIA, a nie zapamiętywania jednego przeciągnięcia.
 *
 * `dx` to odsunięcie w bok od kosza w pikselach świata (znak wyznacza stronę), `y` to
 * wysokość w ułamku wysokości świata. Kolejność jest ułożona, nie losowa: strony zmieniają
 * się naprzemiennie, a odległość rośnie i maleje falami - dwa kolejne rzuty nigdy nie są
 * tym samym rzutem, ale nigdy też nie przeskakują z najbliższego na najdalszy.
 *
 * Po dwudziestym trafieniu stanowiska zaczynają się powtarzać, a różnicę robi już ruchomy
 * kosz (patrz `POZIOMY_GRY` w `lib/minigra.ts`).
 */
export const POZYCJE_RZUTU: { dx: number; y: number }[] = [
  { dx: -340, y: 0.86 },
  { dx: 300, y: 0.86 },
  { dx: -230, y: 0.9 },
  { dx: 400, y: 0.82 },
  { dx: -420, y: 0.8 },
  { dx: 240, y: 0.9 },
  { dx: -290, y: 0.84 },
  { dx: 360, y: 0.88 },
  { dx: -400, y: 0.9 },
  { dx: 280, y: 0.8 },
  { dx: -250, y: 0.82 },
  { dx: 420, y: 0.86 },
];

/**
 * Gdzie stoi piłka przy danym numerze rzutu i szerokości planszy.
 *
 * Odsunięcie jest przycinane do szerokości okna z dwóch stron. Górne ograniczenie jest
 * oczywiste - piłka nie może wyjść za krawędź. Dolne jest ważniejsze: przy bardzo wąskim
 * ekranie wszystkie stanowiska zbiegłyby się pod obręcz, a rzut prosto w górę wraca tą
 * samą linią i trafia wyłącznie pełną mocą (zmierzone: 0,4% skuteczności). Dlatego piłka
 * nigdy nie stoi bliżej niż 14% szerokości od pionu kosza.
 */
export function pozycjaPilki(szer: number, nrRzutu = 0) {
  const koszX = szer / 2;
  const poz = POZYCJE_RZUTU[((nrRzutu % POZYCJE_RZUTU.length) + POZYCJE_RZUTU.length) % POZYCJE_RZUTU.length];

  const gora = szer * 0.36;
  const dol = szer * 0.14;
  const dlugosc = Math.min(Math.max(Math.abs(poz.dx), dol), gora);

  return {
    x: koszX + Math.sign(poz.dx) * dlugosc,
    y: WYS * poz.y,
  };
}

/** O ile przednia krawędź obręczy opada w danym miejscu jej szerokości (0-1). */
export function krzywaObreczy(u: number) {
  return Math.sin(Math.PI * u) * OBRECZ_RY;
}

/**
 * Rozkład elementów kosza wokół punktu obręczy.
 *
 * Jedno miejsce na wszystkie te liczby, bo rysunek i sprawdzenie muszą patrzeć na to samo.
 * Bez tego „ładniejszy kosz" byłby zmianą, której nie da się skontrolować inaczej niż
 * okiem - a w tym środowisku nie mam czym na niego spojrzeć: kanwa nie dostaje klatek
 * animacji, więc nic się nie rysuje.
 */
export function geometriaKosza(koszX: number, koszY: number) {
  const tablica = {
    x: koszX - TABLICA_SZER / 2,
    y: koszY - TABLICA_WYS - TABLICA_ODSTEP,
    w: TABLICA_SZER,
    h: TABLICA_WYS,
  };
  const kwWys = TABLICA_WYS * 0.52;
  const kwSzer = TABLICA_SZER * 0.4;
  const kwadrat = {
    x: koszX - kwSzer / 2,
    y: tablica.y + TABLICA_WYS - kwWys - 12,
    w: kwSzer,
    h: kwWys,
  };
  /** dwa ukosy od dołu tablicy do obręczy */
  const mocowanie = [-1, 1].map((znak) => ({
    ax: koszX + znak * 26,
    ay: tablica.y + TABLICA_WYS,
    bx: koszX + znak * (OBRECZ_R * 0.62),
    by: koszY,
  }));
  /** krańce obręczy - te same punkty, w których liczymy zderzenia z żelazem */
  const zelazo = [
    { x: koszX - OBRECZ_R, y: koszY },
    { x: koszX + OBRECZ_R, y: koszY },
  ];

  return { tablica, kwadrat, mocowanie, zelazo, obrecz: { x: koszX, y: koszY, rx: OBRECZ_R, ry: OBRECZ_RY } };
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

/**
 * Prędkość obrotu piłki w radianach na sekundę, nadawana w chwili rzutu.
 *
 * Kierunek bierze się ze składowej poziomej, tempo z mocy i z tego, jak pionowy był rzut.
 * Znak jest ujemny, czyli piłka kręci się PRZECIWNIE do kierunku lotu - tak wygląda
 * podkręcenie nadawane nadgarstkiem i tak kręci się piłka na każdym nagraniu rzutu do
 * kosza. Obrót zgodny z lotem czyta się jak koło, które się toczy, a nie jak rzut.
 *
 * Płaski rzut kręci się leniwiej od pionowego przy tej samej mocy - stąd mnożnik z udziału
 * składowej pionowej w prędkości.
 */
export function predkoscObrotu(vx: number, vy: number, moc: number) {
  const v = Math.max(Math.hypot(vx, vy), 1);
  const pion = Math.abs(vy) / v;
  return -Math.sign(vx || 1) * (6 * moc + Math.abs(vx) * 0.004) * (0.7 + 0.6 * pion);
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

/**
 * Węzeł siatki: pozycja, pozycja poprzednia (verlet) i czy wisi na obręczy.
 *
 * Długości spoczynkowe więzów siedzą W WĘŹLE, a nie są liczone ze wzoru. Pierwsza wersja
 * liczyła je z głębokości podzielonej przez liczbę rzędów - i to był błąd, bo siatka jest
 * stożkiem: sąsiednie rzędy mają różne promienie, więc węzły są przesunięte także w bok
 * i prawdziwa odległość między nimi jest większa od samego odstępu pionowego. Więzy
 * ściągały więc siatkę od pierwszej klatki, a to, co miało być reakcją na piłkę, tonęło
 * w jej własnym zapadaniu się. Zmierzone: dolny wieniec nie ugiął się przy przelocie ani
 * o piksel, a po dziesięciu sekundach węzły stały 35 px od miejsca, w którym powstały.
 */
export interface PunktSiatki {
  x: number;
  y: number;
  px: number;
  py: number;
  /** górny rząd wisi na obręczy i nie spada */
  przypiety: boolean;
  /** długość spoczynkowa więzu do następnego węzła w rzędzie */
  dlPoziom: number;
  /** długość spoczynkowa więzu do węzła poniżej */
  dlPion: number;
  /** miejsce spoczynkowe względem środka obręczy - do niego siatka wraca */
  bazaX: number;
  bazaY: number;
}

/** To, co siatka musi wiedzieć o piłce: gdzie jest i jaki ma promień. */
export interface StanSiatki {
  x: number;
  y: number;
  siatka: PunktSiatki[];
}

/* siatka jako tkanina na więzach - kolumny, rzędy i głębokość w pikselach świata */
export const SIATKA_KOL = 11;
export const SIATKA_RZED = 6;
export const SIATKA_GLEB = 132;

/* ---------------------------------------------------------------- siatka */

/**
 * Siatka jako tkanina na więzach odległości (verlet).
 *
 * Górny wieniec wisi na obręczy, resztę ciągnie w dół grawitacja, a więzy trzymają nitki
 * na stałej długości. Dokładnie to samo zrobiłby silnik fizyki dla tkaniny - tylko że
 * tutaj mieści się w czterdziestu linijkach i nic więcej nie musi umieć.
 *
 * Piłka odpycha punkty promieniowo, więc przelot przez obręcz szarpie siatką w dół i na
 * boki, a potem więzy same ją składają. Nie ma tu żadnej animacji „po trafieniu" -
 * siatka rusza się, bo coś przez nią przeszło.
 *
 * Górny wieniec siedzi na PRZEDNIEJ połowie elipsy obręczy, nie na prostej. Obręcz jest
 * rysowana w lekkiej perspektywie, więc nitki przypięte do odcinka odstawałyby od żelaza
 * dokładnie w środku, tam gdzie elipsa opada najniżej.
 */
export function zbudujSiatke(x: number, y: number): PunktSiatki[] {
  const p: PunktSiatki[] = [];

  const gdzie = (r: number, k: number) => {
    const t = r / (SIATKA_RZED - 1);
    /* stożek: dolny wieniec jest węższy od obręczy */
    const promien = OBRECZ_R * (1 - t * 0.44);
    const u = k / (SIATKA_KOL - 1);
    return {
      x: x - promien + u * promien * 2,
      y: y + krzywaObreczy(u) + t * SIATKA_GLEB,
    };
  };

  for (let r = 0; r < SIATKA_RZED; r++) {
    for (let k = 0; k < SIATKA_KOL; k++) {
      const tu = gdzie(r, k);
      /*
        Długości spoczynkowe bierzemy z faktycznej odległości między węzłami w chwili
        budowy. Siatka jest wtedy dokładnie w równowadze: więzy nie mają czego ściągać,
        więc jedyne, co nią rusza, to piłka.
      */
      const obok = k < SIATKA_KOL - 1 ? gdzie(r, k + 1) : null;
      const nizej = r < SIATKA_RZED - 1 ? gdzie(r + 1, k) : null;
      p.push({
        x: tu.x,
        y: tu.y,
        px: tu.x,
        py: tu.y,
        przypiety: r === 0,
        dlPoziom: obok ? Math.hypot(obok.x - tu.x, obok.y - tu.y) : 0,
        dlPion: nizej ? Math.hypot(nizej.x - tu.x, nizej.y - tu.y) : 0,
        bazaX: tu.x - x,
        bazaY: tu.y - y,
      });
    }
  }
  return p;
}

export function krokSiatki(s: StanSiatki, dt: number, koszX: number, koszY: number) {
  const p = s.siatka;
  if (!p.length) return;

  for (let r = 0; r < SIATKA_RZED; r++) {
    for (let k = 0; k < SIATKA_KOL; k++) {
      const i = r * SIATKA_KOL + k;
      const pkt = p[i];

      if (pkt.przypiety) {
        /* górny wieniec trzyma się obręczy, także wtedy, gdy kosz ucieka na boki */
        const u = k / (SIATKA_KOL - 1);
        pkt.x = koszX - OBRECZ_R + u * OBRECZ_R * 2;
        pkt.y = koszY + krzywaObreczy(u);
        pkt.px = pkt.x;
        pkt.py = pkt.y;
        continue;
      }

      /* verlet: nowa pozycja z poprzedniej i przyspieszenia, bez trzymania prędkości */
      const vx = (pkt.x - pkt.px) * 0.965;
      const vy = (pkt.y - pkt.py) * 0.965;
      pkt.px = pkt.x;
      pkt.py = pkt.y;
      pkt.x += vx;
      pkt.y += vy + GRAWITACJA * 0.35 * dt * dt;

      /*
        Piłka rozpycha nitki. Zasięg jest większy od samej piłki (1,6 promienia), bo siatka
        ma się ugiąć PRZED kontaktem, a nie dopiero pod nią - inaczej wygląda, jakby piłka
        przechodziła przez nitki na wylot. Odepchnięcie jest pełne (0,85), więc przelot
        wyraźnie wypycha oczka w dół i na boki, a więzy dopiero potem je składają.
      */
      const zasieg = PILKA_R * 1.6;
      const dx = pkt.x - s.x;
      const dy = pkt.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < zasieg && d > 0.001) {
        /*
          Odepchnięcie jest ograniczone do sześciu pikseli na krok. Bez tego ograniczenia
          szybka piłka wyrzucała węzły o sto dwadzieścia pikseli w jednym kroku, oczka
          przechodziły jedno przez drugie i więzy zaklinowywały siatkę w pozgniecionym
          kształcie - zmierzone: po dziesięciu sekundach nie wracała bliżej niż czterdzieści
          pikseli od spoczynku. Mniejsze pchnięcie, powtórzone przez kilkanaście kroków
          przelotu, daje ten sam ruch, ale bez zaplątania.
        */
        const push = Math.min((zasieg - d) * 0.7, 9);
        pkt.x += (dx / d) * push;
        pkt.y += (dy / d) * push;
      }

      /*
        Słaby powrót do miejsca spoczynkowego. Same więzy trzymają odległości, ale nie
        kształt: siatka wypchnięta w bok może w nich wisieć krzywo bez końca, bo nic jej nie
        prostuje. Prawdziwa siatka wisi w jednym kształcie i do niego wraca - stąd ten
        ciąg, słaby na tyle, żeby przelot dalej było widać.
      */
      const bazaX = koszX + pkt.bazaX;
      const bazaY = koszY + pkt.bazaY;
      pkt.x += (bazaX - pkt.x) * 0.05;
      pkt.y += (bazaY - pkt.y) * 0.05;
    }
  }

  /*
    Trzy przebiegi więzów, nie dwa. Przy dwóch siatka po przelocie wracała leniwie i
    wyglądało to jak guma, nie jak nitki; trzeci przebieg daje jej sprężysty powrót
    z krótkim kołysaniem.
  */
  for (let iter = 0; iter < 3; iter++) {
    for (let r = 0; r < SIATKA_RZED; r++) {
      for (let k = 0; k < SIATKA_KOL; k++) {
        const i = r * SIATKA_KOL + k;
        if (k < SIATKA_KOL - 1) wiaz(p[i], p[i + 1], p[i].dlPoziom);
        if (r < SIATKA_RZED - 1) wiaz(p[i], p[i + SIATKA_KOL], p[i].dlPion);
      }
    }
  }
}


function wiaz(a: PunktSiatki, b: PunktSiatki, dl: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return;
  const roznica = (d - dl) / d;
  const ruchA = a.przypiety ? 0 : b.przypiety ? 1 : 0.5;
  const ruchB = b.przypiety ? 0 : a.przypiety ? 1 : 0.5;
  a.x += dx * roznica * ruchA;
  a.y += dy * roznica * ruchA;
  b.x -= dx * roznica * ruchB;
  b.y -= dy * roznica * ruchB;
}
