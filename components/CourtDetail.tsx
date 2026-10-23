import Link from "next/link";
import { Court, SIATKA_LABEL, godzinyNaKafel, nawierzchniaNaKafel, surfaceLabel } from "@/lib/types";
import { SITE_URL, czyAutorAnonimowy, formatDistance, slugifyPlace } from "@/lib/site";
import { JAKOSC_ZDJECIA, adresMiniatury } from "@/lib/obrazy";
import { zdaniaWedlugCech } from "@/lib/opis-boiska";
import type { NearbyCourt } from "@/lib/repo";
import type { WeatherHour } from "@/lib/pogoda";
import type { Wydarzenie } from "@/lib/wydarzenia";
import { CourtPhoto } from "./CourtPhoto";
import { BoxWydarzenia } from "./BoxWydarzenia";
import { ShortsPlayer } from "./ShortsPlayer";
import { ReportButton } from "./ReportButton";
import { PoprawZdjecia } from "./PoprawZdjecia";
import { LinkEdycji, LinkWydarzenia, PasekLosowania } from "./reakcje";
import { KartaDostawca } from "./karta/KartaKontekst";
import { KodQr } from "./karta/KodQr";
import { KtoDzisGra } from "./karta/KtoDzisGra";
import { IdeZagrac } from "./karta/IdeZagrac";
import { KomorkaOpinii, Opinie } from "./karta/Opinie";
import { PasekZdjec } from "./karta/PasekZdjec";
import { PogodaKarty } from "./karta/PogodaKarty";
import { Polub } from "./karta/Polub";
import { StatusOtwarcia } from "./karta/StatusOtwarcia";
import { PlakietkaCoconaut } from "./karta/NaKadrze";
import {
  IkAparat,
  IkFlaga,
  IkKosz,
  IkNawierzchnia,
  IkPlot,
  IkProwadz,
  IkSiatka,
  IkSwiatlo,
  IkZegar,
} from "./karta/ikony";

/** Co wisi na obręczach - podpis w pasku pod nazwą („Boisko: Beton, łańcuch"). */
const SIATKA_KROTKO = { lancuch: "łańcuch", siatka: "siatka", brak: "bez siatki" } as const;

/** Podpis siatki w „Co tu znajdziesz" - o tym jednym parametrze akapit opisu milczy. */
const SIATKA_OPIS = {
  lancuch: "Metalowe łańcuchy - piłka dzwoni przy każdym trafieniu.",
  siatka: "Klasyczne siatki na obręczach.",
  brak: "Obręcze bez siatek.",
} as const;

/**
 * Karta boiska (od 23.10.2026, telefon i komputer).
 *
 * Jeden układ na wszystkie ekrany, z prototypów karty (`podkosz-karty`): zdjęcie od krawędzi
 * do krawędzi z nazwą w gradiencie (05), pasek parametrów (01), kto dziś gra z kodem QR
 * (01 + 09), zdjęcia (01), opinie (10), co tu znajdziesz (05), pogoda (03), okolica (06),
 * stopka (01). „Idę zagrać" wisi na każdym ekranie na środku dołu i rozwija wybór dnia
 * i godzin. Różni się pasek pod nazwą: na telefonie trzy pozycje (opinie, kosze, boisko =
 * nawierzchnia i siatka), na komputerze siedem osobnych.
 *
 * Wszystko, co zależy od patrzącego (polubienia, zapisy, opinie, stan otwarcia na teraz),
 * dociąga się w przeglądarce, więc sama strona dalej leci z pamięci podręcznej.
 */
export function CourtDetail({
  court,
  nearby = [],
  weather = [],
  nowHour = 12,
  wydarzenie = null,
  avatarAutora = null,
}: {
  court: Court;
  nearby?: NearbyCourt[];
  /** prognoza godzinowa - pusta dla boisk krytych i gdy open-meteo nie odpowiada */
  weather?: WeatherHour[];
  /** aktualna godzina w Polsce, policzona na serwerze */
  nowHour?: number;
  /** wydarzenie na tym boisku - stoi nad wszystkim innym */
  wydarzenie?: Wydarzenie | null;
  /** zdjęcie profilowe osoby, która zgłosiła boisko - przy przypiętej opinii */
  avatarAutora?: string | null;
}) {
  const zdjecia = court.photos;
  const siatka = court.siatka ?? "brak";
  const opisy = zdaniaWedlugCech(court);
  const anonim = czyAutorAnonimowy(court.addedBy);

  const dostep = godzinyNaKafel(court.hours, court.access);
  const siatkaWartosc = siatka === "brak" ? "Brak" : SIATKA_LABEL[siatka];

  const cechy = [
    { ikona: IkKosz, nazwa: "Kosze", opis: opisy.kosze, wartosc: String(court.hoops), brak: court.hoops === 0 },
    { ikona: IkNawierzchnia, nazwa: "Nawierzchnia", opis: opisy.nawierzchnia, wartosc: surfaceLabel(court.surface), brak: false },
    { ikona: IkZegar, nazwa: "Dostęp", opis: opisy.dostep, wartosc: dostep, brak: false },
    { ikona: IkSiatka, nazwa: "Siatka", opis: SIATKA_OPIS[siatka], wartosc: siatkaWartosc, brak: siatka === "brak" },
    { ikona: IkSwiatlo, nazwa: "Oświetlenie", opis: opisy.swiatlo, wartosc: court.lit ? "Tak" : "Brak", brak: !court.lit },
    { ikona: IkPlot, nazwa: "Ogrodzenie", opis: opisy.plot, wartosc: court.fenced ? "Tak" : "Brak", brak: !court.fenced },
  ];

  /* pozycje paska, które na komputerze stoją osobno, a na telefonie zbiera „Boisko" */
  const naKomputerze = [
    { nazwa: "Nawierzchnia", wartosc: nawierzchniaNaKafel(court.surface), brak: false },
    { nazwa: "Dostęp", wartosc: dostep, brak: false },
    { nazwa: "Siatka", wartosc: siatkaWartosc, brak: siatka === "brak" },
    { nazwa: "Oświetlenie", wartosc: court.lit ? "Tak" : "Brak", brak: !court.lit },
    { nazwa: "Ogrodzenie", wartosc: court.fenced ? "Tak" : "Brak", brak: !court.fenced },
  ];

  return (
    <KartaDostawca courtId={court.id} zdjecia={zdjecia.map((z) => ({ url: z.url, caption: z.caption }))}>
      <main className="kb">
        <span aria-hidden className="kb-zaslona-gory" />

        {/* ---------- zdjęcie tytułowe z nazwą ---------- */}
        <section className="kb-hero">
          <div className="kb-hero-kadr">
            {zdjecia[0] && <CourtPhoto photo={zdjecia[0]} seed={court.seed} priority sizes="100vw" />}
            <span aria-hidden className="kb-hero-gora" />
            <span aria-hidden className="kb-hero-dol" />
          </div>

          {/*
            Skróty administratora w prawym górnym rogu zdjęcia, tuż pod paskiem nawigacji -
            poza treścią karty, którą widzą wszyscy. Dla pozostałych nic się tu nie rysuje.
          */}
          <div className="kb-hero-admin">
            <LinkEdycji slug={court.slug} />
            <LinkWydarzenia slug={court.slug} />
          </div>

          <div className="kb-hero-tresc">
            <div className="flex min-h-[30px] flex-wrap items-center gap-1.5">
              {court.basketApproved && <PlakietkaCoconaut notatka={court.basketNote} />}
              {court.funny && <span className="kb-na-kadrze">Śmieszne boisko</span>}
            </div>

            <h1 className="mt-3 max-w-[22ch] text-[30px] font-bold leading-[1.08] tracking-[-0.025em] [text-wrap:balance] md:text-[46px] lg:text-[58px] lg:leading-[1.02]">
              {court.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted md:text-[16px]">
              <span>{court.city}</span>
              <StatusOtwarcia hours={court.hours} access={court.access} />
            </p>

            <div className="mt-4 flex items-center gap-2 md:mt-5">
              <Polub courtId={court.id} likes={court.likes} />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`}
                target="_blank"
                rel="noreferrer"
                className="kb-przycisk gap-2 px-4"
              >
                <IkProwadz className="h-[18px] w-[18px]" /> Prowadź
              </a>
            </div>

            {/* „losuj dalej" po wejściu z losowania - poza nim nic się tu nie rysuje */}
            <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
              <PasekLosowania slug={court.slug} />
            </div>
          </div>
        </section>

        <div className="kb-tresc">
          {/* ---------- pasek parametrów (prototyp 01) ---------- */}
          <div className="kb-info">
            <KomorkaOpinii />
            <div className="kb-info-komorka">
              <small>Kosze</small>
              <b className="tabular-nums">{court.hoops}</b>
              <span> </span>
            </div>
            <div className="kb-info-komorka kb-info-tel">
              <small>Boisko</small>
              <b>{nawierzchniaNaKafel(court.surface)}</b>
              <span>{SIATKA_KROTKO[siatka]}</span>
            </div>
            {naKomputerze.map((p) => (
              <div key={p.nazwa} className="kb-info-komorka kb-info-pc">
                <small>{p.nazwa}</small>
                <b className={p.brak ? "kb-info-brak" : undefined}>{p.wartosc}</b>
                <span> </span>
              </div>
            ))}
          </div>

          {wydarzenie && (
            <div className="kb-sekcja">
              <BoxWydarzenia wydarzenie={wydarzenie} />
            </div>
          )}

          <KtoDzisGra kodQr={<KodQr tekst={`${SITE_URL}/boisko/${court.slug}?zagraj=1`} className="h-full w-full" />} />

          {/* na komputerze zdjęcia i opinie w jednym rzędzie: talia po lewej, średnia i opinie po prawej */}
          <div className="kb-zdjecia-opinie">
            {zdjecia.length > 0 && (
              <PasekZdjec
                zdjecia={zdjecia}
                seed={court.seed}
                film={court.shortsUrl ? <ShortsPlayer url={court.shortsUrl} title={`${court.name}, ${court.city}`} /> : null}
              />
            )}

            <Opinie
              courtId={court.id}
              przypieta={{
                nick: court.addedBy,
                profil: anonim ? null : `/gracz/${slugifyPlace(court.addedBy)}`,
                avatar: avatarAutora ? adresMiniatury(avatarAutora, 72, JAKOSC_ZDJECIA) : null,
                dodane: court.addedAt,
                tekst: (court.description ?? "").trim(),
              }}
            />
          </div>

          {/* ---------- co tu znajdziesz (prototyp 05) ---------- */}
          <section className="kb-sekcja" aria-labelledby="cechy-tytul">
            <h2 id="cechy-tytul" className="kb-tytul px-1">
              Co tu znajdziesz
            </h2>
            <ul className="kb-cechy mt-2">
              {cechy.map(({ ikona: Ikona, nazwa, opis, wartosc, brak }) => (
                <li key={nazwa} className="kb-cecha">
                  <Ikona className="mt-0.5 h-[22px] w-[22px] shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{nazwa}</p>
                    {opis && <p className="mt-0.5 text-[13px] leading-snug text-muted">{opis}</p>}
                  </div>
                  <p className={`max-w-[42%] text-right text-[15px] ${brak ? "text-faint" : "font-semibold"}`}>{wartosc}</p>
                </li>
              ))}
            </ul>
          </section>

          {weather.length > 0 && <PogodaKarty hours={weather} nowHour={nowHour} />}

          {/* ---------- najbliższe boiska (prototyp 06) ---------- */}
          {nearby.length > 0 && (
            <section className="kb-sekcja" aria-labelledby="okolica-tytul">
              <p className="kb-nadtytul px-1">Najbliższe boiska</p>
              <h2 id="okolica-tytul" className="mt-1 px-1 text-[32px] font-bold leading-[1.05] tracking-[-0.03em]">
                Grasz dalej?
              </h2>
              <ul className="kb-okolica-lista mt-3">
                {nearby.map(({ court: c, distanceM }) => {
                  const [liczba, jednostka] = distanceM !== null ? formatDistance(distanceM).split(" ") : [];
                  return (
                    <li key={c.id}>
                      <Link href={`/boisko/${c.slug}`} className="kb-okolica">
                        <span className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[12px] bg-[var(--k-karta)]">
                          <CourtPhoto photo={c.photos[0]} seed={c.seed} sizes="58px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{c.name}</span>
                          <span className="block text-[13px] text-muted">{c.city}</span>
                        </span>
                        {liczba && (
                          <span className="shrink-0 whitespace-nowrap">
                            <span className="font-display text-[21px] tabular-nums">{liczba}</span>
                            <span className="ml-0.5 text-[11px] font-semibold text-muted">{jednostka}</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ---------- stopka karty (prototyp 01) - na środku, symetrycznie ---------- */}
          <section className="kb-sekcja text-center">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Coś się nie zgadza?</h2>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-[14px] leading-relaxed text-muted [text-wrap:balance]">
              Boisko się zmieniło, zdjęcia są nieaktualne albo czegoś brakuje? Daj znać - poprawimy kartę.
            </p>
            {/* dwa przyciski równej szerokości, więc oś środka wypada dokładnie między nimi */}
            <div className="mx-auto mt-4 grid max-w-[400px] grid-cols-2 gap-2.5">
              <ReportButton courtId={court.id} className="kb-przycisk w-full justify-center gap-2">
                <IkFlaga className="h-[17px] w-[17px]" /> Zgłoś zmianę
              </ReportButton>
              <PoprawZdjecia
                courtId={court.id}
                lat={court.lat}
                lng={court.lng}
                photos={court.photos}
                className="kb-przycisk w-full justify-center gap-2"
              >
                <IkAparat className="h-[17px] w-[17px]" /> Popraw zdjęcia
              </PoprawZdjecia>
            </div>
          </section>
        </div>
      </main>

      {/* „Idę zagrać" przyklejony na środku dołu ekranu - na telefonie i na komputerze */}
      <IdeZagrac courtId={court.id} />
    </KartaDostawca>
  );
}
