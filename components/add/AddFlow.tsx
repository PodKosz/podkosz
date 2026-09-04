"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ACCESS_LABEL,
  Access,
  CourtType,
  EXTRA_PHOTO_STEPS,
  PHOTO_STEPS,
  PhotoKind,
  PhotoStep,
  REQUIRED_PHOTO_STEPS,
  SURFACE_LABEL,
  Surface,
  TYPE_LABEL,
  VOIVODESHIPS,
} from "@/lib/types";
import { submitCourt } from "@/lib/queue";
import { PROMIEN_OBECNOSCI_M, type OdczytGps, ocenObecnosc } from "@/lib/obecnosc";
import { signInWithGoogle } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/config";
import { reverseGeocode } from "@/lib/geo";
import { NearbyMatch, findNearbyCourts } from "@/lib/duplicates";
import { formatDistance } from "@/lib/site";
import { ShotDiagram } from "../ShotDiagram";
import { CameraCapture } from "./CameraCapture";
import { ArrowLeftIcon, PinIcon } from "../icons";
import { GoogleMark } from "../GoogleMark";

export interface AddFlowUser {
  name: string;
  email: string | null;
}

type Stage = "intro" | "shots" | "gps" | "details" | "author" | "done";

const STAGE_ORDER: Stage[] = ["intro", "shots", "gps", "details", "author", "done"];

export function AddFlow({ user }: { user: AddFlowUser | null }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** kadr, który użytkownik właśnie robi; null = ekran przeglądu zdjęć */
  const [shotKind, setShotKind] = useState<PhotoKind | null>(REQUIRED_PHOTO_STEPS[0].kind);
  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, string>>>({});
  const [skipped, setSkipped] = useState<PhotoKind[]>([]);
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  /**
   * Surowy odczyt GPS - osobno od pinezki, i to jest sedno warunku obecności.
   *
   * Pinezka daje się poprawić ręcznie (stoi się przy siatce, a kosze są na środku płyty),
   * więc gdyby to ona była jedynym śladem, sprawdzenie „czy jesteś na boisku" porównywałoby
   * wpisane współrzędne same ze sobą. Odczyt zostaje taki, jaki przyszedł z przeglądarki,
   * i to od niego liczymy dopuszczalne odejście.
   */
  const [odczyt, setOdczyt] = useState<OdczytGps | null>(null);
  /** boiska stojące w tym samym miejscu - ostrzeżenie przed dodaniem duplikatu */
  const [duplicates, setDuplicates] = useState<NearbyMatch[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  /** co udało się odczytać z lokalizacji - pokazujemy to przy pinezce */
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    city: "",
    voivodeship: "",
    type: "otwarty" as CourtType,
    surface: "beton" as Surface,
    hoops: 2,
    lit: false,
    fenced: false,
    access: "24h" as Access,
    from: "06:00",
    to: "22:00",
    notes: "",
  });
  const [author, setAuthor] = useState<{ mode: "guest" | "account"; email: string; name: string }>({
    mode: user ? "account" : "guest",
    email: "",
    name: "",
  });

  const step = shotKind ? PHOTO_STEPS.find((s) => s.kind === shotKind) ?? null : null;
  const taken = Object.values(photos).filter(Boolean).length;
  /** kadry obowiązkowe, których jeszcze nie ma (pominięty kosz B się nie liczy) */
  const missing = REQUIRED_PHOTO_STEPS.filter(
    (s) => !photos[s.kind] && !skipped.includes(s.kind)
  );
  const shotsComplete = missing.length === 0;
  /** czy wolno przejść dalej z lokalizacją - patrz `lib/obecnosc.ts` */
  const obecnosc = ocenObecnosc(odczyt, pos);
  const extrasTaken = EXTRA_PHOTO_STEPS.filter((s) => photos[s.kind]);
  const nextExtra = EXTRA_PHOTO_STEPS.find((s) => !photos[s.kind]);

  const progress = useMemo(() => {
    const per = 1 / (STAGE_ORDER.length - 1);
    if (stage === "shots") {
      const done = REQUIRED_PHOTO_STEPS.length - missing.length;
      return per * (1 + done / REQUIRED_PHOTO_STEPS.length);
    }
    return STAGE_ORDER.indexOf(stage) * per;
  }, [stage, missing.length]);

  const patch = (p: Partial<typeof form>) => setForm({ ...form, ...p });

  const setPhoto = (kind: PhotoKind, dataUrl: string) => {
    setPhotos((p) => ({ ...p, [kind]: dataUrl }));
    setSkipped((s) => s.filter((k) => k !== kind));
  };

  const dropPhoto = (kind: PhotoKind) =>
    setPhotos((p) => {
      const next = { ...p };
      delete next[kind];
      return next;
    });

  /** Po zamknięciu kadru: kolejny brakujący obowiązkowy albo ekran przeglądu. */
  const goAfter = (kind: PhotoKind) => {
    const index = REQUIRED_PHOTO_STEPS.findIndex((s) => s.kind === kind);
    if (index === -1) {
      setShotKind(null);
      return;
    }
    const next = REQUIRED_PHOTO_STEPS.slice(index + 1).find(
      (s) => !photos[s.kind] && !skipped.includes(s.kind)
    );
    setShotKind(next ? next.kind : null);
  };

  /**
   * Wstecz z kadru: poprzedni kadr obowiązkowy, a z pierwszego - przegląd zdjęć
   * (albo instrukcja, jeśli nie ma jeszcze ani jednego zdjęcia).
   */
  const goBack = (kind: PhotoKind) => {
    const index = REQUIRED_PHOTO_STEPS.findIndex((s) => s.kind === kind);
    if (index > 0) {
      setShotKind(REQUIRED_PHOTO_STEPS[index - 1].kind);
      return;
    }
    if (taken > 0) setShotKind(null);
    else setStage("intro");
  };

  const skipStep = (kind: PhotoKind) => {
    setSkipped((s) => (s.includes(kind) ? s : [...s, kind]));
    dropPhoto(kind);
    goAfter(kind);
  };

  const askGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError(
        "Twoja przeglądarka nie udostępnia lokalizacji, a bez niej nie da się dodać boiska. " +
          "Otwórz kreator na telefonie, stojąc na boisku."
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOdczyt({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          dokladnosc: p.coords.accuracy,
        });
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
        });
        void fillPlace(p.coords.latitude, p.coords.longitude);
        void checkDuplicates(p.coords.latitude, p.coords.longitude);
      },
      () =>
        setGpsError(
          "Nie udało się pobrać lokalizacji. Bez niej nie da się dodać boiska - sprawdź, " +
            "czy przeglądarka ma zgodę na dostęp do lokalizacji, i spróbuj ponownie."
        ),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  /**
   * Miasto i województwo bierzemy z lokalizacji - użytkownik nie musi ich wpisywać.
   * Pola zostają widoczne w kolejnym kroku, więc zawsze można poprawić.
   */
  const fillPlace = async (lat: number, lng: number) => {
    setPlaceNote("sprawdzam adres…");
    try {
      const found = await reverseGeocode(lat, lng);
      const region = VOIVODESHIPS.includes(found?.voivodeship as (typeof VOIVODESHIPS)[number])
        ? (found?.voivodeship as string)
        : "";
      if (!found || (!found.city && !region)) {
        setPlaceNote("nie rozpoznałem adresu - wpisz miasto w kolejnym kroku");
        return;
      }
      setForm((f) => ({
        ...f,
        city: f.city || found.city,
        voivodeship: f.voivodeship || region,
      }));
      setPlaceNote(
        [found.city, region].filter(Boolean).join(", ") + " - uzupełnione z lokalizacji"
      );
    } catch {
      setPlaceNote("nie udało się odczytać adresu - wpisz miasto w kolejnym kroku");
    }
  };

  /** Sprawdza, czy w tym miejscu nie ma już boiska w bazie. Cicho, bez blokowania kreatora. */
  const checkDuplicates = async (lat: number, lng: number) => {
    try {
      setDuplicates(await findNearbyCourts(lat, lng));
    } catch {
      setDuplicates([]);
    }
  };

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      await submitCourt({
        photos: PHOTO_STEPS.filter((s) => photos[s.kind]).map((s) => ({
          kind: s.kind,
          dataUrl: photos[s.kind]!,
        })),
        lat: pos?.lat ?? 0,
        lng: pos?.lng ?? 0,
        accuracy: pos?.accuracy,
        /*
          Ślad obecności do panelu: ile pinezka odeszła od odczytu GPS. Liczymy to tu, a nie
          w bazie, bo tylko przeglądarka zna surowy odczyt - do bazy idzie już poprawiona
          pinezka. Wartość nie jest dowodem (da się ją podstawić razem z pozycją), ale
          zestawiona z dokładnością pokazuje, czy liczby wyglądają jak z telefonu na miejscu.
        */
        gpsOdleglosc: obecnosc.ok ? Math.round(obecnosc.odleglosc) : undefined,
        name: form.name,
        city: form.city,
        voivodeship: form.voivodeship,
        type: form.type,
        surface: form.surface,
        hoops: form.hoops,
        lit: form.lit,
        fenced: form.fenced,
        access: form.access,
        hours: form.access === "24h" ? "całą dobę" : `${form.from} - ${form.to}`,
        notes: form.notes,
        author: {
          mode: user ? "account" : author.mode,
          name: user?.name ?? author.name ?? undefined,
          email: user?.email ?? author.email ?? undefined,
        },
      });
      setStage("done");
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* pasek postępu */}
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full flame-gradient transition-all duration-500"
          style={{ width: `${Math.max(4, progress * 100)}%` }}
        />
      </div>

      {stage === "intro" && (
        <section className="rise">
          <h1 className="text-[clamp(28px,4.5vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
            Dodaj boisko do mapy
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Zajmie ci to 3 minuty. Prowadzimy cię kadr po kadrze - przy każdym zdjęciu masz na
            ekranie schemat i podpowiedź, jak je ustawić. Potem telefon przypina pinezkę z GPS, a my
            sprawdzamy zgłoszenie i publikujemy. Konto nie jest wymagane - ale z kontem dostaniesz
            powiadomienie o publikacji i punkty w rankingu.
          </p>

          {/*
            Warunek obecności mówimy na wstępie, a sprawdzamy dopiero w kroku z lokalizacją.
            Kolejność kroków jest z innego powodu (zdjęcia najpierw, bo po nie się przyszło),
            ale nikt nie powinien zrobić sześciu kadrów i dopiero wtedy dowiedzieć się, że
            z domu tego nie wyśle.
          */}
          <p className="mt-4 rounded-2xl border border-flame/35 bg-flame/10 px-4 py-3 text-[14px] leading-relaxed text-glow">
            Boisko dodaje się na miejscu. Kreator poprosi o lokalizację i sprawdzi, czy stoisz
            nie dalej niż {PROMIEN_OBECNOSCI_M} m od pinezki - inaczej zgłoszenia nie da się
            wysłać. Weź telefon na boisko.
          </p>

          {/*
            Przycisk startu NAD listą kadrów. Sześć kafelków z przykładami to prawie cały
            ekran telefonu, więc jedyne wezwanie do działania leżało pod nimi i trzeba było
            przewinąć całą stronę, żeby w ogóle zacząć. Lista jest tu materiałem
            pomocniczym - kto chce, przeczyta; kto wie, o co chodzi, klika od razu.
          */}
          <button
            onClick={() => {
              setShotKind(missing[0]?.kind ?? REQUIRED_PHOTO_STEPS[0].kind);
              setStage("shots");
            }}
            className="mt-7 w-full rounded-2xl flame-gradient px-6 py-4 text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99]"
          >
            Zaczynamy
          </button>

          <h2 className="mt-9 text-[12px] uppercase tracking-[0.18em] text-faint">
            Sześć kadrów, zawsze w tej samej kolejności
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REQUIRED_PHOTO_STEPS.map((s, i) => (
              <div key={s.kind} className="glass overflow-hidden rounded-2xl">
                <div className="relative aspect-[4/3]">
                  <ShotDiagram kind={s.kind} />
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[11px] font-bold">
                    {i + 1}
                  </span>
                  {s.skippable && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      można pominąć
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-semibold leading-tight">{s.title}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{s.hint}</p>
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-6 space-y-2 text-[13px] text-muted">
            <li>· Rób zdjęcia poziomo (telefon na bok), przy dziennym świetle.</li>
            <li>· Nie fotografuj ludzi w zbliżeniu - zgłoszenia z twarzami odrzucamy.</li>
            <li>· Boisko z jednym koszem? Kadr „Kosz B” pomijasz jednym przyciskiem.</li>
            <li>
              · Na końcu możesz dorzucić do trzech dodatkowych ujęć ogólnych - otoczenie, wejście,
              oświetlenie.
            </li>
          </ul>
        </section>
      )}

      {stage === "shots" && step && (
        <section className="rise">
          <div className="mb-4 flex items-start gap-3">
            <div className="h-[70px] w-[94px] shrink-0 overflow-hidden rounded-xl border border-hairline">
              <ShotDiagram kind={step.kind} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-[0.16em] text-flame">
                {step.extra
                  ? `ujęcie dodatkowe ${EXTRA_PHOTO_STEPS.indexOf(step) + 1} z ${EXTRA_PHOTO_STEPS.length}`
                  : `kadr ${REQUIRED_PHOTO_STEPS.indexOf(step) + 1} z ${REQUIRED_PHOTO_STEPS.length}`}
              </p>
              <h2 className="mt-1 text-[21px] font-semibold leading-tight tracking-tight">
                {step.title}
              </h2>
            </div>
          </div>

          <p className="mb-4 rounded-2xl border border-hairline bg-white/5 px-4 py-3 text-[13px] leading-relaxed text-muted">
            {step.tip}
          </p>

          {photos[step.kind] ? (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[step.kind]}
                alt={step.title}
                className="mx-auto w-full rounded-[24px] border border-hairline object-cover"
                style={{ aspectRatio: "3 / 4", maxWidth: "min(100%, 54svh)" }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => dropPhoto(step.kind)}
                  className="glass flex-1 rounded-2xl px-4 py-3.5 text-[14px] font-medium"
                >
                  Powtórz
                </button>
                <button
                  onClick={() => goAfter(step.kind)}
                  className="flex-1 rounded-2xl flame-gradient px-4 py-3.5 text-[14px] font-bold text-black"
                >
                  {missing.length > 1 || (missing.length === 1 && missing[0].kind !== step.kind)
                    ? "Następny kadr"
                    : "Przejrzyj zdjęcia"}
                </button>
              </div>
            </div>
          ) : (
            <CameraCapture
              kind={step.kind}
              hint={step.hint}
              szeroki={step.szeroki}
              onCapture={(dataUrl) => setPhoto(step.kind, dataUrl)}
            />
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={() => goBack(step.kind)}
              className="flex items-center gap-1 text-[13px] text-muted transition hover:text-ink"
            >
              <ArrowLeftIcon className="h-4 w-4" /> wstecz
            </button>

            <div className="flex gap-1.5">
              {REQUIRED_PHOTO_STEPS.map((s) => (
                <button
                  key={s.kind}
                  onClick={() => setShotKind(s.kind)}
                  aria-label={s.title}
                  className={`h-1.5 w-6 rounded-full transition ${
                    photos[s.kind]
                      ? "flame-gradient"
                      : s.kind === step.kind
                        ? "bg-white/45"
                        : skipped.includes(s.kind)
                          ? "bg-white/25"
                          : "bg-white/12"
                  }`}
                />
              ))}
            </div>

            {step.skippable ? (
              <button
                onClick={() => skipStep(step.kind)}
                className="text-right text-[13px] leading-tight text-muted transition hover:text-ink"
              >
                boisko ma
                <br />
                jeden kosz →
              </button>
            ) : step.extra ? (
              <button
                onClick={() => setShotKind(null)}
                className="text-[13px] text-muted transition hover:text-ink"
              >
                pomiń →
              </button>
            ) : taken > 0 ? (
              <button
                onClick={() => setShotKind(null)}
                className="text-[13px] text-muted transition hover:text-ink"
              >
                przegląd →
              </button>
            ) : (
              <span className="w-16" />
            )}
          </div>
        </section>
      )}

      {stage === "shots" && !step && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">
            {shotsComplete ? "Zdjęcia gotowe" : "Brakuje jeszcze kilku kadrów"}
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            {shotsComplete
              ? "Możesz jeszcze coś powtórzyć albo dorzucić dodatkowe ujęcie. Kliknij kafelek, żeby zrobić zdjęcie od nowa."
              : `Do wysłania zgłoszenia potrzebujemy jeszcze: ${missing
                  .map((s) => s.title.toLowerCase())
                  .join(", ")}.`}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REQUIRED_PHOTO_STEPS.map((s, i) => (
              <ShotSlot
                key={s.kind}
                step={s}
                index={i + 1}
                photo={photos[s.kind]}
                skipped={skipped.includes(s.kind)}
                onClick={() => setShotKind(s.kind)}
              />
            ))}
          </div>

          <h3 className="mt-8 text-[12px] uppercase tracking-[0.18em] text-faint">
            Dodatkowe ujęcia - opcjonalnie, maksymalnie {EXTRA_PHOTO_STEPS.length}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {extrasTaken.map((s) => (
              <ShotSlot
                key={s.kind}
                step={s}
                photo={photos[s.kind]}
                onClick={() => setShotKind(s.kind)}
                onRemove={() => dropPhoto(s.kind)}
              />
            ))}
            {nextExtra && (
              <button
                onClick={() => setShotKind(nextExtra.kind)}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/4 px-3 text-center transition hover:border-flame/50 hover:bg-white/7"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full flame-gradient text-[18px] font-bold text-black">
                  +
                </span>
                <span className="text-[12px] font-medium">Dodaj ujęcie ogólne</span>
              </button>
            )}
          </div>

          {!shotsComplete && (
            <p className="mt-6 rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-[13px] text-ember">
              Zgłoszenie ruszy dalej, kiedy będą wszystkie kadry z górnej listy. Jeśli boisko ma
              jeden kosz, otwórz kadr „Kosz B” i kliknij „boisko ma jeden kosz”.
            </p>
          )}

          <Nav
            onBack={() => setStage("intro")}
            onNext={() => setStage("gps")}
            nextDisabled={!shotsComplete}
            nextLabel="Dalej - lokalizacja"
          />
        </section>
      )}

      {stage === "gps" && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">Gdzie stoisz?</h2>
          <p className="mt-2 text-[14px] text-muted">
            Stań na środku boiska i pobierz lokalizację - pinezka trafi dokładnie tam, gdzie jesteś.
            Boisko dodaje się na miejscu, więc pinezka nie może odejść od Ciebie dalej niż
            o {PROMIEN_OBECNOSCI_M} m.
          </p>

          <div className="glass mt-6 rounded-[24px] p-6 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full flame-gradient text-black">
              <PinIcon className="h-8 w-8" />
            </span>
            {pos ? (
              <>
                <p className="mt-4 text-[20px] font-semibold tabular-nums">
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                </p>
                <p className="mt-1 text-[13px] text-muted">dokładność ±{pos.accuracy ?? "?"} m</p>

                {/*
                  Stan obecności czytamy tu wprost, bo to on decyduje o przycisku „Dalej".
                  Zielone potwierdzenie jest równie ważne jak odmowa: bez niego człowiek nie
                  wie, czy stoi wystarczająco blisko, dopóki nie spróbuje przejść dalej.
                */}
                {obecnosc.ok ? (
                  <p className="mt-2 text-[13px] font-medium text-lime">
                    {obecnosc.odleglosc < 1
                      ? "Jesteś na pinezce"
                      : `Jesteś ${Math.round(obecnosc.odleglosc)} m od pinezki`}{" "}
                    - możesz dodać to boisko.
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] leading-snug text-ember">{obecnosc.komunikat}</p>
                )}

                {placeNote && <p className="mt-1 text-[13px] text-flame">{placeNote}</p>}
                <button
                  onClick={askGps}
                  className="mt-4 text-[13px] text-flame transition hover:text-glow"
                >
                  pobierz ponownie
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={askGps}
                  className="mt-5 rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black"
                >
                  Pobierz lokalizację GPS
                </button>
                {gpsError && <p className="mt-3 text-[13px] text-ember">{gpsError}</p>}
              </>
            )}
          </div>

          {duplicates.length > 0 && (
            <div className="mt-4 rounded-[22px] border border-flame/45 bg-flame/10 p-5">
              <p className="text-[14px] font-semibold text-glow">
                {duplicates.length === 1
                  ? "W tym miejscu mamy już boisko"
                  : "W tym miejscu mamy już boiska"}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Sprawdź, czy to nie to samo - drugi taki sam wpis odrzucimy. Jeśli to inne boisko,
                spokojnie kończ zgłoszenie.
              </p>
              <div className="mt-3 space-y-2">
                {duplicates.map((d) => (
                  <a
                    key={d.id}
                    href={`/boisko/${d.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:brightness-110"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{d.name}</span>
                      <span className="text-[12px] text-muted">{d.city}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-flame">
                      {formatDistance(d.distanceM)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/*
            Pola ze współrzędnymi zostają, ale wyłącznie jako poprawka odczytu - stąd warunek
            na `odczyt`, a nie na `gpsError`. Wcześniej pokazywały się także wtedy, gdy GPS
            w ogóle nie odpowiedział, i były wtedy zwykłą furtką: dwie liczby przepisane
            z mapy w drugiej karcie wystarczały, żeby dodać boisko z domu.
          */}
          {odczyt && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Szerokość (lat)">
                <input
                  type="number"
                  step="0.00001"
                  value={pos?.lat ?? ""}
                  onChange={(e) => {
                    const lat = Number(e.target.value);
                    setPos({ lat, lng: pos?.lng ?? 0, accuracy: pos?.accuracy });
                    if (lat && pos?.lng) void checkDuplicates(lat, pos.lng);
                  }}
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
              <Field label="Długość (lng)">
                <input
                  type="number"
                  step="0.00001"
                  value={pos?.lng ?? ""}
                  onChange={(e) => {
                    const lng = Number(e.target.value);
                    setPos({ lat: pos?.lat ?? 0, lng, accuracy: pos?.accuracy });
                    if (lng && pos?.lat) void checkDuplicates(pos.lat, lng);
                  }}
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
            </div>
          )}

          {/* przy odsuniętej pinezce powód stoi też tutaj - inaczej wygaszony przycisk milczy */}
          {odczyt && !obecnosc.ok && obecnosc.powod === "za-daleko" && (
            <p className="mt-3 text-[13px] leading-snug text-ember">{obecnosc.komunikat}</p>
          )}

          <Nav
            onBack={() => setStage("shots")}
            onNext={() => setStage("details")}
            nextDisabled={!obecnosc.ok}
            nextLabel="Dalej - szczegóły"
          />
        </section>
      )}

      {stage === "details" && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">Szczegóły boiska</h2>
          <p className="mt-2 text-[14px] text-muted">
            Miasto i województwo wpisaliśmy z Twojej lokalizacji - sprawdź tylko, czy się zgadza.
            Resztę pól uzupełnij albo zostaw, poprawimy je przy weryfikacji.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Nazwa / lokalizacja">
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="np. Park Jordana"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Miasto">
                <input
                  value={form.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
              <Field label="Województwo">
                <select
                  value={form.voivodeship}
                  onChange={(e) => patch({ voivodeship: e.target.value })}
                  className="w-full bg-transparent text-[14px] outline-none"
                >
                  <option value="">wybierz…</option>
                  {VOIVODESHIPS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Segmented
              label="Typ"
              value={form.type}
              options={Object.entries(TYPE_LABEL) as [CourtType, string][]}
              onChange={(v) => patch({ type: v })}
            />

            <div>
              <FieldLabel>Nawierzchnia</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => patch({ surface: s })}
                    className={`rounded-full border px-3.5 py-2 text-[12px] transition ${
                      form.surface === s
                        ? "border-transparent flame-gradient font-semibold text-black"
                        : "border-hairline bg-white/5 text-muted hover:text-ink"
                    }`}
                  >
                    {SURFACE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Liczba koszy">
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={form.hoops}
                  onChange={(e) => patch({ hoops: Number(e.target.value) })}
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
              <Toggle label="Oświetlenie" on={form.lit} onClick={() => patch({ lit: !form.lit })} />
              <Toggle
                label="Ogrodzenie"
                on={form.fenced}
                onClick={() => patch({ fenced: !form.fenced })}
              />
            </div>

            <Segmented
              label="Dostępność"
              value={form.access}
              options={Object.entries(ACCESS_LABEL) as [Access, string][]}
              onChange={(v) => patch({ access: v })}
            />

            {form.access !== "24h" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Otwarte od">
                  <input
                    type="time"
                    value={form.from}
                    onChange={(e) => patch({ from: e.target.value })}
                    className="w-full bg-transparent text-[14px] outline-none"
                  />
                </Field>
                <Field label="Otwarte do">
                  <input
                    type="time"
                    value={form.to}
                    onChange={(e) => patch({ to: e.target.value })}
                    className="w-full bg-transparent text-[14px] outline-none"
                  />
                </Field>
              </div>
            )}

            <Field label="Uwagi (opcjonalnie)">
              <textarea
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={3}
                placeholder="np. wieczorami komplet, obręcz bez siatki, wejście od strony parkingu"
                className="w-full resize-none bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
            </Field>
          </div>

          <Nav
            onBack={() => setStage("gps")}
            onNext={() => setStage("author")}
            nextDisabled={!form.name || !form.city || !form.voivodeship}
            nextLabel="Dalej - podsumowanie"
          />
        </section>
      )}

      {stage === "author" && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">Ostatni krok</h2>
          <p className="mt-2 text-[14px] text-muted">
            Podpisać zgłoszenie kontem czy wysłać jako gość?
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                setAuthor({ ...author, mode: "account" });
                if (!user && supabaseEnabled)
                  signInWithGoogle("/dodaj").catch((e: Error) => setSendError(e.message));
              }}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                author.mode === "account"
                  ? "border-flame/60 bg-flame/10"
                  : "border-hairline bg-white/4 hover:bg-white/7"
              }`}
            >
              <GoogleMark />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">
                  {user ? `Zalogowany jako ${user.name}` : "Konto Google"}
                </span>
                <span className="block text-[13px] text-muted">
                  Powiadomienie o publikacji, ulubione i miejsce w rankingu odkrywców
                </span>
              </span>
            </button>

            <button
              onClick={() => setAuthor({ ...author, mode: "guest" })}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                author.mode === "guest"
                  ? "border-flame/60 bg-flame/10"
                  : "border-hairline bg-white/4 hover:bg-white/7"
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-white/6 text-[18px]">
                👤
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Jako gość</span>
                <span className="block text-[13px] text-muted">
                  Bez zakładania konta. Możesz zostawić e-mail, żeby dostać info o publikacji.
                </span>
              </span>
            </button>

            {author.mode === "guest" && !user && (
              <Field label="E-mail (opcjonalnie)">
                <input
                  type="email"
                  value={author.email}
                  onChange={(e) => setAuthor({ ...author, email: e.target.value })}
                  placeholder="ty@example.com"
                  className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
                />
              </Field>
            )}
            {author.mode === "account" && !user && !supabaseEnabled && (
              <p className="rounded-2xl border border-hairline bg-white/4 px-4 py-3 text-[13px] text-muted">
                Logowanie Google ruszy po podpięciu bazy - na razie zgłoszenie poleci jako
                anonimowe.
              </p>
            )}
          </div>

          {sendError && (
            <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
              {sendError}
            </p>
          )}

          <Summary
            photos={taken}
            pos={pos}
            name={form.name}
            city={form.city}
            hours={form.access === "24h" ? "całą dobę" : `${form.from} - ${form.to}`}
          />

          <Nav
            onBack={() => setStage("details")}
            onNext={submit}
            nextDisabled={sending}
            nextLabel={sending ? "Wysyłam zdjęcia…" : "Wyślij zgłoszenie"}
          />
        </section>
      )}

      {stage === "done" && (
        <section className="rise text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full flame-gradient text-[34px] text-black">
            ✓
          </span>
          <h2 className="mt-6 text-[28px] font-semibold tracking-tight">Zgłoszenie wysłane</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">
            Trafiło do kolejki weryfikacji. Sprawdzamy zdjęcia i dane, a po akceptacji pinezka
            pojawia się na mapie - zwykle w ciągu doby.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-2xl flame-gradient px-6 py-3.5 text-[14px] font-bold text-black"
            >
              Wróć na mapę
            </Link>
            <Link href="/admin" className="glass rounded-2xl px-6 py-3.5 text-[14px] font-medium">
              Podgląd panelu admina
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- drobne elementy ---------- */

/** Kafelek kadru na ekranie przeglądu: zdjęcie albo schemat z informacją o stanie. */
function ShotSlot({
  step,
  index,
  photo,
  skipped,
  onClick,
  onRemove,
}: {
  step: PhotoStep;
  index?: number;
  photo?: string;
  skipped?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl">
      <button onClick={onClick} className="block w-full text-left">
        <span className="relative block aspect-[4/3]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={step.title} className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full opacity-45">
              <ShotDiagram kind={step.kind} />
            </span>
          )}
          {index && (
            <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-[11px] font-bold">
              {index}
            </span>
          )}
          {photo && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-flame">
              gotowe
            </span>
          )}
          {!photo && skipped && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted">
              pominięte
            </span>
          )}
          {!photo && !skipped && (
            <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-center text-[10px] uppercase tracking-[0.1em] text-ember">
              zrób zdjęcie
            </span>
          )}
        </span>
        <span className="block p-2.5 text-[11px] font-medium leading-tight">{step.title}</span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Usuń zdjęcie"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-[14px] transition hover:text-ember"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="field px-4 py-3">{children}</div>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-faint">
      {children}
    </span>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="field flex flex-col items-start gap-2 px-4 py-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="switch" data-on={on} />
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-1 rounded-2xl border border-hairline bg-white/5 p-1">
        {options.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] transition ${
              value === k ? "bg-white/14 font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-8 flex gap-3">
      <button onClick={onBack} className="glass rounded-2xl px-5 py-3.5 text-[14px] font-medium">
        Wstecz
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 rounded-2xl flame-gradient px-6 py-3.5 text-[15px] font-bold text-black transition hover:brightness-110 disabled:opacity-35"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Summary({
  photos,
  pos,
  name,
  city,
  hours,
}: {
  photos: number;
  pos: { lat: number; lng: number } | null;
  name: string;
  city: string;
  hours: string;
}) {
  return (
    <div className="glass mt-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[22px] p-5 text-[13px] sm:grid-cols-4">
      <Cell label="Zdjęcia" value={`${photos} szt.`} />
      <Cell label="Boisko" value={`${name || "-"}${city ? `, ${city}` : ""}`} />
      <Cell label="GPS" value={pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "brak"} />
      <Cell label="Godziny" value={hours} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
