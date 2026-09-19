"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePoprawki, type Poprawka } from "@/lib/poprawki";
import { adresMiniatury } from "@/lib/obrazy";
import { PROMIEN_OBECNOSCI_M } from "@/lib/obecnosc";
import { PinIcon } from "../icons";

/**
 * Poprawki zdjęć: ktoś przyniósł ładniejszy kadr do cudzego boiska.
 *
 * Stoi w zakładce zgłoszeń błędów, bo to ta sama praca i ten sam nawyk: raz dziennie
 * wchodzi się w jedno miejsce i przegląda, co ludzie zgłosili. Osobna zakładka znaczyłaby
 * drugie miejsce do pamiętania, a poprawek będzie kilka tygodniowo, nie kilkaset dziennie.
 *
 * ------------------------------------------------------------------ dlaczego oba kadry od razu
 *
 * Para stoi w wierszu OTWARTA, a nie pod kliknięciem. Decyzja brzmi „to jest lepsze od
 * tamtego" i zapada w sekundę, gdy widać oba naraz - a rozwijanie zamieniałoby sekundę
 * w trzy kliknięcia przy każdym zgłoszeniu. Kliknięcie w kadr zostaje dla przypadków
 * spornych: otwiera oba na pełnym ekranie, z tym samym przyciskiem przyjęcia.
 *
 * Po przyjęciu para znika z ekranu, a lista zostaje - następne zgłoszenie podchodzi
 * na jej miejsce i można lecieć dalej bez przeładowania.
 */
export function PoprawkiAdmin() {
  const { lista, wczytuje, blad, przyjmij, odrzuc } = usePoprawki();
  const [duze, setDuze] = useState<Poprawka | null>(null);

  /* nic do roboty - sekcja milczy, zamiast zajmować pół ekranu pustą ramką */
  if (wczytuje || (!lista.length && !blad)) return null;

  return (
    <section className="mt-12">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
        Poprawki zdjęć ({lista.length})
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        Ktoś przyszedł na boisko i zrobił lepszy kadr. Po lewej to, co wisi teraz, po prawej
        propozycja. Przyjęcie podmienia zdjęcie na karcie boiska - wpis zostaje przy osobie,
        która boisko dodała.
      </p>

      {blad && (
        <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {lista.map((p) => (
          <article key={p.id} className="glass overflow-hidden rounded-[24px] p-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-[16px] font-semibold">{p.nazwa}</span>
              <span className="flex items-center gap-1 text-[13px] text-muted">
                <PinIcon className="h-3.5 w-3.5" /> {p.miasto}
              </span>
              <span className="rounded-full border border-hairline bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-faint">
                {p.kadr}
              </span>
              <span className="text-[12.5px] text-faint">
                {p.autorSlug ? (
                  <Link href={`/gracz/${p.autorSlug}`} className="hover:text-ink">
                    {p.autor}
                  </Link>
                ) : (
                  p.autor
                )}{" "}
                · {new Date(p.kiedy).toLocaleString("pl-PL")}
              </span>
              <SladGps metry={p.gpsM} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Kadr
                etykieta={p.obecne ? "Jest teraz" : "Tego kadru jeszcze nie ma"}
                url={p.obecne}
                onClick={() => setDuze(p)}
              />
              <Kadr
                etykieta="Propozycja"
                url={p.nowe}
                wyrozniony
                onClick={() => setDuze(p)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void przyjmij(p)}
                className="rounded-2xl flame-gradient px-5 py-3 text-[13px] font-bold text-black"
              >
                {p.obecne ? "Przyjmij i podmień" : "Przyjmij i dołóż"}
              </button>
              <button
                onClick={() => void odrzuc(p)}
                className="rounded-2xl border border-hairline bg-white/5 px-5 py-3 text-[13px] font-medium text-muted transition hover:text-ink"
              >
                Odrzuć
              </button>
              {p.slug && (
                <Link
                  href={`/boisko/${p.slug}`}
                  target="_blank"
                  className="glass ml-auto rounded-2xl px-5 py-3 text-[13px] font-medium"
                >
                  Karta boiska
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      {duze && (
        <Powiekszenie
          poprawka={duze}
          onZamknij={() => setDuze(null)}
          onPrzyjmij={async () => {
            await przyjmij(duze);
            setDuze(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * Ślad GPS przy poprawce.
 *
 * Ta liczba niczego nie dowodzi - pozycję z przeglądarki da się podmienić i wtedy trafia
 * tu dokładnie to, co się jej podało. Pokazujemy ją, bo jest jedyną wskazówką, komu
 * przyjrzeć się uważniej: zdjęcie z zera metrów wygląda tak samo wiarygodnie jak
 * z dwudziestu, ale zero nie bierze się z telefonu w kieszeni.
 */
function SladGps({ metry }: { metry: number | null }) {
  if (metry === null) {
    return <span className="text-[12px] text-faint">bez śladu GPS</span>;
  }
  const daleko = metry > PROMIEN_OBECNOSCI_M;
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] tabular-nums ${
        daleko ? "bg-ember/15 text-ember" : "text-faint"
      }`}
    >
      {metry} m od pinezki
    </span>
  );
}

function Kadr({
  etykieta,
  url,
  wyrozniony = false,
  onClick,
}: {
  etykieta: string;
  url: string | null;
  wyrozniony?: boolean;
  onClick: () => void;
}) {
  return (
    <div>
      <p
        className={`mb-2 text-[11px] uppercase tracking-[0.16em] ${
          wyrozniony ? "text-flame" : "text-faint"
        }`}
      >
        {etykieta}
      </p>
      <button
        onClick={onClick}
        disabled={!url}
        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-[18px] border ${
          wyrozniony ? "border-flame/50" : "border-hairline"
        } disabled:cursor-default`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={adresMiniatury(url, 720)}
            alt={etykieta}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-white/4 text-[12.5px] text-faint">
            pusto - poprawka dołoży nowy kadr
          </span>
        )}
      </button>
    </div>
  );
}

/** Oba kadry na pełnym ekranie, z przyciskiem przyjęcia pod ręką. */
function Powiekszenie({
  poprawka,
  onZamknij,
  onPrzyjmij,
}: {
  poprawka: Poprawka;
  onZamknij: () => void;
  onPrzyjmij: () => void;
}) {
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZamknij();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [onZamknij]);

  return (
    <div
      onClick={onZamknij}
      className="fixed inset-0 z-[90] flex flex-col bg-void/92 p-4 backdrop-blur-xl sm:p-7"
    >
      <div className="flex shrink-0 items-center gap-4 pb-4">
        <span className="text-[15px] font-semibold">
          {poprawka.nazwa} · {poprawka.kadr}
        </span>
        <button
          onClick={onZamknij}
          aria-label="Zamknij"
          className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-hairline bg-white/6 text-[15px] text-muted transition hover:text-ink"
        >
          &times;
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2"
      >
        <DuzyKadr etykieta="Jest teraz" url={poprawka.obecne} />
        <DuzyKadr etykieta="Propozycja" url={poprawka.nowe} wyrozniony />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 justify-center gap-3 pt-4"
      >
        <button
          onClick={onPrzyjmij}
          className="rounded-2xl flame-gradient px-8 py-3.5 text-[14px] font-bold text-black"
        >
          {poprawka.obecne ? "Przyjmij i podmień" : "Przyjmij i dołóż"}
        </button>
        <button
          onClick={onZamknij}
          className="rounded-2xl border border-hairline bg-white/6 px-6 py-3.5 text-[14px] font-medium text-muted transition hover:text-ink"
        >
          Wróć do listy
        </button>
      </div>
    </div>
  );
}

function DuzyKadr({
  etykieta,
  url,
  wyrozniony = false,
}: {
  etykieta: string;
  url: string | null;
  wyrozniony?: boolean;
}) {
  return (
    <figure className="flex min-h-0 flex-col">
      <figcaption
        className={`mb-2 shrink-0 text-[11px] uppercase tracking-[0.16em] ${
          wyrozniony ? "text-flame" : "text-faint"
        }`}
      >
        {etykieta}
      </figcaption>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={adresMiniatury(url, 1600)}
          alt={etykieta}
          className="min-h-0 flex-1 rounded-[18px] object-contain"
        />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-[18px] border border-hairline bg-white/4 text-[13px] text-faint">
          tego kadru jeszcze nie ma
        </div>
      )}
    </figure>
  );
}
