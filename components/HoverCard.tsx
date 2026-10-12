"use client";

import { MapCourt, godzinyNaKafel, nawierzchniaNaKafel, type CourtPhotoRef, type CourtType } from "@/lib/types";
import { KADROW_WIZYTOWKI, thumbUrl, thumbWidth, useCourtPhotos } from "@/lib/galeria";
import { zapasowyAdres } from "@/lib/obrazy";
import { PhotoPlaceholder } from "./CourtPhoto";
import { photoUrl } from "@/lib/supabase/config";
import { godziny, kiedy, plakietka, wysokiPlakat, type Wydarzenie } from "@/lib/wydarzenia";
import { ClockIcon, FireBallIcon } from "./icons";
import { ustalBarwe, zapamietanaBarwa } from "@/lib/barwa-zdjecia";
import { plural } from "@/lib/site";
import { useState } from "react";

/** Rodzaj boiska w linijce pod nazwą - pełnym słowem, bo stoi obok nazwy miasta. */
const RODZAJ_BOISKA: Record<CourtType, string> = {
  otwarty: "boisko otwarte",
  kryty: "boisko kryte",
  streetball: "streetball",
};

/**
 * Miniatura kadru z zapasem.
 *
 * Skalowaniem zajmuje się Supabase (patrz `lib/obrazy.ts`), ale gdyby kiedyś odmówiło -
 * wyłączone przekształcenia, inny plan, awaria - `onError` sięga po surowy plik. Jest
 * cięższy, ale WIDOCZNY, a puste kadry w wizytówce wyglądają jak zepsuta strona. Dokładnie
 * to zdarzyło się na produkcji, gdy limit przekształceń wyczerpał się po stronie Vercela.
 */
function Miniatura({
  url,
  opis,
  szerokosc,
  poWczytaniu,
}: {
  url: string;
  opis: string;
  szerokosc: number;
  /** wywoływane, gdy piksele są już w przeglądarce - stąd bierzemy barwę wizytówki */
  poWczytaniu?: (img: HTMLImageElement) => void;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={thumbUrl(url, szerokosc)}
      alt={opis}
      className="h-full w-full object-cover"
      decoding="async"
      onLoad={(e) => poWczytaniu?.(e.currentTarget)}
      onError={(e) => {
        const img = e.currentTarget;
        const zapas = zapasowyAdres(img.src);
        if (zapas && zapas !== img.src) img.src = zapas;
      }}
    />
  );
}

/**
 * Podgląd po najechaniu na pinezkę (na dotyku: po jej dotknięciu) - miniaturki i szybkie info.
 *
 * Zwykłe boisko dostaje wizytówkę „barwa zdjęcia", boisko z Basket Approved ten sam układ
 * w oprawie karty kolekcjonerskiej (opis niżej, przy `WizytowkaBoiska`). Wydarzenie ma
 * własną kartę z „płynnego szkła" (`.szklo-plynne` w globals.css oraz FiltrSzkla).
 * `tapHint` dokłada stopkę z zaproszeniem do dotknięcia, bo wtedy cała karta jest linkiem.
 * Wersja dotykowa jest o ~30% mniejsza od tej na kursor: szerokość ogranicza wrapper na mapie,
 * a marginesy i kroje pisma schodzą tutaj, żeby karta nie zajmowała pół ekranu telefonu.
 */
export function HoverCard({
  court,
  wydarzenie,
  tapHint = false,
  stan = "wchodzi",
  osobyDzis = 0,
}: {
  court: MapCourt;
  /** wydarzenie na tym boisku - wtedy wizytówka pokazuje je, a nie parametry boiska */
  wydarzenie?: Wydarzenie;
  tapHint?: boolean;
  /** „wchodzi" - karta się pojawia, „znika" - gaśnie i zaraz zostanie zdjęta z drzewa */
  stan?: "wchodzi" | "znika";
  /** ile osób zapisało się na dziś - ta sama liczba, która zapala ogień na pinezce */
  osobyDzis?: number;
}) {
  // zdjęcia nie przychodzą razem z listą boisk - dociągamy je dla tej jednej pinezki
  /*
    Cztery kadry, nie trzy: przy wydarzeniu z pionowym plakatem siatka ma inny kształt
    (wąski plakat po lewej, cztery zdjęcia boiska po prawej) i potrzebuje o jedno więcej.
    Nadmiarowy kadr nic nie kosztuje, bo zapytanie i tak idzie po całą galerię boiska -
    a zwykła wizytówka bierze z nich tylko pierwszy, kadr tytułowy.
  */
  const thumbs = useCourtPhotos(court.id, KADROW_WIZYTOWKI);

  /*
    Barwa zdjęcia tytułowego (patrz `lib/barwa-zdjecia.ts`) - barwi cień, który wizytówka
    boiska rzuca na mapę.

    Stoi TUTAJ, przy pozostałych zaczepach, a nie niżej przy samej karcie: wizytówka
    wydarzenia wychodzi wcześniejszym `return`, więc zaczep postawiony po nim wywoływałby
    się warunkowo - a to już nie jest zaczep, tylko błąd.

    Stan zaczyna od tego, co już policzyliśmy dla tego boiska w tej sesji - dzięki temu
    przy powrocie na tę samą pinezkę karta ma właściwą barwę od pierwszej klatki, zamiast
    mrugnąć barwą domyślną i dopiero się przebarwić.

    `null` znaczy „zostań przy pomarańczu marki" i jest zwyczajną odpowiedzią: tak kończy
    zdjęcie bez dominującej barwy (szary beton, pochmurne niebo) i tak kończy obrazek,
    którego nie da się odczytać z płótna.
  */
  const [akcent, setAkcent] = useState<string | null>(() => zapamietanaBarwa(court.id));

  /*
    Wydarzenie ma własną wizytówkę, a nie plakietkę doklejoną do zwykłej.
    Kto najeżdża na płonącą, biało-czerwoną pinezkę, pyta o jedno: co i kiedy. Nawierzchnia,
    liczba koszy i godziny otwarcia boiska są w tym momencie szumem - zostają na karcie
    boiska, dokąd prowadzi kliknięcie.
  */
  if (wydarzenie) {
    return (
      <WizytowkaWydarzenia
        court={court}
        wydarzenie={wydarzenie}
        tapHint={tapHint}
        stan={stan}
        kadry={thumbs}
      />
    );
  }

  return (
    <WizytowkaBoiska
      court={court}
      kadr={thumbs[0] ?? null}
      tapHint={tapHint}
      stan={stan}
      osobyDzis={osobyDzis}
      akcent={akcent}
      poBarwie={setAkcent}
    />
  );
}

/*
  WIZYTÓWKA BOISKA - „BARWA ZDJĘCIA" (wybrana z dziesięciu propozycji, październik 2026).

  Tłem karty jest jej własne zdjęcie tytułowe, mocno rozmyte i nasycone: karta ma kolory
  boiska, tak jak w Apple Music tło ma kolory okładki. Czerwony tartan daje ciepłą kartę,
  szary beton i niebo - chłodną. Na tym tle ostry kadr, nazwa, miasto, trzy kafle i stopka
  z ogniem i zapisami na dziś. Rozmyte tło to TEN SAM adres miniatury co kadr, więc nie
  kosztuje drugiego pobrania.

  Karta przechyla się za kursorem nad pinezką, a odblask przesuwa się po tafli - zmienne
  `--wiz-rx`, `--wiz-ry`, `--wiz-mx` i `--wiz-my` ustawia MapView na pojemniku karty.
  Na dotyku nie ma kursora, więc światło przesuwa się samo, powoli (patrz `.wiz-dotyk`).

  Boisko z Basket Approved dostaje ten sam układ w oprawie karty kolekcjonerskiej:
  holograficzna fioletowa folia na rancie, ciemny środek, nazwa Antonem i tęczowy połysk,
  który jedzie razem z odblaskiem. To ta sama barwa co fioletowa pinezka na mapie.
*/
function WizytowkaBoiska({
  court,
  kadr,
  tapHint,
  stan,
  osobyDzis,
  akcent,
  poBarwie,
}: {
  court: MapCourt;
  /** kadr tytułowy - z narożnika, ten sam, który otwiera galerię boiska */
  kadr: CourtPhotoRef | null;
  tapHint: boolean;
  stan: "wchodzi" | "znika";
  osobyDzis: number;
  /** barwa zdjęcia jako trójka RGB - zabarwia cień, który karta rzuca na mapę */
  akcent: string | null;
  poBarwie: (barwa: string) => void;
}) {
  const holo = court.basketApproved;
  const adresKadru = kadr?.url ? thumbUrl(kadr.url, thumbWidth(0)) : null;

  /* barwę liczymy z kadru tytułowego - on niesie kolor boiska */
  const poKadrze = (img: HTMLImageElement) => {
    void ustalBarwe(img, kadr?.url ?? "", court.id).then((b) => {
      if (b) poBarwie(b);
    });
  };

  return (
    <div
      className={`wiz ${holo ? "wiz-holo" : "wiz-barwa"} ${tapHint ? "wiz-dotyk w-full" : "w-[320px]"} ${
        stan === "znika" ? "karta-mapy-znika" : "karta-mapy"
      }`}
      style={akcent ? ({ "--wiz-akcent": akcent } as React.CSSProperties) : undefined}
    >
      {holo ? (
        <span aria-hidden className="wiz-folia" />
      ) : (
        <span
          aria-hidden
          className="wiz-tlo"
          style={adresKadru ? { backgroundImage: `url("${adresKadru}")` } : undefined}
        />
      )}

      <div className="wiz-srodek">
        {holo && (
          <div className="wiz-holo-gora">
            <span>Basket Approved</span>
            <FireBallIcon variant="basket" className="h-4 w-4" />
          </div>
        )}

        <div className="wiz-kadr">
          {kadr?.url ? (
            /*
              Zwykły <img> ze stałym adresem miniatury, a nie next/image: ten sam adres
              rozgrzewamy z góry (patrz prefetchCourtPhotos), więc obrazek jest już
              w pamięci przeglądarki i wizytówka pojawia się bez migania.
            */
            <Miniatura url={kadr.url} opis={kadr.caption} szerokosc={thumbWidth(0)} poWczytaniu={poKadrze} />
          ) : (
            <PhotoPlaceholder kind="narożnik" seed={court.seed} />
          )}
        </div>

        <h3 className="wiz-nazwa">{court.name}</h3>
        <p className="wiz-miejsce">
          {court.city} · {RODZAJ_BOISKA[court.type] ?? court.type}
        </p>

        <div className="wiz-kafle">
          <div>
            <b>{court.hoops}</b>
            <span>{plural(court.hoops, ["kosz", "kosze", "koszy"])}</span>
          </div>
          <div>
            <b>{godzinyNaKafel(court.hours, court.access)}</b>
            <span>otwarte</span>
          </div>
          <div>
            <b>{nawierzchniaNaKafel(court.surface)}</b>
            <span>podłoże</span>
          </div>
        </div>

        {/*
          Ogień i zapisy pokazujemy tylko wtedy, gdy są. Pusty licznik („0 podpaleń",
          „0 osób") to najgorsza możliwa informacja przy boisku - zniechęca, zamiast
          zapraszać. Gdy nie ma ani jednego, ani drugiego, stopki nie ma wcale.
        */}
        {(court.likes > 0 || osobyDzis > 0) && (
          <div className="wiz-stopka">
            {court.likes > 0 && (
              <span className="wiz-ogien">
                <FireBallIcon className="h-[15px] w-[15px] shrink-0" />
                <b>{court.likes}</b> {plural(court.likes, ["podpalenie", "podpalenia", "podpaleń"])}
              </span>
            )}
            {osobyDzis > 0 && (
              <span>
                <b>
                  {osobyDzis} {plural(osobyDzis, ["osoba", "osoby", "osób"])}
                </b>{" "}
                {plural(osobyDzis, ["idzie", "idą", "idzie"])} dziś
              </span>
            )}
          </div>
        )}

        {tapHint && (
          <p className="wiz-dotknij">
            dotknij, żeby otworzyć boisko <span aria-hidden>→</span>
          </p>
        )}
      </div>

      {holo && <span aria-hidden className="wiz-tecza" />}
      <span aria-hidden className="wiz-blask" />
    </div>
  );
}

/* ---------------------------------------------------------------- wydarzenie */

/** Czerwień wydarzenia - ta sama, co pinezka na mapie i box na karcie boiska. */
const CZERWIEN = "#e8112d";

function WizytowkaWydarzenia({
  court,
  wydarzenie,
  tapHint,
  stan,
  kadry,
}: {
  court: MapCourt;
  wydarzenie: Wydarzenie;
  tapHint: boolean;
  stan: "wchodzi" | "znika";
  /** zdjęcia boiska - wypełniają siatkę obok plakatu wydarzenia */
  kadry: CourtPhotoRef[];
}) {
  const plakat = wydarzenie.zdjecie ? photoUrl(wydarzenie.zdjecie) : null;
  const trwa = plakietka(wydarzenie) === "trwa teraz";

  /*
    UKŁAD SIATKI IDZIE ZA PROPORCJĄ PLAKATU - dokładnie tak, jak box na karcie boiska.

    Plakat pionowy dostaje wąski kafel na dwa rzędy (4:6, czyli 2:3 - kształt plakatu),
    a resztę pola wypełniają CZTERY zdjęcia boiska. Plakat poziomy albo kwadratowy zajmuje
    duży kafel dwa na dwa i zostawia po prawej dwa kadry - czyli dokładnie ten sam układ,
    co zwykła wizytówka boiska, tylko z plakatem na pierwszym miejscu.

    Bez plakatu siatka jest zwykłą siatką boiska: wydarzenie poznaje się wtedy po pasku
    w barwach flagi i po plakietce, nie po zdjęciu.
  */
  const pion = wysokiPlakat(wydarzenie);

  /*
    SIATKA UKŁADA SIĘ Z TEGO, CO JEST - nigdy nie zostawia dziur.

    Boiska dodawane ręcznie mają zdjęcia w dowolnych rodzajach i w dowolnej liczbie: to
    siedem „ogólnych", tamto trzy plus detal kosza. Poprzednia wersja rezerwowała stałą
    liczbę kafli i brakujące wypełniała grafiką zastępczą - a przy zdjęciach, których nie
    dało się przeskalować, wyglądało to jak zepsuta wizytówka.

    Teraz liczba i rozpiętość kafli wynika z liczby zdjęć, które naprawdę są. Sześć komórek
    (trzy na dwa) rozdzielamy tak, żeby zawsze były zajęte w całości:

      plakat pionowy (2 komórki):  4 zdjęcia -> po jednej; 3 -> jedno szerokie i dwa małe;
                                   2 -> dwa szerokie; 1 -> jedno na całe pole; 0 -> plakat
                                   rozciąga się na całą szerokość.
      plakat poziomy (4 komórki):  2 zdjęcia -> po jednej; 1 -> jedno na dwa rzędy;
                                   0 -> plakat na całą szerokość.
  */
  const dostepne = kadry.filter((k): k is { kind: typeof k.kind; url: string; caption: string } =>
    Boolean(k.url)
  );
  const miejsc = plakat ? (pion ? 4 : 2) : 3;
  const wypelniacze = dostepne.slice(0, miejsc);
  const ile = wypelniacze.length;

  const spanyPlakatu =
    ile === 0 ? "col-span-3 row-span-2" : pion ? "col-span-1 row-span-2" : "col-span-2 row-span-2";

  const spanyKadru = (i: number): string => {
    if (!plakat) {
      /* bez plakatu zostaje układ zwykłej wizytówki: duży kadr i dwa małe obok */
      if (ile === 1) return "col-span-3 row-span-2";
      if (ile === 2) return i === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-2";
      return i === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1";
    }
    if (pion) {
      if (ile === 1) return "col-span-2 row-span-2";
      if (ile === 2) return "col-span-2 row-span-1";
      if (ile === 3) return i === 0 ? "col-span-2 row-span-1" : "col-span-1 row-span-1";
      return "col-span-1 row-span-1";
    }
    return ile === 1 ? "col-span-1 row-span-2" : "col-span-1 row-span-1";
  };

  return (
    <div
      className={`szklo-plynne overflow-hidden rounded-[22px] ${
        stan === "znika" ? "karta-mapy-znika" : "karta-mapy"
      } ${tapHint ? "w-full" : "w-[320px]"}`}
      style={{ boxShadow: `0 18px 50px -18px ${CZERWIEN}` }}
    >
      {/*
        Wysokość pasa zdjęć jest STAŁA, a nie liczona z proporcji kafli - przy zmiennej
        rozpiętości komórek (patrz wyżej) proporcje dawałyby za każdym razem inną wysokość
        wizytówki, a ta pojawia się nad pinezką i nie może skakać.
      */}
      <div
        className="grid grid-cols-3 grid-rows-2 gap-[2px] bg-white/5"
        style={{ height: tapHint ? 132 : 162 }}
      >
        {plakat && (
          <div className={`relative overflow-hidden ${spanyPlakatu}`}>
            {/*
              Plakat idzie tą samą drogą co kadry boiska - przez `Miniatura`, czyli przez
              skalowanie w Supabase. Wcześniej wstawialiśmy tu surowy plik: 862 kB na
              wizytówkę szeroką na 320 px, ściągane przy każdym najechaniu na pinezkę.
              Szerokość zależy od tego, ile pola plakat zajmuje w siatce.
            */}
            <Miniatura
              url={plakat}
              opis={`Plakat wydarzenia: ${wydarzenie.nazwa}`}
              szerokosc={ile === 0 ? 640 : pion ? 240 : 440}
            />
            <span
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white"
              style={{
                background: CZERWIEN,
                boxShadow: trwa ? "0 0 0 3px rgb(232 17 45 / .35)" : undefined,
                animation: trwa ? "kropka-puls 1.8s ease-in-out infinite" : undefined,
              }}
            >
              {plakietka(wydarzenie)}
            </span>
          </div>
        )}

        {wypelniacze.map((p, i) => (
          <div key={i} className={`relative overflow-hidden ${spanyKadru(i)}`}>
            <Miniatura url={p.url} opis={p.caption} szerokosc={i === 0 && !plakat ? 320 : 200} />
          </div>
        ))}

        {/* nie ma ani plakatu, ani zdjęć - wtedy jedna grafika zastępcza na całe pole */}
        {!plakat && ile === 0 && (
          <div className="col-span-3 row-span-2 overflow-hidden">
            <PhotoPlaceholder kind="narożnik" seed={court.seed} />
          </div>
        )}
      </div>

      <div className={tapHint ? "p-2.5" : "p-3.5"}>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: CZERWIEN }}
        >
          wydarzenie
        </p>
        <h3
          className={`mt-1 font-semibold leading-tight tracking-tight ${
            tapHint ? "text-[14px]" : "text-[16px]"
          }`}
        >
          {wydarzenie.nazwa}
        </h3>

        <p className={`mt-1.5 text-muted ${tapHint ? "text-[11px]" : "text-[12px]"}`}>
          {court.name} · {court.city}
        </p>

        <div
          className={`mt-2.5 flex items-center gap-2 rounded-[14px] border px-3 py-2 ${
            tapHint ? "text-[11px]" : "text-[12px]"
          }`}
          style={{ borderColor: "rgb(232 17 45 / .35)", background: "rgb(232 17 45 / .08)" }}
        >
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{kiedy(wydarzenie)}</span>
        </div>

        {!tapHint && (
          <p className="mt-2 text-[11px] text-faint">
            {`Godziny: ${godziny(wydarzenie)} · kliknij, żeby zobaczyć szczegóły`}
          </p>
        )}
      </div>

      <span aria-hidden className="szklo-krawedzie" />
    </div>
  );
}
