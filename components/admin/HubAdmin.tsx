"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kokpit, usePanelGlowny } from "@/lib/kokpit";
import { DB_LIMIT, STORAGE_LIMIT, formatBytes } from "@/lib/stats";
import { photoUrl } from "@/lib/supabase/config";
import { plural } from "@/lib/site";
import { FireBallIcon, PinIcon } from "../icons";

/**
 * Strona tytułowa panelu.
 *
 * Odpowiada na jedno pytanie: „czy coś na mnie czeka i czy coś się dziś dzieje". Stąd
 * podział na trzy pasy - najpierw to, co wymaga decyzji (kolejka, błędy, opinie), potem
 * puls serwisu (kto jest teraz, ilu było dziś), a dopiero na końcu stan bazy. Odwrotna
 * kolejność wyglądałaby efektowniej, ale kazałaby codziennie przewijać przez liczby,
 * które i tak zmieniają się raz na tydzień.
 *
 * Kafelki z zaległościami są klikalne i prowadzą prosto w odpowiednią zakładkę - licznik,
 * który mówi „masz siedem zgłoszeń", ale każe samemu szukać, gdzie one są, to połowa
 * roboty.
 */
export function HubAdmin({ onGoTo }: { onGoTo: (widok: string) => void }) {
  const { dane, loading, error } = usePanelGlowny();
  /* zegar zamrożony przy pierwszym renderze - „14 minut temu" ma nie skakać przy przerysowaniu */
  const [teraz] = useState(() => Date.now());

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Zbieram dane…
      </p>
    );
  }

  if (error || !dane) {
    return (
      <div className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        <p>{error ?? "Brak danych."}</p>
        <p className="mt-2 text-muted">
          Jeśli to pierwszy raz po wdrożeniu, uruchom migrację
          <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5">
            supabase/migration-panel-glowny.sql
          </code>
          - dokłada funkcję <code>panel_glowny()</code>.
        </p>
      </div>
    );
  }

  const zaleglosci =
    dane.kolejka + dane.bledy + dane.opinie_nowe;

  return (
    <div className="space-y-8">
      {/* ---------- pas 1: co czeka na decyzję ---------- */}
      <section>
        <Pasek
          tytul="Na twoim biurku"
          opis={
            zaleglosci === 0
              ? "Nic nie czeka. Cała kolejka pusta."
              : `${zaleglosci} ${plural(zaleglosci, ["rzecz czeka", "rzeczy czeka", "rzeczy czeka"])} na decyzję.`
          }
        />

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kafel
            etykieta="Kolejka zgłoszeń"
            wartosc={dane.kolejka}
            nota={dane.kolejka_24h ? `${dane.kolejka_24h} z ostatniej doby` : "nic nowego od doby"}
            pilne={dane.kolejka > 0}
            onClick={() => onGoTo("queue")}
          />
          <Kafel
            etykieta="Błędy w danych"
            wartosc={dane.bledy}
            nota="zgłoszone przez ludzi"
            pilne={dane.bledy > 0}
            onClick={() => onGoTo("reports")}
          />
          <Kafel
            etykieta="Nowe opinie"
            wartosc={dane.opinie_nowe}
            nota="nieprzeczytane"
            pilne={dane.opinie_nowe > 0}
            onClick={() => onGoTo("feedback")}
          />
          <Kafel
            etykieta="Kandydaci OSM"
            wartosc={dane.kandydaci}
            nota="szare pinezki do sprawdzenia"
            onClick={() => onGoTo("leads")}
          />
        </div>
      </section>

      {/* ---------- pas 2: puls ---------- */}
      <section>
        <Pasek tytul="Puls" opis="Kto jest tu teraz i ile działo się dzisiaj." />

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="glass relative overflow-hidden rounded-[22px] p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-[50px]"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(var(--rgb-flame) / .4), transparent 100%)",
              }}
            />
            <p className="relative text-[11px] uppercase tracking-[0.16em] text-faint">
              Na stronie teraz
            </p>
            <p className="relative mt-2 flex items-baseline gap-2.5">
              <span className={`kropka-live ${dane.online > 0 ? "kropka-live-zywa" : ""}`} />
              <span className="flame-text text-[44px] font-bold leading-none tabular-nums">
                {dane.online}
              </span>
              <span className="text-[13px] text-muted">
                {plural(dane.online, ["osoba", "osoby", "osób"])}
              </span>
            </p>
            <p className="relative mt-3 text-[12px] leading-snug text-muted">
              Liczone z pulsu otwartych kart - kto odezwał się w ciągu ostatnich dwóch minut.
            </p>
          </div>

          <div className="glass grid grid-cols-2 gap-4 rounded-[22px] p-5">
            <Liczba etykieta="Goście dziś" wartosc={dane.goscie_dzis} nota="unikalne adresy" />
            <Liczba etykieta="Wczoraj" wartosc={dane.goscie_wczoraj} nota="dla porównania" />
            <Liczba etykieta="Odsłony dziś" wartosc={dane.odslony_dzis} nota="wszystkie wejścia" />
            <Liczba
              etykieta="Idą dziś grać"
              wartosc={dane.checkiny_dzis}
              nota="deklaracje na dziś"
            />
          </div>

          <div className="glass grid grid-cols-2 gap-4 rounded-[22px] p-5">
            <Liczba etykieta="Konta" wartosc={dane.konta} nota="wszystkie" />
            <Liczba
              etykieta="Nowe konta"
              wartosc={dane.konta_24h}
              nota="ostatnie 24 h"
            />
            <Liczba
              etykieta="Logowania"
              wartosc={dane.zalogowani_24h}
              nota="ostatnie 24 h"
            />
            <Liczba
              etykieta="Zapisy na otwarcie"
              wartosc={dane.zapisy_na_otwarcie}
              nota="adresy z zasłony"
            />
          </div>
        </div>
      </section>

      {/* ---------- pas 3: świeże treści ---------- */}
      <section className="grid gap-3 lg:grid-cols-2">
        <OstatnieBoiskoKafel dane={dane} teraz={teraz} />
        <OpinieKafel dane={dane} onGoTo={onGoTo} teraz={teraz} />
      </section>

      {/* ---------- pas 4: stan bazy ---------- */}
      <section>
        <Pasek tytul="Baza" opis="Ile jest na mapie i ile miejsca zostało." />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Liczba etykieta="Boiska" wartosc={dane.boiska} nota={`w ${dane.miast} miastach`} pudelko />
          <Liczba etykieta="Heat" wartosc={dane.boiska_heat} nota="wyróżnione" pudelko />
          <Liczba etykieta="Zdjęcia" wartosc={dane.zdjecia} nota="w Storage" pudelko />
          <Liczba etykieta="Podpalenia" wartosc={dane.podpalenia} nota="łącznie" pudelko />
          <Liczba
            etykieta="Bez zdjęć"
            wartosc={dane.boiska_bez_zdjec}
            nota="do uzupełnienia"
            pudelko
          />
          <Liczba
            etykieta="Zablokowani"
            wartosc={dane.zablokowani}
            nota="konta z banem"
            pudelko
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Pasmo
            etykieta="Zdjęcia w Storage"
            uzyte={dane.storage_bytes}
            limit={STORAGE_LIMIT}
          />
          <Pasmo etykieta="Baza danych" uzyte={dane.db_bytes} limit={DB_LIMIT} />
        </div>
      </section>

      <KonfiguracjaKafel />
    </div>
  );
}

interface Pozycja {
  klucz: string;
  ustawione: boolean;
  waga: "krytyczne" | "wazne" | "opcjonalne";
  skutek: string;
}

interface StanKonfiguracji {
  pozycje: Pozycja[];
  zaslona: boolean;
  srodowisko: string;
}

/**
 * Stan konfiguracji.
 *
 * Najgorsze awarie tego projektu nie polegały na tym, że coś rzucało błędem, tylko że coś
 * po cichu nie działało: brakująca zmienna od nadawcy poczty nie wywala niczego - po
 * prostu maile powitalne nie docierają. Ten kafelek istnieje po to, żeby takie rzeczy
 * dało się zobaczyć, a nie odkryć po miesiącu.
 *
 * Pokazujemy wyłącznie, czy zmienna JEST ustawiona - nigdy jej wartości.
 */
function KonfiguracjaKafel() {
  const [stan, setStan] = useState<StanKonfiguracji | null>(null);

  useEffect(() => {
    let aktualne = true;
    void (async () => {
      try {
        const res = await fetch("/api/konfiguracja");
        if (!res.ok) return;
        const dane = (await res.json()) as StanKonfiguracji;
        if (aktualne) setStan(dane);
      } catch {
        /* brak odpowiedzi nie może wywrócić kokpitu */
      }
    })();
    return () => {
      aktualne = false;
    };
  }, []);

  if (!stan) return null;

  const braki = stan.pozycje.filter((p) => !p.ustawione);
  const pilne = braki.filter((p) => p.waga !== "opcjonalne");

  return (
    <section>
      <Pasek
        tytul="Konfiguracja"
        opis={
          pilne.length
            ? `${pilne.length} ${plural(pilne.length, ["ustawienie wymaga", "ustawienia wymagają", "ustawień wymaga"])} uwagi.`
            : braki.length
              ? "Wszystko ważne ustawione, brakuje tylko dodatków."
              : "Wszystko ustawione."
        }
      />

      <div className="glass mt-4 rounded-[22px] p-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              stan.zaslona ? "bg-flame/15 text-flame" : "bg-white/10 text-muted"
            }`}
          >
            {stan.zaslona ? "zasłona włączona - serwis niewidoczny" : "serwis otwarty"}
          </span>
          <span className="text-faint">środowisko: {stan.srodowisko}</span>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {stan.pozycje.map((p) => (
            <li
              key={p.klucz}
              className={`rounded-2xl border px-3.5 py-2.5 ${
                p.ustawione
                  ? "border-hairline bg-white/4"
                  : p.waga === "opcjonalne"
                    ? "border-hairline bg-white/4"
                    : "border-ember/40 bg-ember/8"
              }`}
            >
              <p className="flex items-center gap-2 text-[12px] font-medium">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    p.ustawione
                      ? "bg-emerald-400"
                      : p.waga === "opcjonalne"
                        ? "bg-white/25"
                        : "bg-ember"
                  }`}
                />
                <code className="truncate">{p.klucz}</code>
              </p>
              {!p.ustawione && (
                <p className="mt-1 text-[11px] leading-snug text-muted">{p.skutek}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[11px] leading-snug text-faint">
          Zmienne ustawia się na Vercelu w Settings → Environment Variables. Pełna lista
          z opisami leży w repozytorium w pliku <code>.env.example</code>.
        </p>
      </div>
    </section>
  );
}

function Pasek({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">{tytul}</h2>
      <p className="text-[13px] text-muted">{opis}</p>
    </div>
  );
}

/**
 * Kafelek zaległości. Zero jest wyszarzone, cokolwiek powyżej - w kolorze marki, bo to
 * jedyne miejsce w panelu, gdzie liczba znaczy „zrób coś", a nie „tak jest".
 */
function Kafel({
  etykieta,
  wartosc,
  nota,
  pilne = false,
  onClick,
}: {
  etykieta: string;
  wartosc: number;
  nota: string;
  pilne?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass group relative overflow-hidden rounded-[22px] p-5 text-left transition hover:brightness-125 ${
        pilne ? "ring-1 ring-flame/35" : ""
      }`}
    >
      {pilne && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-1/2 h-28 w-[80%] -translate-x-1/2 blur-[36px]"
          style={{
            background: "radial-gradient(closest-side, rgb(var(--rgb-ember) / .42), transparent 100%)",
          }}
        />
      )}
      <p className="relative text-[11px] uppercase tracking-[0.14em] text-faint">{etykieta}</p>
      <p
        className={`relative mt-2 text-[40px] font-bold leading-none tabular-nums ${
          pilne ? "flame-text" : "text-ink/45"
        }`}
      >
        {wartosc}
      </p>
      <p className="relative mt-2 text-[12px] leading-snug text-muted">{nota}</p>
    </button>
  );
}

function Liczba({
  etykieta,
  wartosc,
  nota,
  pudelko = false,
}: {
  etykieta: string;
  wartosc: number;
  nota: string;
  /** własne szkło - do pasów, w których liczba nie siedzi w większej karcie */
  pudelko?: boolean;
}) {
  return (
    <div className={pudelko ? "glass rounded-[20px] p-4" : ""}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{etykieta}</p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none tabular-nums">{wartosc}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-faint">{nota}</p>
    </div>
  );
}

function Pasmo({ etykieta, uzyte, limit }: { etykieta: string; uzyte: number; limit: number }) {
  const pct = Math.min(100, (uzyte / limit) * 100);
  return (
    <div className="glass rounded-[20px] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-medium">{etykieta}</p>
        <p className="text-[12px] tabular-nums text-muted">
          {formatBytes(uzyte)} / {formatBytes(limit)}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${pct > 80 ? "bg-ember" : "flame-gradient"}`}
          style={{ width: `${Math.max(1.5, pct)}%` }}
        />
      </div>
    </div>
  );
}

/** Ostatnio dodane boisko - z kadrem tytułowym, bo po nim najszybciej widać jakość zgłoszeń. */
function OstatnieBoiskoKafel({ dane, teraz }: { dane: Kokpit; teraz: number }) {
  const b = dane.ostatnie_boisko;
  if (!b) return null;

  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
        {b.zdjecie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(b.zdjecie)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[13px] text-faint">
            bez zdjęcia
          </div>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(6,5,8,.94) 0%, rgba(6,5,8,.35) 46%, transparent 100%)",
          }}
        />
        <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-glow backdrop-blur">
          ostatnio dodane
        </span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="truncate text-[18px] font-semibold leading-tight">{b.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-kadr/70">
            <PinIcon className="h-3.5 w-3.5 text-flame" />
            {b.city} · {b.voivodeship}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[12px] text-muted">
          dodał <b className="text-ink">{b.autor}</b> · {czasWzgledny(b.kiedy, teraz)}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-glow">
            <FireBallIcon className="h-4 w-4" /> {b.likes}
          </span>
          <Link
            href={`/boisko/${b.slug}`}
            className="rounded-full border border-hairline px-3 py-1.5 text-[12px] text-muted transition hover:text-ink"
          >
            otwórz
          </Link>
        </div>
      </div>
    </div>
  );
}

function OpinieKafel({
  dane,
  onGoTo,
  teraz,
}: {
  dane: Kokpit;
  onGoTo: (w: string) => void;
  teraz: number;
}) {
  return (
    <div className="glass flex flex-col rounded-[22px] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] uppercase tracking-[0.16em] text-faint">Najnowsze opinie</h3>
        <button
          onClick={() => onGoTo("feedback")}
          className="text-[12px] uppercase tracking-[0.12em] text-muted transition hover:text-flame"
        >
          wszystkie
        </button>
      </div>

      {dane.opinie.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">Jeszcze nikt nic nie napisał.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {dane.opinie.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-hairline bg-white/4 px-4 py-3"
            >
              <p className="text-[13px] leading-snug text-ink/90">
                {o.message}
                {o.ucieta && <span className="text-faint">…</span>}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                <span>{o.autor}</span>
                <span>·</span>
                <span>{czasWzgledny(o.created_at, teraz)}</span>
                {o.status === "open" && (
                  <span className="rounded-full bg-flame/15 px-2 py-0.5 text-flame">nowa</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** „14 minut temu" zamiast daty - w kokpicie liczy się świeżość, nie kalendarz. */
function czasWzgledny(iso: string, teraz: number) {
  const minuty = Math.max(0, Math.round((teraz - new Date(iso).getTime()) / 60000));
  if (minuty < 1) return "przed chwilą";
  if (minuty < 60) return `${minuty} ${plural(minuty, ["minutę", "minuty", "minut"])} temu`;
  const godziny = Math.round(minuty / 60);
  if (godziny < 24) return `${godziny} ${plural(godziny, ["godzinę", "godziny", "godzin"])} temu`;
  const dni = Math.round(godziny / 24);
  if (dni < 30) return `${dni} ${plural(dni, ["dzień", "dni", "dni"])} temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}
