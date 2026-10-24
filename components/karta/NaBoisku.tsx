"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PROMIEN_MELDUNKU_M,
  dajProps,
  naBoisku,
  powodOdmowy,
  ustawWidocznosc,
  wymelduj,
  zamelduj,
  type GraczNaBoisku,
  type StanNaBoisku,
} from "@/lib/krol";
import { MAKS_NIEPEWNOSC_M, odlegloscM } from "@/lib/obecnosc";

/** Co ile odświeżamy listę ludzi na boisku, gdy strona jest otwarta. */
const ODSWIEZ_MS = 60_000;
/** Ponowne potwierdzenie obecności po powrocie do karty - nie częściej niż co tyle. */
const PONOW_MS = 5 * 60_000;

/**
 * Obecność na boisku: automatyczny meldunek GPS-em i lista innych zameldowanych.
 *
 * Meldunek bez klikania działa tylko wtedy, gdy przeglądarka MA JUŻ zgodę na lokalizację -
 * pytanie o zgodę wolno zadać wyłącznie po dotknięciu (inaczej dostaje „zablokuj” i nie da
 * się go zadać ponownie). Bez zgody meldunek robi przycisk „Jestem na boisku”.
 */
export function useMeldunek(courtId: string, pin: { lat: number; lng: number }, zalogowany: boolean) {
  const [stan, setStan] = useState<StanNaBoisku | null>(null);
  const [szukam, setSzukam] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const ostatniaProba = useRef(0);

  const odswiez = useCallback(async () => {
    const s = await naBoisku(courtId).catch(() => null);
    if (s) setStan(s);
    return s;
  }, [courtId]);

  /** `reczne` - po dotknięciu: wolno zapytać o zgodę i pokazać, czemu się nie udało */
  const sprobuj = useCallback(
    (reczne: boolean) => {
      if (!navigator.geolocation) {
        if (reczne) setBlad("Ta przeglądarka nie udostępnia lokalizacji.");
        return;
      }
      ostatniaProba.current = Date.now();
      if (reczne) {
        setSzukam(true);
        setBlad(null);
      }
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const odczyt = { lat: p.coords.latitude, lng: p.coords.longitude, dokladnosc: p.coords.accuracy };
          const daleko = odlegloscM(odczyt, pin) > PROMIEN_MELDUNKU_M + 40;
          /* w domu nie pytamy bazy na próżno - automat po prostu nic nie robi */
          if (!reczne && (daleko || odczyt.dokladnosc > MAKS_NIEPEWNOSC_M)) return;
          const w = await zamelduj(courtId, odczyt);
          setSzukam(false);
          if (w.ok) {
            await odswiez();
          } else if (reczne) {
            setBlad(powodOdmowy(w));
          }
        },
        () => {
          setSzukam(false);
          if (reczne) setBlad("Nie udało się pobrać lokalizacji. Sprawdź, czy przeglądarka ma na nią zgodę.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30_000 }
      );
    },
    [courtId, pin, odswiez]
  );

  /* po wejściu na kartę: stan z bazy, a przy zgodzie na lokalizację - cichy meldunek */
  useEffect(() => {
    if (!zalogowany) return;
    let zywy = true;
    const auto = async () => {
      const s = await odswiez();
      if (!zywy) return;
      const zgoda = await navigator.permissions?.query({ name: "geolocation" as PermissionName }).catch(() => null);
      if (zywy && zgoda?.state === "granted" && Date.now() - ostatniaProba.current > PONOW_MS) sprobuj(false);
      void s;
    };
    void auto();
    const naPowrot = () => {
      if (document.visibilityState === "visible") void auto();
    };
    document.addEventListener("visibilitychange", naPowrot);
    return () => {
      zywy = false;
      document.removeEventListener("visibilitychange", naPowrot);
    };
  }, [zalogowany, odswiez, sprobuj]);

  /* na boisku lista odświeża się co minutę, póki karta jest na wierzchu */
  useEffect(() => {
    if (!stan?.jestem) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void odswiez();
    }, ODSWIEZ_MS);
    return () => window.clearInterval(t);
  }, [stan?.jestem, odswiez]);

  const wychodze = async () => {
    await wymelduj(courtId);
    await odswiez();
  };

  const pokazMnie = async (pokaz: boolean) => {
    setStan((s) => (s ? { ...s, pokaz } : s));
    await ustawWidocznosc(pokaz);
    await odswiez();
  };

  const props = async (komu: string) => {
    setStan((s) => (s ? { ...s, gracze: s.gracze.map((g) => (g.id === komu ? { ...g, props: true } : g)) } : s));
    const ok = await dajProps(courtId, komu);
    if (!ok) await odswiez();
  };

  return { stan, jestem: Boolean(stan?.jestem), szukam, blad, sprobuj, wychodze, pokazMnie, props, odswiez };
}

export type Meldunek = ReturnType<typeof useMeldunek>;

/* ---------- wygląd ---------- */

const GRADIENTY = [
  ["#f6d365", "#e2a400"],
  ["#a8edea", "#2bb3a3"],
  ["#c3b1ff", "#7b5cff"],
  ["#ffb3c7", "#ff4f7b"],
  ["#9be7ff", "#2f8cff"],
  ["#ffb25c", "#ff4d0a"],
];
const gradient = (nick: string) => GRADIENTY[[...nick].reduce((s, z) => s + z.charCodeAt(0), 0) % GRADIENTY.length];

/** Korona Króla Boiska - złota, z ciemną kreską, żeby było ją widać na zdjęciu i na tle. */
export function IkKorona({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-2 11H5z" fill="#f2c94c" stroke="#7a5500" strokeWidth=".8" strokeLinejoin="round" />
    </svg>
  );
}

export function AwatarGracza({ nick, avatar, rozmiar = 40, krol = false }: { nick: string; avatar: string | null; rozmiar?: number; krol?: boolean }) {
  const [a, b] = gradient(nick);
  return (
    <span className="kb-gracz-aw" style={{ width: rozmiar, height: rozmiar, fontSize: Math.round(rozmiar * 0.42), background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" />
      ) : (
        nick.slice(0, 1).toUpperCase()
      )}
      {krol && (
        <span className="kb-gracz-korona" style={{ width: Math.round(rozmiar * 0.5), height: Math.round(rozmiar * 0.5) }}>
          <IkKorona className="h-full w-full" />
        </span>
      )}
    </span>
  );
}

/* miejsca na rysunku boiska (w procentach) - kolejni gracze stają w tych punktach */
const MIEJSCA: [number, number][] = [
  [24, 34], [70, 64], [78, 28], [36, 70], [56, 30], [16, 66], [86, 72], [48, 52],
];

const godzina = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/**
 * Wnętrze rozwiniętego przycisku na boisku (prototyp 08): rysunek boiska z awatarami
 * zameldowanych, pod nim wybrany gracz z propsem i wyzwaniem 1 na 1.
 */
export function PanelNaBoisku({ m, nick }: { m: Meldunek; nick: string }) {
  const [wybrany, setWybrany] = useState<string | null>(null);
  const s = m.stan;
  if (!s) return null;

  if (s.pokaz === null) {
    return (
      <div className="kb-boisko-zgoda">
        <p className="text-[15px] font-semibold">Pokazywać Cię innym na boisku?</p>
        <p className="mt-1.5 text-[13px] leading-snug text-muted">
          Zobaczą Cię tylko osoby, które też są teraz zameldowane na tym boisku - tylko nick. Dzięki temu możesz dawać
          i dostawać propsy i walczyć o koronę Króla Boiska. Zawsze możesz to wyłączyć.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="kb-boisko-btn" onClick={() => void m.pokazMnie(false)}>
            Nie teraz
          </button>
          <button type="button" className="kb-boisko-btn kb-boisko-btn-jasny" onClick={() => void m.pokazMnie(true)}>
            Tak, pokazuj
          </button>
        </div>
      </div>
    );
  }

  if (s.pokaz === false) {
    return (
      <div className="kb-boisko-zgoda">
        <p className="text-[15px] font-semibold">Jesteś ukryty</p>
        <p className="mt-1.5 text-[13px] leading-snug text-muted">
          Nie widzisz innych na boisku, oni nie widzą Ciebie i nie ma Cię w rankingu bywalców.
        </p>
        <button type="button" className="kb-boisko-btn kb-boisko-btn-jasny mt-3 w-full" onClick={() => void m.pokazMnie(true)}>
          Pokaż mnie innym na boisku
        </button>
      </div>
    );
  }

  const gracze = s.gracze;
  const g: GraczNaBoisku | undefined = gracze.find((x) => x.id === wybrany) ?? gracze[0];

  return (
    <div>
      <div className="kb-boisko-plac">
        <svg viewBox="0 0 160 100" fill="none" stroke="currentColor" strokeWidth=".8" aria-hidden>
          <rect x="2" y="2" width="156" height="96" rx="3" />
          <line x1="80" y1="2" x2="80" y2="98" />
          <circle cx="80" cy="50" r="12" />
          <path d="M2 20h22a30 30 0 0 1 0 60H2M158 20h-22a30 30 0 0 0 0 60h22" />
        </svg>
        {gracze.slice(0, MIEJSCA.length).map((x, i) => (
          <button
            key={x.id}
            type="button"
            className="kb-boisko-gracz"
            data-wybrany={x.id === g?.id}
            style={{ left: `${MIEJSCA[i][0]}%`, top: `${MIEJSCA[i][1]}%` }}
            onClick={() => setWybrany(x.id)}
            aria-label={`@${x.nick}`}
          >
            <AwatarGracza nick={x.nick} avatar={x.avatar} rozmiar={36} krol={x.krol} />
            <span>@{x.nick.split(/[._\s]/)[0]}</span>
          </button>
        ))}
        <span className="kb-boisko-gracz kb-boisko-ja" style={{ left: "46%", top: "84%" }}>
          <AwatarGracza nick={nick} avatar={null} rozmiar={30} />
          <span>Ty</span>
        </span>
      </div>

      {g ? (
        <div className="kb-boisko-wybrany">
          <AwatarGracza nick={g.nick} avatar={g.avatar} rozmiar={42} krol={g.krol} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px]">@{g.nick}</b>
            <small className="block text-[12px] text-faint">
              na boisku od {godzina(g.od)}
              {g.krol ? " · Król Boiska" : ""}
            </small>
          </span>
          <span className="kb-boisko-akcje">
            <button
              type="button"
              className="kb-boisko-btn"
              data-dany={g.props}
              disabled={g.props}
              onClick={() => void m.props(g.id)}
            >
              {g.props ? "Props dany ✓" : "Daj propsa"}
            </button>
            <button type="button" className="kb-boisko-btn" disabled title="Wyzwania 1 na 1 - wkrótce">
              1 na 1 · wkrótce
            </button>
          </span>
        </div>
      ) : (
        <p className="mt-3 px-1 text-[13px] leading-snug text-muted">
          Na razie jesteś tu sam. Gdy ktoś się zamelduje, zobaczysz go na boisku powyżej.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <button type="button" className="text-[12.5px] font-semibold text-muted" onClick={() => void m.pokazMnie(false)}>
          Ukryj mnie
        </button>
        <button type="button" className="kb-boisko-btn" onClick={() => void m.wychodze()}>
          Wychodzę
        </button>
      </div>
    </div>
  );
}

/** Podpis pod „Jesteś na boisku”: „@Kuba i 2 inne osoby” / „na razie sam”. */
export function podpisNaBoisku(s: StanNaBoisku | null): string {
  if (!s?.jestem) return "";
  if (s.pokaz !== true) return "dotknij, żeby zobaczyć innych";
  const n = s.gracze.length;
  if (!n) return "na razie sam · dotknij";
  const pierwszy = `@${s.gracze[0].nick}`;
  if (n === 1) return `jest też ${pierwszy} · dotknij`;
  return `${pierwszy} i ${n - 1} ${n - 1 === 1 ? "inna osoba" : n - 1 < 5 ? "inne osoby" : "innych osób"} · dotknij`;
}
