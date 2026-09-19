"use client";

import { useState } from "react";
import Image from "next/image";
import { CourtPhotoRef, PHOTO_STEPS, PhotoKind } from "@/lib/types";
import { PHOTO_DISPLAY_ORDER } from "@/lib/photos";
import { ocenObecnosc, type OdczytGps } from "@/lib/obecnosc";
import { zlozPoprawke } from "@/lib/poprawki";
import { adresMiniatury } from "@/lib/obrazy";
import { supabaseEnabled } from "@/lib/supabase/config";
import { CameraCapture } from "./add/CameraCapture";
import { useBramka } from "./BramkaLogowania";

/**
 * „Popraw zdjęcia" na karcie boiska.
 *
 * ------------------------------------------------------------------ jeden kadr, jedno zgłoszenie
 *
 * Wybiera się KONKRETNY kadr, nie „zdjęcia boiska". Powód jest po stronie oglądania:
 * w panelu zgłoszenie staje obok zdjęcia, które ma zastąpić, i decyzja brzmi „to jest
 * lepsze od tamtego". Gdyby jedno zgłoszenie niosło pięć kadrów naraz, przyjęcie go
 * znaczyłoby „zgadzam się na wszystkie pięć", a zwykle zgadza się na dwa.
 *
 * Kadr, którego boisko jeszcze nie ma, jest tym samym zgłoszeniem - po prostu nie ma
 * z czym porównywać. Dlatego dołożenie i podmiana to tutaj jedna ścieżka, a nie dwie.
 *
 * ------------------------------------------------------------------ trzeba stać na boisku
 *
 * Ten sam warunek co przy dodawaniu boiska (`lib/obecnosc.ts`), z tego samego powodu:
 * bez niego „poprawka zdjęcia" byłaby furtką do wrzucenia na cudze boisko czegokolwiek
 * z internetu. I tak samo jak tam - to jest próg wysiłku, nie dowód. Zmierzoną odległość
 * zapisujemy przy zgłoszeniu, żeby w panelu było widać, komu przyjrzeć się uważniej.
 *
 * ŻEBY NIE BYŁO NIEPOROZUMIENIA: `CameraCapture` obok migawki zawsze wystawia „z galerii"
 * i tak zostaje. Aparat nie jest więc drugim progiem - ktoś, kto stoi na boisku, może
 * wgrać dowolny plik z telefonu. Jedyną bramą jest tu obecność, a ostatnim słowem
 * człowiek w panelu, który widzi oba kadry obok siebie. Gdyby kiedyś miało to przestać
 * wystarczać, właściwym miejscem na zmianę jest `CameraCapture`, nie ten plik.
 */

type Krok = "kadr" | "obecnosc" | "aparat" | "podglad" | "gotowe";

const KROK_STEP = (kind: PhotoKind) => PHOTO_STEPS.find((s) => s.kind === kind);

/**
 * Odległość w zdaniu do człowieka.
 *
 * W metrach tylko dopóki metry coś znaczą. „Jesteś jakieś 250754 m stąd" to liczba, którą
 * trzeba przeliczyć w głowie, żeby zrozumieć, że chodzi o drugi koniec kraju - a właśnie
 * o to zrozumienie chodzi w tym komunikacie. Od kilometra w górę zaokrąglamy, bo przy tej
 * skali pojedyncze metry są szumem.
 */
function odlegloscSlownie(metry: number) {
  if (metry < 1000) return `${Math.round(metry)} m`;
  const km = metry / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}

export function PoprawZdjecia({
  courtId,
  lat,
  lng,
  photos,
}: {
  courtId: string;
  lat: number;
  lng: number;
  photos: CourtPhotoRef[];
}) {
  const [otwarte, setOtwarte] = useState(false);
  const [krok, setKrok] = useState<Krok>("kadr");
  const [kind, setKind] = useState<PhotoKind | null>(null);
  const [odleglosc, setOdleglosc] = useState<number | null>(null);
  const [kadr, setKadr] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [szuka, setSzuka] = useState(false);
  const [wysyla, setWysyla] = useState(false);
  const { wymagaj } = useBramka();

  const obecne = (k: PhotoKind) => photos.find((p) => p.kind === k);

  const otworz = async () => {
    if (!(await wymagaj("poprawić zdjęcie boiska"))) return;
    setKrok("kadr");
    setKind(null);
    setKadr(null);
    setOdleglosc(null);
    setBlad(null);
    setOtwarte(true);
  };

  /**
   * Pytanie o lokalizację leci z KLIKNIĘCIA, a nie z otwarcia okna.
   *
   * Przeglądarka pokazuje wtedy swoje pytanie o zgodę w odpowiedzi na czynność człowieka,
   * a nie samo z siebie - a pytanie, które wyskakuje bez powodu, najczęściej dostaje
   * „zablokuj" i wtedy nie da się go już zadać ponownie bez grzebania w ustawieniach.
   */
  const sprawdzObecnosc = () => {
    setBlad(null);

    if (!navigator.geolocation) {
      setBlad(
        "Twoja przeglądarka nie udostępnia lokalizacji, a bez niej nie sprawdzimy, czy " +
          "stoisz na boisku. Otwórz tę stronę na telefonie, na miejscu."
      );
      return;
    }

    setSzuka(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setSzuka(false);
        const odczyt: OdczytGps = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          dokladnosc: p.coords.accuracy,
        };
        const ocena = ocenObecnosc(odczyt, { lat, lng });

        if (ocena.ok) {
          setOdleglosc(ocena.odleglosc);
          setKrok("aparat");
          return;
        }

        /*
          Rozdzielamy „jesteś gdzie indziej" od „nie wiem, gdzie jesteś", bo to dwie różne
          wiadomości dla tej samej osoby. Przy słabym sygnale człowiek MOŻE stać na boisku
          i zdanie „chyba cię tu nie ma" byłoby po prostu nieprawdą.
        */
        setBlad(
          ocena.powod === "za-daleko"
            ? `Hej, chyba nie znajdujesz się na tym boisku! Jesteś jakieś ${odlegloscSlownie(
                ocena.odleglosc ?? 0
              )} stąd. Zdjęcie do poprawki robi się na miejscu - to jedyny sposób, żeby ` +
                "było wiadomo, że pokazuje to boisko i dzisiejszy dzień."
            : ocena.komunikat
        );
      },
      () => {
        setSzuka(false);
        setBlad(
          "Nie udało się pobrać lokalizacji. Sprawdź, czy przeglądarka ma zgodę na dostęp " +
            "do niej, i spróbuj jeszcze raz."
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const wyslij = async () => {
    if (!kind || !kadr || odleglosc === null) return;
    setWysyla(true);
    setBlad(null);
    try {
      await zlozPoprawke({ courtId, kind, dataUrl: kadr, odlegloscM: odleglosc });
      setKrok("gotowe");
    } catch (e) {
      setBlad((e as Error).message);
    }
    setWysyla(false);
  };

  /* kadry, które boisko ma - i te, których jeszcze nie ma; jedne i drugie wolno przynieść */
  const maKadry = PHOTO_DISPLAY_ORDER.filter((k) => obecne(k));
  const brakujace = PHOTO_DISPLAY_ORDER.filter((k) => !obecne(k));
  const step = kind ? KROK_STEP(kind) : undefined;

  return (
    <>
      <button
        onClick={otworz}
        className="glass rounded-2xl px-8 py-4 text-[15px] font-medium text-ink transition hover:brightness-110"
      >
        Popraw zdjęcia
      </button>

      {otwarte && (
        <div
          onClick={() => setOtwarte(false)}
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-void/60 p-5 backdrop-blur-xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="szklo-pro my-auto w-full max-w-2xl overflow-hidden rounded-[30px] p-6 sm:p-7"
            style={{ animation: "rise 380ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {krok === "kadr" && (
              <>
                <p className="text-[11px] uppercase tracking-[0.32em] text-flame">Lepszy kadr</p>
                <h2 className="mt-3 text-[23px] font-semibold leading-tight tracking-[-0.02em]">
                  Który kadr chcesz poprawić?
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  Boisko zostaje przypisane osobie, która je dodała - zmieniasz jedno zdjęcie,
                  nie wpis. Kadr zrobisz za chwilę aparatem, stojąc na boisku.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {maKadry.map((k) => {
                    const p = obecne(k)!;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setKind(k);
                          setKrok("obecnosc");
                        }}
                        className="group relative aspect-[4/3] overflow-hidden rounded-[18px] border border-hairline text-left transition hover:border-flame/60"
                      >
                        {p.url && (
                          <Image
                            src={adresMiniatury(p.url, 320)}
                            alt={p.caption}
                            fill
                            sizes="(max-width: 640px) 45vw, 220px"
                            className="object-cover transition duration-700 group-hover:scale-[1.045]"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 text-[10.5px] uppercase tracking-[0.1em] text-ink/90">
                          {p.caption}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {brakujace.length > 0 && (
                  <>
                    <p className="mt-7 text-[11px] uppercase tracking-[0.18em] text-faint">
                      Albo dołóż kadr, którego tu jeszcze nie ma
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brakujace.map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            setKind(k);
                            setKrok("obecnosc");
                          }}
                          className="rounded-full border border-hairline bg-white/5 px-4 py-2 text-[12.5px] text-muted transition hover:border-flame/50 hover:text-ink"
                        >
                          {KROK_STEP(k)?.title ?? k}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {!supabaseEnabled && (
                  <p className="mt-5 text-[12px] text-faint">
                    Tryb testowy - poprawki ruszą po podpięciu bazy.
                  </p>
                )}

                <button
                  onClick={() => setOtwarte(false)}
                  className="mt-7 w-full rounded-2xl border border-hairline bg-white/5 px-5 py-3 text-[14px] font-medium text-muted transition hover:text-ink"
                >
                  Anuluj
                </button>
              </>
            )}

            {krok === "obecnosc" && step && (
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.32em] text-flame">
                  {step.title}
                </p>
                <h2 className="mt-3 text-[23px] font-semibold leading-tight tracking-[-0.02em]">
                  Stoisz na tym boisku?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-muted">
                  Zdjęcie do poprawki robi się na miejscu. Sprawdzimy tylko, czy telefon jest
                  przy boisku - pozycja nigdzie nie jest zapisywana poza tym jednym pomiarem.
                </p>

                {blad && (
                  <p className="mt-5 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-left text-[13px] leading-relaxed text-ember">
                    {blad}
                  </p>
                )}

                <button
                  onClick={sprawdzObecnosc}
                  disabled={szuka}
                  className="mt-6 w-full rounded-2xl flame-gradient px-5 py-3.5 text-[14px] font-bold text-black disabled:opacity-50"
                >
                  {szuka ? "Szukam sygnału…" : blad ? "Sprawdź jeszcze raz" : "Sprawdź lokalizację"}
                </button>
                <button
                  onClick={() => {
                    setBlad(null);
                    setKrok("kadr");
                  }}
                  className="mt-3 w-full rounded-2xl px-5 py-3 text-[13px] text-faint transition hover:text-muted"
                >
                  Wróć do wyboru kadru
                </button>
              </div>
            )}

            {krok === "aparat" && kind && step && (
              <>
                <p className="text-[11px] uppercase tracking-[0.32em] text-flame">{step.title}</p>
                <h2 className="mt-3 text-[21px] font-semibold leading-tight tracking-[-0.02em]">
                  Zrób zdjęcie
                </h2>
                <div className="mt-5">
                  <CameraCapture
                    kind={kind}
                    hint={step.tip}
                    szeroki={step.szeroki}
                    onCapture={(dataUrl) => {
                      setKadr(dataUrl);
                      setKrok("podglad");
                    }}
                  />
                </div>
                <button
                  onClick={() => setKrok("obecnosc")}
                  className="mt-4 w-full rounded-2xl px-5 py-3 text-[13px] text-faint transition hover:text-muted"
                >
                  Wróć
                </button>
              </>
            )}

            {krok === "podglad" && kind && kadr && (
              <>
                <p className="text-[11px] uppercase tracking-[0.32em] text-flame">
                  {step?.title ?? kind}
                </p>
                <h2 className="mt-3 text-[23px] font-semibold leading-tight tracking-[-0.02em]">
                  {obecne(kind) ? "Tak to podmienimy" : "Tak dołożymy ten kadr"}
                </h2>

                {/* to samo zestawienie, które za chwilę zobaczy panel - obok siebie, w tej samej skali */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Zestawienie
                    etykieta="Jest teraz"
                    url={obecne(kind)?.url ? adresMiniatury(obecne(kind)!.url!, 640) : null}
                  />
                  <Zestawienie etykieta="Twoje zdjęcie" url={kadr} wyrozniony />
                </div>

                {blad && (
                  <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] leading-relaxed text-ember">
                    {blad}
                  </p>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setKrok("aparat")}
                    className="rounded-2xl border border-hairline bg-white/5 px-5 py-3 text-[14px] font-medium text-muted transition hover:text-ink"
                  >
                    Jeszcze raz
                  </button>
                  <button
                    onClick={wyslij}
                    disabled={wysyla}
                    className="flex-1 rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black disabled:opacity-40"
                  >
                    {wysyla ? "Wysyłam…" : "Wyślij poprawkę"}
                  </button>
                </div>
              </>
            )}

            {krok === "gotowe" && (
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full flame-gradient text-[26px] text-black">
                  ✓
                </span>
                <h2 className="mt-4 text-[22px] font-semibold tracking-tight">Dzięki!</h2>
                <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted">
                  Zdjęcie czeka w panelu obok tego, które ma zastąpić. Jak wejdzie na boisko,
                  zostanie przy nim podpisane Twoje konto.
                </p>
                <button
                  onClick={() => setOtwarte(false)}
                  className="mt-6 w-full rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black"
                >
                  Zamknij
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Jeden kadr w zestawieniu „jest / będzie". */
function Zestawienie({
  etykieta,
  url,
  wyrozniony = false,
}: {
  etykieta: string;
  url: string | null;
  wyrozniony?: boolean;
}) {
  return (
    <div>
      <p
        className={`mb-2 text-[11px] uppercase tracking-[0.18em] ${
          wyrozniony ? "text-flame" : "text-faint"
        }`}
      >
        {etykieta}
      </p>
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-[18px] border ${
          wyrozniony ? "border-flame/50" : "border-hairline"
        }`}
      >
        {url ? (
          /* zwykły <img>: jeden z tych kadrów to `data:` prosto z aparatu, więc
             optymalizator nie ma czego optymalizować, a drugi jest już miniaturą */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={etykieta} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-white/4 text-[12.5px] text-faint">
            tego kadru jeszcze nie ma
          </div>
        )}
      </div>
    </div>
  );
}
