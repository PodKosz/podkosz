"use client";

import { MapCourt, surfaceLabel, type CourtPhotoRef } from "@/lib/types";
import { KADROW_WIZYTOWKI, thumbUrl, thumbWidth, useCourtPhotos } from "@/lib/galeria";
import { zapasowyAdres } from "@/lib/obrazy";
import { PhotoPlaceholder } from "./CourtPhoto";
import { photoUrl } from "@/lib/supabase/config";
import { godziny, kiedy, plakietka, wysokiPlakat, type Wydarzenie } from "@/lib/wydarzenia";
import { ClockIcon, FireBallIcon, HoopIcon, BasketApprovedBadge, SurfaceIcon } from "./icons";
import { ustalBarwe, zapamietanaBarwa } from "@/lib/barwa-zdjecia";
import { useState } from "react";

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
 * Karta jest z „płynnego szkła": rozmywa mapę pod spodem i zagina ją przy krawędziach
 * (patrz `.szklo-plynne` w globals.css oraz FiltrSzkla). Zwykłe `.glass` tylko rozmywało,
 * przez co wizytówka leżała na mapie jak naklejka zamiast jak szybka nad nią.
 * `tapHint` dokłada stopkę z zaproszeniem do dotknięcia, bo wtedy cała karta jest linkiem.
 * Wersja dotykowa jest o ~30% mniejsza od tej na kursor: szerokość ogranicza wrapper na mapie,
 * a marginesy i kroje pisma schodzą tutaj, żeby karta nie zajmowała pół ekranu telefonu.
 */
export function HoverCard({
  court,
  wydarzenie,
  tapHint = false,
  stan = "wchodzi",
}: {
  court: MapCourt;
  /** wydarzenie na tym boisku - wtedy wizytówka pokazuje je, a nie parametry boiska */
  wydarzenie?: Wydarzenie;
  tapHint?: boolean;
  /** „wchodzi" - karta się pojawia, „znika" - gaśnie i zaraz zostanie zdjęta z drzewa */
  stan?: "wchodzi" | "znika";
}) {
  // zdjęcia nie przychodzą razem z listą boisk - dociągamy je dla tej jednej pinezki
  /*
    Cztery kadry, nie trzy: przy wydarzeniu z pionowym plakatem siatka ma inny kształt
    (wąski plakat po lewej, cztery zdjęcia boiska po prawej) i potrzebuje o jedno więcej.
    Nadmiarowy kadr nic nie kosztuje, bo zapytanie i tak idzie po całą galerię boiska -
    ale zwykła wizytówka MUSI go odciąć, i robi to niżej, przy `kadry`.
  */
  const thumbs = useCourtPhotos(court.id, KADROW_WIZYTOWKI);

  /*
    Barwa refleksu na szkle, zdjęta z największego kadru (patrz `lib/barwa-zdjecia.ts`).

    Stoi TUTAJ, przy pozostałych zaczepach, a nie niżej przy samej karcie: wizytówka
    wydarzenia wychodzi wcześniejszym `return`, więc zaczep postawiony po nim wywoływałby
    się warunkowo - a to już nie jest zaczep, tylko błąd.

    Stan zaczyna od tego, co już policzyliśmy dla tego boiska w tej sesji - dzięki temu
    przy powrocie na tę samą pinezkę karta ma właściwą barwę od pierwszej klatki, zamiast
    mrugnąć błękitem i dopiero się przebarwić.

    `null` znaczy „zostań przy domyślnym błękicie" i jest zwyczajną odpowiedzią: tak
    kończy zdjęcie bez dominującej barwy (szary beton, pochmurne niebo) i tak kończy
    obrazek, którego nie da się odczytać z płótna.
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

  /*
    UKŁAD: DUŻY KADR NA CAŁĄ SZEROKOŚĆ I TRZY MAŁE POD NIM.

    Wcześniej duży kadr zajmował dwie trzecie szerokości, a dwa małe stały obok w kolumnie.
    Teraz zdjęcie tytułowe - to, po którym poznaje się boisko - dostaje całą szerokość
    wizytówki, a nazwa boiska leży wprost na nim, przy dolnej krawędzi, jak podpis na
    okładce. Pod spodem rząd trzech kadrów: kosze i nawierzchnia, czyli to, o co pyta się
    przed wyjazdem.

    Zawsze cztery miejsca - brakujące (i te, których zdjęcia jeszcze lecą z serwera)
    dostają grafikę zastępczą, więc wizytówka nie zmienia wysokości w trakcie ładowania.

    Linijki „miasto · typ boiska" nie ma: miasto widać na mapie tuż pod pinezką, a typ
    i tak niesie kafel z godzinami - dwa razy to samo tylko zabierało miejsce nazwie.
  */
  const kadry = Array.from({ length: KADROW_WIZYTOWKI }, (_, i) => thumbs[i] ?? null);
  const [tytulowy, ...male] = kadry;

  /* barwę liczymy tylko z kadru tytułowego - on niesie kolor boiska */
  const poTytulowym = (img: HTMLImageElement) => {
    void ustalBarwe(img, tytulowy?.url ?? "", court.id).then((b) => {
      if (b) setAkcent(b);
    });
  };

  return (
    <div
      className={`szklo-plynne overflow-hidden rounded-[22px] ${
        stan === "znika" ? "karta-mapy-znika" : "karta-mapy"
      } ${tapHint ? "w-full" : "w-[320px]"}`}
      style={akcent ? ({ "--szklo-akcent": akcent } as React.CSSProperties) : undefined}
    >
      {/* ---- kadr tytułowy z nazwą przy dolnej krawędzi ---- */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {tytulowy?.url ? (
          /*
            Zwykły <img> ze stałym adresem miniatury, a nie next/image: ten sam adres
            rozgrzewamy z góry (patrz prefetchCourtPhotos), więc obrazek jest już
            w pamięci przeglądarki i wizytówka pojawia się bez migania.
          */
          <Miniatura
            url={tytulowy.url}
            opis={tytulowy.caption}
            szerokosc={thumbWidth(0)}
            poWczytaniu={poTytulowym}
          />
        ) : (
          <PhotoPlaceholder kind="narożnik" seed={court.seed} />
        )}

        {/* przyciemnienie od dołu - nazwa leży na zdjęciu i musi być czytelna na każdym */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
          style={{
            background:
              "linear-gradient(0deg, rgb(var(--rgb-zaslona) / .86) 0%, rgb(var(--rgb-zaslona) / .45) 45%, transparent 100%)",
          }}
        />

        {court.basketApproved && (
          <BasketApprovedBadge className={`absolute left-2 ${tapHint ? "top-2" : "top-2.5"}`} />
        )}

        <div
          className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 ${
            tapHint ? "px-2.5 pb-2" : "px-3.5 pb-2.5"
          }`}
        >
          <h3
            className={`min-w-0 truncate font-semibold leading-tight tracking-tight text-kadr ${
              tapHint ? "text-[14px]" : "text-[16px]"
            }`}
            style={{ textShadow: "0 1px 10px rgb(0 0 0 / .55)" }}
          >
            {court.name}
          </h3>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 font-semibold text-kadr backdrop-blur-sm ${
              tapHint ? "py-0.5 text-[11px]" : "py-1 text-[12px]"
            }`}
          >
            <FireBallIcon className={tapHint ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {court.likes}
          </span>
        </div>
      </div>

      {/* ---- trzy kadry pod spodem ---- */}
      <div className="mt-[2px] grid grid-cols-3 gap-[2px]">
        {male.map((p, i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden">
            {p?.url ? (
              /* `object-cover` ze środkiem kadru - kosz i obręcz zwykle siedzą pośrodku */
              <Miniatura url={p.url} opis={p.caption} szerokosc={thumbWidth(i + 1)} />
            ) : (
              <PhotoPlaceholder kind={i === 2 ? "nawierzchnia" : "kosz-a"} seed={court.seed + i + 1} />
            )}
          </div>
        ))}
      </div>

      <div className={tapHint ? "p-2.5" : "p-3"}>
        <div className={`grid grid-cols-3 ${tapHint ? "gap-1.5" : "gap-2"}`}>
          <Fact
            compact={tapHint}
            icon={<HoopIcon className={tapHint ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            label="kosze"
            value={String(court.hoops)}
          />
          <Fact
            compact={tapHint}
            icon={<ClockIcon className={tapHint ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            label="otwarte"
            value={court.hours}
          />
          <Fact
            compact={tapHint}
            icon={<SurfaceIcon className={tapHint ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            label="podłoże"
            value={surfaceLabel(court.surface)}
          />
        </div>

        {tapHint && (
          <p className="mt-2 flex items-center justify-center gap-1.5 border-t border-hairline pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-flame">
            dotknij, żeby otworzyć boisko
            <span aria-hidden>→</span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Kafel z jednym parametrem boiska - z tego samego szkła co kafle liczb na profilu gracza
 * (`.kafel-szklo`: jasny rąbek u góry i u dołu, rozmycie, włosowa obwódka).
 *
 * Pismo jest wyraźnie większe niż wcześniej. Przy 10 px wartości i 9 px podpisu kafle były
 * nieczytelne na telefonie, a to przecież trzy rzeczy, dla których w ogóle zagląda się
 * w wizytówkę: ile koszy, kiedy otwarte, na czym się gra.
 */
function Fact({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`kafel-szklo relative overflow-hidden rounded-[14px] ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2"
      }`}
    >
      <div className="text-flame">{icon}</div>
      <div
        className={`truncate font-semibold leading-tight ${
          compact ? "mt-1 text-[12.5px]" : "mt-1.5 text-[14px]"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-0.5 uppercase tracking-[0.1em] text-faint ${
          compact ? "text-[9.5px]" : "text-[10px]"
        }`}
      >
        {label}
      </div>
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
    </div>
  );
}
