"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { photoUrl } from "@/lib/supabase/config";
import { godziny, kiedy, plakietka, stanWydarzenia, type Wydarzenie } from "@/lib/wydarzenia";

/**
 * Kreator wydarzeń - jedyne miejsce, z którego wydarzenie powstaje.
 *
 * Wydarzenie zapala na mapie pinezkę kilka razy większą od pozostałych, biało-czerwoną
 * i płonącą. To narzędzie promocyjne o dużej sile rażenia, więc trzyma się w panelu
 * administratora i baza pilnuje tego samego (polityka `wydarzenia_admin`).
 *
 * ------------------------------------------------------------------ kolejność zapisu
 *
 * Najpierw wiersz, potem plakat, na końcu poprawka wiersza o ścieżkę pliku - w tej
 * kolejności, bo ścieżka pliku zawiera identyfikator wydarzenia, a ten powstaje w bazie.
 * Gdyby plakat leciał pierwszy, przy nieudanym zapisie wiersza zostawałby w Storage plik,
 * do którego nic nie prowadzi.
 */

interface Boisko {
  id: string;
  name: string;
  city: string;
  slug: string;
}

interface WpisZBoiskiem extends Wydarzenie {
  boisko: Boisko | null;
}

const CZERWIEN = "#e8112d";

/** `datetime-local` chce „YYYY-MM-DDTHH:mm" w czasie lokalnym, a nie ISO w UTC. */
function naPoleDaty(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function domyslnyPoczatek() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return naPoleDaty(d);
}

function domyslnyKoniec() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return naPoleDaty(d);
}

type Wiersz = {
  id: string;
  court_id: string;
  nazwa: string;
  opis: string | null;
  poczatek: string;
  koniec: string;
  zdjecie: string | null;
  courts: { name: string; city: string; slug: string } | null;
};

/**
 * Pobranie listy - funkcja czysta, bez ani jednego `setState`.
 *
 * Taki sam wzór, jak w pozostałych zakładkach panelu, i nie z upodobania do symetrii:
 * `setState` wywołane wprost w ciele efektu wywołuje kolejny render zaraz po poprzednim.
 * Stan ustawiamy więc dopiero w wywołaniu zwrotnym, po `await`.
 */
async function pobierzListe(): Promise<{ items: WpisZBoiskiem[]; error: string | null }> {
  const supabase = await supabaseBrowser();
  if (!supabase) return { items: [], error: "Wydarzenia wymagają podpiętej bazy." };

  const { data, error } = await supabase
    .from("wydarzenia")
    .select("id, court_id, nazwa, opis, poczatek, koniec, zdjecie, courts(name, city, slug)")
    .order("poczatek", { ascending: true });

  const items = ((data ?? []) as unknown as Wiersz[]).map((w) => ({
    id: w.id,
    courtId: w.court_id,
    nazwa: w.nazwa,
    opis: w.opis ?? "",
    poczatek: w.poczatek,
    koniec: w.koniec,
    zdjecie: w.zdjecie,
    boisko: w.courts ? { id: w.court_id, ...w.courts } : null,
  }));

  return { items, error: error ? error.message : null };
}

export function WydarzeniaAdmin() {
  const [lista, setLista] = useState<WpisZBoiskiem[]>([]);
  const [laduje, setLaduje] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [komunikat, setKomunikat] = useState<string | null>(null);
  /** licznik odświeżeń - podniesienie go przeładowuje listę */
  const [odswiezenie, setOdswiezenie] = useState(0);

  /* formularz */
  const [szukaj, setSzukaj] = useState("");
  const [wyniki, setWyniki] = useState<Boisko[]>([]);
  const [boisko, setBoisko] = useState<Boisko | null>(null);
  const [nazwa, setNazwa] = useState("");
  const [opis, setOpis] = useState("");
  const [poczatek, setPoczatek] = useState(domyslnyPoczatek);
  const [koniec, setKoniec] = useState(domyslnyKoniec);
  const [plik, setPlik] = useState<File | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  useEffect(() => {
    let aktualne = true;

    void (async () => {
      const wynik = await pobierzListe();
      if (!aktualne) return;
      setLista(wynik.items);
      setBlad(wynik.error);
      setLaduje(false);
    })();

    return () => {
      aktualne = false;
    };
  }, [odswiezenie]);

  /* wyszukiwanie boiska - po nazwie i po mieście, bo tak się o boiskach mówi */
  useEffect(() => {
    const fraza = szukaj.trim();
    let aktualne = true;

    /*
      Czyszczenie i pytanie do bazy siedzą OBA w opóźnieniu, nie w ciele efektu:
      `setState` wywołane wprost w efekcie wywołuje kolejny render zaraz po poprzednim
      (i słusznie krzyczy o to reguła `set-state-in-effect`).
    */
    const czas = window.setTimeout(async () => {
      if (fraza.length < 2) {
        if (aktualne) setWyniki([]);
        return;
      }
      const supabase = await supabaseBrowser();
      if (!supabase) return;
      const { data } = await supabase
        .from("courts")
        .select("id, name, city, slug")
        .or(`name.ilike.%${fraza}%,city.ilike.%${fraza}%`)
        .limit(8);
      if (aktualne) setWyniki((data ?? []) as Boisko[]);
    }, 250);

    return () => {
      aktualne = false;
      window.clearTimeout(czas);
    };
  }, [szukaj]);

  const zapisz = async () => {
    setBlad(null);
    setKomunikat(null);

    if (!boisko) return setBlad("Wybierz boisko.");
    if (nazwa.trim().length < 2) return setBlad("Nazwa wydarzenia jest za krótka.");
    if (!poczatek || !koniec) return setBlad("Podaj początek i koniec.");
    if (new Date(koniec) <= new Date(poczatek)) {
      return setBlad("Koniec musi być po początku.");
    }

    const supabase = await supabaseBrowser();
    if (!supabase) return setBlad("Brak połączenia z bazą.");

    setZapisuje(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("wydarzenia")
        .insert({
          court_id: boisko.id,
          nazwa: nazwa.trim(),
          opis: opis.trim(),
          poczatek: new Date(poczatek).toISOString(),
          koniec: new Date(koniec).toISOString(),
          autor_id: user?.id ?? null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      const id = (data as { id: string }).id;

      if (plik) {
        const rozszerzenie = plik.name.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";
        const sciezka = `wydarzenia/${id}/plakat.${rozszerzenie}`;
        const up = await supabase.storage
          .from("court-photos")
          .upload(sciezka, plik, { contentType: plik.type || "image/jpeg", upsert: true });

        if (up.error) {
          /* wiersz zostaje - wydarzenie bez plakatu jest wydarzeniem, brak wiersza nie jest */
          setKomunikat(`Wydarzenie zapisane, ale plakat nie wszedł: ${up.error.message}`);
        } else {
          await supabase.from("wydarzenia").update({ zdjecie: sciezka }).eq("id", id);
        }
      }

      /* mapa i karty boisk trzymają dane w pamięci podręcznej - trzeba ją unieważnić */
      await fetch("/api/odswiez", { method: "POST" });

      setKomunikat((k) => k ?? "Wydarzenie dodane. Pinezka zapali się w ciągu minuty.");
      setNazwa("");
      setOpis("");
      setPlik(null);
      setBoisko(null);
      setSzukaj("");
      setOdswiezenie((n) => n + 1);
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setZapisuje(false);
    }
  };

  const usun = async (w: WpisZBoiskiem) => {
    const supabase = await supabaseBrowser();
    if (!supabase) return;

    if (w.zdjecie) await supabase.storage.from("court-photos").remove([w.zdjecie]);
    const { error } = await supabase.from("wydarzenia").delete().eq("id", w.id);
    if (error) {
      setBlad(error.message);
      return;
    }
    await fetch("/api/odswiez", { method: "POST" });
    setKomunikat("Wydarzenie usunięte.");
    setOdswiezenie((n) => n + 1);
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <div className="glass rounded-[28px] p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
            style={{ background: CZERWIEN }}
          >
            nowe wydarzenie
          </span>
        </div>

        <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">
          Turniej, trening otwarty, streetball
        </h2>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-muted">
          Pinezka wybranego boiska zrobi się biało-czerwona, kilka razy większa od pozostałych
          i zacznie płonąć. Po najechaniu zamiast zwykłej wizytówki pokaże plakat, nazwę
          i godziny; na karcie boiska stanie osobny box. Wszystko gaśnie samo, gdy minie
          godzina końca - nic nie trzeba sprzątać.
        </p>

        {/* ---------------- boisko ---------------- */}
        <div className="mt-6">
          <label className="text-[11px] uppercase tracking-[0.16em] text-faint">Boisko</label>
          {boisko ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-[18px] border border-hairline bg-white/5 px-4 py-3">
              <span className="min-w-0 truncate text-[14px]">
                {boisko.name} <span className="text-muted">· {boisko.city}</span>
              </span>
              <button
                onClick={() => setBoisko(null)}
                className="shrink-0 text-[12px] text-faint transition hover:text-ink"
              >
                zmień
              </button>
            </div>
          ) : (
            <>
              <input
                value={szukaj}
                onChange={(e) => setSzukaj(e.target.value)}
                placeholder="nazwa boiska albo miasto"
                className="mt-2 w-full rounded-[18px] border border-hairline bg-white/5 px-4 py-3 text-[14px] outline-none focus:border-flame/50"
              />
              {wyniki.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {wyniki.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => {
                          setBoisko(b);
                          setWyniki([]);
                        }}
                        className="w-full rounded-[14px] px-4 py-2.5 text-left text-[13px] transition hover:bg-white/8"
                      >
                        {b.name} <span className="text-muted">· {b.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ---------------- treść ---------------- */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Nazwa wydarzenia">
            <input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              maxLength={90}
              placeholder="np. Turniej 3x3 o Puchar Podkosza"
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </Pole>

          <Pole etykieta="Plakat (nieobowiązkowy)">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setPlik(e.target.files?.[0] ?? null)}
              className="w-full text-[12px] text-muted"
            />
          </Pole>

          <Pole etykieta="Początek">
            <input
              type="datetime-local"
              value={poczatek}
              onChange={(e) => setPoczatek(e.target.value)}
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </Pole>

          <Pole etykieta="Koniec">
            <input
              type="datetime-local"
              value={koniec}
              onChange={(e) => setKoniec(e.target.value)}
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </Pole>
        </div>

        <div className="mt-4">
          <Pole etykieta="Opis">
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="Kto organizuje, dla kogo, czy trzeba się zapisać, co ze sprzętem."
              className="w-full resize-y bg-transparent text-[14px] leading-relaxed outline-none"
            />
          </Pole>
        </div>

        <button
          onClick={() => void zapisz()}
          disabled={zapisuje}
          className="mt-5 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          style={{ background: CZERWIEN }}
        >
          {zapisuje ? "Zapisuję..." : "Dodaj wydarzenie"}
        </button>

        {blad && <p className="mt-3 text-[13px] text-ember">{blad}</p>}
        {komunikat && <p className="mt-3 text-[13px] text-flame">{komunikat}</p>}
      </div>

      {/* ---------------- lista ---------------- */}
      <h3 className="mt-10 text-[15px] font-semibold uppercase tracking-[0.14em] text-muted">
        Wydarzenia
      </h3>

      {laduje ? (
        <p className="mt-4 text-[13px] text-faint">wczytuję…</p>
      ) : lista.length === 0 ? (
        <p className="mt-4 text-[13px] text-faint">Nie ma jeszcze żadnego wydarzenia.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((w) => {
            const stan = stanWydarzenia(w);
            return (
              <li
                key={w.id}
                className={`glass flex flex-wrap items-center gap-4 rounded-[20px] p-4 ${
                  stan === "minelo" ? "opacity-55" : ""
                }`}
              >
                {w.zdjecie ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl(w.zdjecie)}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded-[12px] object-cover"
                  />
                ) : (
                  <span className="grid h-14 w-20 shrink-0 place-items-center rounded-[12px] bg-white/6 text-[10px] uppercase tracking-[0.14em] text-faint">
                    bez plakatu
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{w.nazwa}</p>
                  <p className="truncate text-[12px] text-muted">
                    {w.boisko ? `${w.boisko.name} · ${w.boisko.city}` : "boisko usunięte"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-faint">
                    {stan === "minelo" ? `minęło · ${godziny(w)}` : kiedy(w)}
                  </p>
                </div>

                <span
                  className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ borderColor: "rgb(232 17 45 / .45)", color: CZERWIEN }}
                >
                  {stan === "minelo" ? "po czasie" : plakietka(w)}
                </span>

                <button
                  onClick={() => void usun(w)}
                  className="shrink-0 rounded-full border border-hairline px-4 py-2 text-[12px] text-muted transition hover:border-ember/50 hover:text-ember"
                >
                  usuń
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Pole({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[18px] border border-hairline bg-white/5 px-4 py-3">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-faint">{etykieta}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
