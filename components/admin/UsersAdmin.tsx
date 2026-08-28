"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  UsunieteKonto,
  useBanyIP,
  useUsunieteKonta,
  useUzytkownicy,
  useZablokowaneNicki,
} from "@/lib/uzytkownicy";
import { slugifyPlace } from "@/lib/site";

/**
 * Konta użytkowników: podgląd, blokowanie i odblokowywanie, plus lista słów zakazanych
 * w nickach.
 *
 * Blokada nie usuwa konta - osoba nadal może przeglądać serwis, ale baza odrzuca jej
 * wszystkie zapisy (zgłoszenia, podpalenia, ulubione, zapisy na grę, opinie, raporty).
 */
export function UsersAdmin() {
  const { items, loading, error, zablokuj, odblokuj, usun } = useUzytkownicy();
  const [szukaj, setSzukaj] = useState("");
  const [tylkoZablokowani, setTylkoZablokowani] = useState(false);
  const [powod, setPowod] = useState<Record<string, string>>({});
  const [blad, setBlad] = useState<string | null>(null);
  const [zajety, setZajety] = useState<string | null>(null);
  /** konto z rozwiniętym potwierdzeniem usunięcia - kasowanie jest nieodwracalne w jedno kliknięcie */
  const [doUsuniecia, setDoUsuniecia] = useState<string | null>(null);

  const widoczni = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase();
    return items.filter((u) => {
      if (tylkoZablokowani && !u.banned_at) return false;
      if (!fraza) return true;
      return (
        (u.display_name ?? "").toLowerCase().includes(fraza) ||
        (u.email ?? "").toLowerCase().includes(fraza)
      );
    });
  }, [items, szukaj, tylkoZablokowani]);

  const zablokowanych = items.filter((u) => u.banned_at).length;

  const dzialaj = async (fn: () => Promise<string | null>, id: string) => {
    setZajety(id);
    setBlad(await fn());
    setZajety(null);
  };

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję konta…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          placeholder="szukaj po nicku albo mailu…"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-flame/60 sm:max-w-[360px]"
        />
        <button
          onClick={() => setTylkoZablokowani((v) => !v)}
          className={`rounded-full px-5 py-2.5 text-[12px] font-medium transition ${
            tylkoZablokowani ? "bg-ember/20 text-ember" : "border border-hairline text-muted"
          }`}
        >
          Zablokowane ({zablokowanych})
        </button>
        <span className="text-[13px] text-faint">kont: {items.length}</span>
      </div>

      {blad && (
        <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}

      <ul className="space-y-2">
        {widoczni.map((u) => (
          <li
            key={u.id}
            className={`glass rounded-[20px] p-4 ${u.banned_at ? "border-ember/30" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Link
                    href={`/gracz/${slugifyPlace(u.display_name ?? "gracz")}`}
                    className="truncate text-[15px] font-semibold transition hover:text-flame"
                  >
                    {u.display_name ?? "bez nicku"}
                  </Link>
                  {u.role === "admin" && (
                    <span className="rounded-full flame-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                      admin
                    </span>
                  )}
                  {u.banned_at && (
                    <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ember">
                      zablokowany
                    </span>
                  )}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {u.email} · konto od{" "}
                  {new Date(u.created_at).toLocaleDateString("pl-PL")} · boiska: {u.courts} ·
                  podpalenia: {u.likes}
                </span>
                {u.banned_at && (
                  <span className="mt-1 block text-[12px] text-ember">
                    Zablokowany {new Date(u.banned_at).toLocaleDateString("pl-PL")}
                    {u.banned_reason ? `: ${u.banned_reason}` : ""}
                  </span>
                )}
              </span>

              {u.role === "admin" ? (
                <span className="shrink-0 text-[12px] text-faint">konto administratora</span>
              ) : u.banned_at ? (
                <button
                  onClick={() => void dzialaj(() => odblokuj(u.id), u.id)}
                  disabled={zajety === u.id}
                  className="shrink-0 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium text-muted transition hover:text-ink disabled:opacity-40"
                >
                  {zajety === u.id ? "…" : "Odblokuj"}
                </button>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  <input
                    value={powod[u.id] ?? ""}
                    onChange={(e) => setPowod((p) => ({ ...p, [u.id]: e.target.value }))}
                    placeholder="powód (opcjonalnie)"
                    className="w-[190px] rounded-full border border-hairline bg-white/6 px-4 py-2 text-[12px] outline-none transition focus:border-ember/60"
                  />
                  <button
                    onClick={() => void dzialaj(() => zablokuj(u.id, powod[u.id] ?? ""), u.id)}
                    disabled={zajety === u.id}
                    className="rounded-full border border-ember/50 px-4 py-2 text-[12px] font-medium text-ember transition hover:bg-ember/10 disabled:opacity-40"
                  >
                    {zajety === u.id ? "…" : "Zablokuj"}
                  </button>
                </span>
              )}

              {/*
                Usuwanie stoi osobno od blokady, także przy koncie już zablokowanym: to dwie
                różne rzeczy. Blokada zatrzymuje kogoś, kto psuje serwis; usunięcie to reset
                konta do stanu sprzed rejestracji - jedyny sposób, żeby przejść ścieżkę
                dołączania jeszcze raz tym samym adresem.
              */}
              {u.role !== "admin" && (
                <span className="shrink-0">
                  {doUsuniecia === u.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDoUsuniecia(null);
                          void dzialaj(() => usun(u.id), u.id);
                        }}
                        disabled={zajety === u.id}
                        className="rounded-full bg-ember px-4 py-2 text-[12px] font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                      >
                        {zajety === u.id ? "…" : "Na pewno usuń"}
                      </button>
                      <button
                        onClick={() => setDoUsuniecia(null)}
                        className="text-[12px] text-muted transition hover:text-ink"
                      >
                        anuluj
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDoUsuniecia(u.id)}
                      className="rounded-full border border-hairline px-4 py-2 text-[12px] font-medium text-faint transition hover:border-ember/50 hover:text-ember"
                    >
                      Usuń konto
                    </button>
                  )}
                </span>
              )}
            </div>

            {doUsuniecia === u.id && (
              <p className="mt-3 rounded-2xl border border-ember/30 bg-ember/8 px-4 py-3 text-[12px] leading-relaxed text-muted">
                Konto zniknie razem z wpisem w bazie logowania, więc ta osoba może zarejestrować
                się od nowa jak ktoś zupełnie nowy. Boiska, które dodała, zostają na mapie.
                Zdjęcie konta - kim była, które boiska dodała, co polubiła i jakie miała
                odznaczenia - leży w archiwum przez <b className="text-ink">180 dni</b> i można
                je stamtąd przywrócić.
              </p>
            )}
          </li>
        ))}
      </ul>

      {!widoczni.length && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Nic nie pasuje do tego filtra.
        </p>
      )}

      <Archiwum />
      <BlokadyIP />
      <ZablokowaneNicki />
    </div>
  );
}

/**
 * Archiwum usuniętych kont.
 *
 * Zdjęcie konta żyje 180 dni od skasowania, potem znika bezpowrotnie. Szukamy po tym samym
 * adresie, którym konto się logowało - to jedyna rzecz, która przeżywa usunięcie i po
 * której da się je rozpoznać.
 *
 * „Przywróć" nie odtwarza wpisu w bazie logowania: tamtej tożsamości (hasła, tokenów,
 * identyfikatorów u dostawcy) nie da się uczciwie sfabrykować. Zamiast tego doczepia
 * archiwum do konta o tym samym adresie - od razu, jeśli ta osoba zdążyła już wrócić,
 * albo przy jej najbliższym logowaniu, jeśli jeszcze nie.
 */
function Archiwum() {
  const { items, loading, error, przywroc } = useUsunieteKonta();
  const [szukaj, setSzukaj] = useState("");
  const [zajete, setZajete] = useState<string | null>(null);
  const [wiadomosc, setWiadomosc] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  /*
    Chwila obecna zamrożona przy pierwszym renderze. „Zostało 173 dni" nie może zmieniać
    się przy każdym przerysowaniu listy, a odczyt zegara w trakcie renderu to niestabilne
    wyjście z tej samej funkcji - stąd leniwy stan zamiast gołego `Date.now()`.
  */
  const [teraz] = useState(() => Date.now());

  const widoczne = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase();
    if (!fraza) return items;
    return items.filter(
      (k) =>
        (k.email ?? "").toLowerCase().includes(fraza) ||
        (k.display_name ?? "").toLowerCase().includes(fraza)
    );
  }, [items, szukaj]);

  const kliknij = async (k: UsunieteKonto) => {
    setZajete(k.id);
    setBlad(null);
    setWiadomosc(null);
    const wynik = await przywroc(k.id);
    setZajete(null);
    if (wynik.blad) setBlad(wynik.blad);
    else setWiadomosc(wynik.wiadomosc ?? null);
  };

  return (
    <div className="glass rounded-[24px] p-6">
      <h2 className="text-[17px] font-semibold tracking-tight">Usunięte konta</h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
        Zdjęcie każdego skasowanego konta leży tu przez 180 dni: kim była ta osoba, które
        boiska dodała, co polubiła i jakie miała odznaczenia. Po tym czasie znika
        bezpowrotnie. Szukaj po tym samym adresie, którym konto się logowało.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          placeholder="szukaj po mailu albo nicku…"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-flame/60 sm:max-w-[360px]"
        />
        <span className="text-[13px] text-faint">w archiwum: {items.length}</span>
      </div>

      {blad && (
        <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}
      {wiadomosc && (
        <p className="mt-4 rounded-2xl border border-flame/40 bg-flame/10 px-4 py-3 text-[13px] text-glow">
          {wiadomosc}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-[13px] text-muted">Wczytuję archiwum…</p>
      ) : !widoczne.length ? (
        <p className="mt-4 text-[13px] text-muted">
          {items.length ? "Nic nie pasuje do tej frazy." : "Archiwum jest puste."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {widoczne.map((k) => {
            const boiska = k.dane?.boiska ?? [];
            const dni = Math.max(
              0,
              Math.ceil((new Date(k.wygasa_at).getTime() - teraz) / 86_400_000)
            );
            return (
              <li
                key={k.id}
                className="rounded-[18px] border border-hairline bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">
                        {k.display_name ?? "bez nicku"}
                      </span>
                      {k.przywrocone_at && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                          przywrócone
                        </span>
                      )}
                      {k.oczekuje && !k.przywrocone_at && (
                        <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-flame">
                          czeka na powrót
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {k.email ?? "bez adresu"} · usunięte{" "}
                      {new Date(k.usuniete_at).toLocaleDateString("pl-PL")}
                      {!k.przywrocone_at && ` · znika za ${dni} dni`}
                    </span>
                    <span className="mt-1 block text-[12px] text-faint">
                      boiska: {boiska.length} · podpalenia:{" "}
                      {k.dane?.polubienia?.length ?? 0} · ulubione:{" "}
                      {k.dane?.ulubione?.length ?? 0} · deklaracje gry:{" "}
                      {k.dane?.checkinow ?? 0}
                    </span>
                    {boiska.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {boiska.slice(0, 6).map((b) => (
                          <Link
                            key={b.id}
                            href={`/boisko/${b.slug}`}
                            className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] text-muted transition hover:text-flame"
                          >
                            {b.name}
                          </Link>
                        ))}
                        {boiska.length > 6 && (
                          <span className="px-1 text-[11px] text-faint">
                            +{boiska.length - 6}
                          </span>
                        )}
                      </span>
                    )}
                  </span>

                  {k.przywrocone_at ? (
                    <span className="shrink-0 text-[12px] text-faint">
                      wróciło {new Date(k.przywrocone_at).toLocaleDateString("pl-PL")}
                    </span>
                  ) : (
                    <button
                      onClick={() => void kliknij(k)}
                      disabled={zajete === k.id}
                      className="shrink-0 rounded-full flame-gradient px-5 py-2 text-[12px] font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                    >
                      {zajete === k.id ? "…" : "Przywróć"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Blokady adresów IP - na wypadek, gdy ktoś psuje serwis bez konta (zgłoszenia, opinie
 * i raporty da się wysłać jako gość). Zablokowany adres nie wchodzi nawet na stronę.
 * Domyślnie na 30 dni, bo adresy krążą między abonentami i stare blokady trafiają
 * w niewinnych ludzi.
 */
function BlokadyIP() {
  const { items, zablokuj, usun } = useBanyIP();
  const [ip, setIp] = useState("");
  const [dni, setDni] = useState("30");
  const [powod, setPowod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  const zapisz = async () => {
    setZapisuje(true);
    const wynik = await zablokuj(ip, Number(dni), powod);
    setZapisuje(false);
    setBlad(wynik);
    if (!wynik) {
      setIp("");
      setPowod("");
      setDni("30");
    }
  };

  return (
    <div className="glass rounded-[24px] p-6">
      <h2 className="text-[17px] font-semibold tracking-tight">Blokady IP</h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
        Zablokowany adres dostaje stronę „Dostęp zablokowany” i nie widzi serwisu - to zapora
        na wypadek zgłoszeń i opinii wysyłanych bez konta. Adresy znajdziesz w logach Vercela
        (Deployments → Logs, kolumna z adresem klienta). Blokada wygasa sama.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={ip}
          onChange={(e) => {
            setIp(e.target.value);
            setBlad(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void zapisz();
          }}
          placeholder="np. 83.10.44.187"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-ember/60 sm:max-w-[220px]"
        />
        <span className="flex items-center gap-2">
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            className="w-[86px] rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] tabular-nums outline-none transition focus:border-ember/60"
          />
          <span className="text-[13px] text-muted">dni</span>
        </span>
        <input
          value={powod}
          onChange={(e) => setPowod(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void zapisz();
          }}
          placeholder="powód (opcjonalnie)"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-ember/60"
        />
        <button
          onClick={() => void zapisz()}
          disabled={zapisuje || !ip.trim()}
          className="shrink-0 rounded-2xl border border-ember/50 px-5 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-ember transition hover:bg-ember/10 disabled:opacity-40"
        >
          {zapisuje ? "Blokuję…" : "Zablokuj IP"}
        </button>
      </div>

      {blad && (
        <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}

      {items.length ? (
        <ul className="mt-5 space-y-2">
          {items.map((b) => (
            <li
              key={b.ip}
              className="flex items-center gap-4 rounded-[16px] border border-hairline px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium tabular-nums">
                  {b.ip}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  blokada do {new Date(b.banned_until).toLocaleDateString("pl-PL")}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
              </span>
              <button
                onClick={() => void usun(b.ip)}
                className="shrink-0 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium text-muted transition hover:text-ink"
              >
                Zdejmij
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-[13px] text-faint">Brak zablokowanych adresów.</p>
      )}
    </div>
  );
}

/** Słowa, których nie wolno użyć w nicku - sprawdza je wyzwalacz przy każdej zmianie. */
function ZablokowaneNicki() {
  const { items, dodaj, usun } = useZablokowaneNicki();
  const [slowo, setSlowo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);

  const zapisz = async () => {
    const wynik = await dodaj(slowo);
    setBlad(wynik);
    if (!wynik) setSlowo("");
  };

  return (
    <div className="glass rounded-[24px] p-6">
      <h2 className="text-[17px] font-semibold tracking-tight">Zablokowane nicki</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Fragmenty, których nie wolno użyć w nicku - sprawdzane są jako części słowa, więc
        „kurw” łapie też „kurwa” i „skurwiel”. Administratora ta lista nie dotyczy.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={slowo}
          onChange={(e) => {
            setSlowo(e.target.value);
            setBlad(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void zapisz();
          }}
          placeholder="nowe słowo"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-flame/60 sm:max-w-[260px]"
        />
        <button
          onClick={() => void zapisz()}
          disabled={!slowo.trim()}
          className="shrink-0 rounded-2xl border border-hairline px-5 py-3 text-[13px] font-medium text-muted transition hover:text-ink disabled:opacity-40"
        >
          Dodaj słowo
        </button>
      </div>

      {blad && (
        <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {blad}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((s) => (
          <button
            key={s.word}
            onClick={() => void usun(s.word)}
            title="kliknij, żeby usunąć"
            className="rounded-full border border-hairline px-3 py-1.5 text-[12px] text-muted transition hover:border-ember/50 hover:text-ember"
          >
            {s.word} ×
          </button>
        ))}
      </div>
    </div>
  );
}
