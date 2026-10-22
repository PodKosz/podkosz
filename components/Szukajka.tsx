"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MapCourt } from "@/lib/types";
import { normalize } from "@/lib/filters";
import { SZUKANIE_W_BAZIE_OD, szukajWBazie } from "@/lib/adres";
import { type CelMapy, type Miejsce, odlegloscKm, odlegloscTekst } from "@/lib/miejsca";
import { BallIcon, CityIcon, CloseIcon, LocateIcon, PinIcon, SearchIcon, StreetIcon } from "./icons";

type Wynik = { klucz: string; boisko?: MapCourt; miejsce?: Miejsce };

const IKONA_MIEJSCA = { adres: PinIcon, ulica: StreetIcon, miejscowosc: CityIcon };

/*
  Środek oglądanej mapy przesuwa podpowiedzi adresów w stronę okolicy - ale dopiero przy
  przybliżeniu. Przy widoku całej Polski środek wypada pod Łodzią i „Marszałkowska 10”
  podpowiadało najpierw łódzką, a warszawskiej nie było wcale. Mapa trzyma kadr w adresie
  strony (`m=lat,lng,zoom`), więc nie trzeba jej o nic pytać.
*/
function srodekMapy() {
  const m = new URLSearchParams(window.location.search).get("m")?.split(",").map(Number);
  if (!m || m.length < 3 || m.some((x) => !Number.isFinite(x)) || m[2] < 9) return null;
  return { lat: m[0], lng: m[1] };
}

/** pogrubia pierwsze trafienie - `normalize` zamienia znak na znak, więc pozycje się zgadzają */
function Wyroznienie({ tekst, q }: { tekst: string; q: string }) {
  const szukane = normalize(q.trim());
  const i = szukane ? normalize(tekst).indexOf(szukane) : -1;
  if (i < 0) return <>{tekst}</>;
  return (
    <>
      {tekst.slice(0, i)}
      <mark>{tekst.slice(i, i + szukane.length)}</mark>
      {tekst.slice(i + szukane.length)}
    </>
  );
}

/**
 * Wyszukiwarka na mapie: boiska po nazwie i mieście, a do tego adresy, ulice i miejscowości.
 *
 * Nie filtruje pinezek - prowadzi. Wybrane boisko: mapa leci do niego i je podświetla.
 * Wybrany adres (albo „moja lokalizacja” z przycisku po prawej): mapa leci na miejsce, stawia
 * białą kropkę, a pod polem pojawiają się trzy najbliższe boiska z odległościami. Wcześniej
 * pole filtrowało pinezki po nazwie, więc wpisanie ulicy czyściło całą mapę - nazwa ulicy
 * nie pasowała do żadnego boiska.
 *
 * Pole jest symetryczne: lupa po lewej, po prawej przycisk tej samej szerokości - lokalizacja,
 * a w trakcie pisania czyszczenie.
 */
export function Szukajka({
  boiska,
  onBoisko,
  onMiejsce,
  onWyczysc,
  onFocus,
}: {
  /** wszystkie boiska - podpowiedzi nazw i liczenie najbliższych */
  boiska: MapCourt[];
  onBoisko: (c: MapCourt) => void;
  onMiejsce: (cel: CelMapy) => void;
  /** pole wyczyszczone albo lista najbliższych zamknięta - znika kropka na mapie */
  onWyczysc: () => void;
  /** na telefonie wejście w pole rozwija arkusz, żeby podpowiedzi miały miejsce */
  onFocus?: () => void;
}) {
  const id = useId();
  const korzen = useRef<HTMLDivElement>(null);
  const pole = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [otwarta, setOtwarta] = useState(false);
  const [miejsca, setMiejsca] = useState<{ q: string; lista: Miejsce[] } | null>(null);
  const [zBazy, setZBazy] = useState<{ q: string; ids: string[] } | null>(null);
  const [zaznaczony, setZaznaczony] = useState(0);
  const [blisko, setBlisko] = useState<{ tytul: string; lat: number; lng: number } | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const zapytanie = q.trim();
  const duzaBaza = boiska.length >= SZUKANIE_W_BAZIE_OD;

  /* boiska: przy kilkudziesięciu wpisach w przeglądarce, przy dużej bazie - indeks w bazie */
  const pasujaceBoiska = useMemo(() => {
    if (zapytanie.length < 2) return [];
    if (duzaBaza) {
      if (zBazy?.q !== zapytanie) return [];
      const wgId = new Map(boiska.map((c) => [c.id, c]));
      return zBazy.ids.flatMap((i) => wgId.get(i) ?? []).slice(0, 4);
    }
    const slowa = normalize(zapytanie).split(/\s+/);
    return boiska.filter((c) => slowa.every((s) => normalize(`${c.name} ${c.city}`).includes(s))).slice(0, 4);
  }, [boiska, duzaBaza, zapytanie, zBazy]);

  useEffect(() => {
    if (!duzaBaza || zapytanie.length < 2) return;
    let aktualne = true;
    szukajWBazie(zapytanie, 4)
      .then((ids) => aktualne && setZBazy({ q: zapytanie, ids }))
      .catch(() => undefined);
    return () => {
      aktualne = false;
    };
  }, [duzaBaza, zapytanie]);

  /* adresy: po pauzie w pisaniu, od trzech znaków; starsze odpowiedzi przerywamy */
  useEffect(() => {
    if (zapytanie.length < 3) return;
    const przerwij = new AbortController();
    const zwloka = window.setTimeout(async () => {
      const parametry = new URLSearchParams({ q: zapytanie });
      const srodek = srodekMapy();
      if (srodek) {
        parametry.set("lat", String(srodek.lat));
        parametry.set("lng", String(srodek.lng));
      }
      try {
        const res = await fetch(`/api/miejsca?${parametry}`, { signal: przerwij.signal });
        const dane = (await res.json()) as { miejsca?: Miejsce[] };
        setMiejsca({ q: zapytanie, lista: dane.miejsca ?? [] });
      } catch {
        if (!przerwij.signal.aborted) setMiejsca({ q: zapytanie, lista: [] });
      }
    }, 220);
    return () => {
      window.clearTimeout(zwloka);
      przerwij.abort();
    };
  }, [zapytanie]);

  const aktualneMiejsca = miejsca?.q === zapytanie ? miejsca.lista : [];
  const wyniki: Wynik[] = [
    ...pasujaceBoiska.map((c) => ({ klucz: `b-${c.id}`, boisko: c })),
    ...aktualneMiejsca.map((m, i) => ({ klucz: `m-${i}`, miejsce: m })),
  ];
  const czekamNaAdresy = zapytanie.length >= 3 && miejsca?.q !== zapytanie;

  /* klik poza wyszukiwarką zamyka podpowiedzi */
  useEffect(() => {
    if (!otwarta) return;
    const poza = (e: MouseEvent | TouchEvent) => {
      if (!korzen.current?.contains(e.target as Node)) setOtwarta(false);
    };
    document.addEventListener("mousedown", poza);
    document.addEventListener("touchstart", poza, { passive: true });
    return () => {
      document.removeEventListener("mousedown", poza);
      document.removeEventListener("touchstart", poza);
    };
  }, [otwarta]);

  const najblizsze = useMemo(
    () =>
      blisko
        ? boiska
            .map((c) => ({ c, km: odlegloscKm(blisko, c) }))
            .sort((a, b) => a.km - b.km)
            .slice(0, 3)
        : [],
    [blisko, boiska]
  );

  function wybierz(w: Wynik) {
    setOtwarta(false);
    pole.current?.blur();
    if (w.boisko) {
      setQ(w.boisko.name);
      setBlisko(null);
      onBoisko(w.boisko);
    } else if (w.miejsce) {
      const m = w.miejsce;
      setQ(m.nazwa);
      setBlisko({ tytul: m.nazwa, lat: m.lat, lng: m.lng });
      onMiejsce({ lat: m.lat, lng: m.lng, zoom: m.zoom, znacznik: true });
    }
  }

  function wyczysc() {
    setQ("");
    setBlisko(null);
    setBlad(null);
    onWyczysc();
    pole.current?.focus();
  }

  function lokalizuj() {
    setBlad(null);
    if (!navigator.geolocation) {
      setBlad("Ta przeglądarka nie udostępnia lokalizacji.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const punkt = { lat: p.coords.latitude, lng: p.coords.longitude };
        setBlisko({ tytul: "Twoja lokalizacja", ...punkt });
        onMiejsce({ ...punkt, zoom: 14, znacznik: true });
      },
      () => setBlad("Nie udało się ustalić lokalizacji - sprawdź zgodę w przeglądarce."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }

  function klawisz(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!wyniki.length) return;
      setOtwarta(true);
      setZaznaczony((z) => (z + (e.key === "ArrowDown" ? 1 : -1) + wyniki.length) % wyniki.length);
    } else if (e.key === "Enter") {
      const w = wyniki[Math.min(zaznaczony, wyniki.length - 1)];
      if (w) wybierz(w);
    } else if (e.key === "Escape") {
      setOtwarta(false);
    }
  }

  const listaId = `${id}-lista`;
  const pokazListe = otwarta && zapytanie.length > 0;

  const wiersz = (w: Wynik, i: number) => {
    const Ikona = w.boisko ? BallIcon : IKONA_MIEJSCA[w.miejsce!.rodzaj];
    const t1 = w.boisko ? w.boisko.name : w.miejsce!.nazwa;
    const t2 = w.boisko ? w.boisko.city : w.miejsce!.opis;
    return (
      <button
        id={`${id}-${i}`}
        type="button"
        role="option"
        aria-selected={i === zaznaczony}
        className="szukajka-wynik"
        /* mousedown, nie click: pole nie traci fokusu, zanim wybór się wykona */
        onMouseDown={(e) => {
          e.preventDefault();
          wybierz(w);
        }}
        onMouseEnter={() => setZaznaczony(i)}
      >
        <span className="szukajka-ikona">
          <Ikona className="h-[17px] w-[17px]" />
        </span>
        <span className="min-w-0">
          <span className="szukajka-t1">
            <Wyroznienie tekst={t1} q={zapytanie} />
          </span>
          {t2 ? <span className="szukajka-t2">{t2}</span> : null}
        </span>
      </button>
    );
  };

  return (
    <div ref={korzen} className="szukajka">
      <div className="szukajka-pole">
        <SearchIcon className="h-[19px] w-[19px]" aria-hidden />
        <input
          ref={pole}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOtwarta(true);
            setZaznaczony(0);
          }}
          onFocus={() => {
            if (q) setOtwarta(true);
            onFocus?.();
          }}
          onKeyDown={klawisz}
          placeholder="Szukaj boiska, miasta lub ulicy"
          aria-label="Szukaj boiska, miasta lub ulicy"
          role="combobox"
          aria-expanded={pokazListe}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={pokazListe && wyniki.length ? `${id}-${zaznaczony}` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <button
          type="button"
          onClick={q ? wyczysc : lokalizuj}
          className="szukajka-przycisk"
          aria-label={q ? "Wyczyść" : "Moja lokalizacja"}
          title={q ? "Wyczyść" : "Pokaż boiska koło mnie"}
        >
          {q ? <CloseIcon className="h-[18px] w-[18px]" /> : <LocateIcon className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {pokazListe && (
        <div id={listaId} role="listbox" className="szukajka-lista">
          {pasujaceBoiska.length > 0 && <div className="szukajka-grupa">Boiska</div>}
          {wyniki.map((w, i) => (
            <Fragment key={w.klucz}>
              {w.miejsce && i === pasujaceBoiska.length && <div className="szukajka-grupa">Miejsca i adresy</div>}
              {wiersz(w, i)}
            </Fragment>
          ))}
          {!wyniki.length && (
            <div className="szukajka-pusto">
              {zapytanie.length < 3
                ? "Wpisz nazwę boiska, miasto albo ulicę"
                : czekamNaAdresy
                  ? "Szukam…"
                  : "Nic nie znaleźliśmy - spróbuj inaczej"}
            </div>
          )}
          {/* dane adresowe są z OpenStreetMap - licencja ODbL wymaga podpisu */}
          <div className="szukajka-stopka">adresy © OpenStreetMap</div>
        </div>
      )}

      {blad && <p className="szukajka-blad">{blad}</p>}

      {blisko && najblizsze.length > 0 && (
        <div className="szukajka-blisko">
          <div className="szukajka-blisko-gora">
            <span className="min-w-0 flex-1 truncate">
              Najbliżej: <b>{blisko.tytul}</b>
            </span>
            <button
              type="button"
              onClick={() => {
                setBlisko(null);
                onWyczysc();
              }}
              className="szukajka-przycisk h-7 w-7"
              aria-label="Zamknij listę najbliższych boisk"
            >
              <CloseIcon className="h-[15px] w-[15px]" />
            </button>
          </div>
          {najblizsze.map(({ c, km }) => (
            <button key={c.id} type="button" onClick={() => onBoisko(c)} className="szukajka-wynik">
              <span className="szukajka-ikona">
                <BallIcon className="h-[17px] w-[17px]" />
              </span>
              <span className="min-w-0">
                <span className="szukajka-t1">{c.name}</span>
                <span className="szukajka-t2">{c.city}</span>
              </span>
              <span className="szukajka-od">{odlegloscTekst(km)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
