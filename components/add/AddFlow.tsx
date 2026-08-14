"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ACCESS_LABEL,
  Access,
  CourtType,
  PHOTO_STEPS,
  PhotoKind,
  SURFACE_LABEL,
  Surface,
  TYPE_LABEL,
  VOIVODESHIPS,
} from "@/lib/types";
import { submitCourt } from "@/lib/queue";
import { signInWithGoogle } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/config";
import { PhotoPlaceholder } from "../CourtPhoto";
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
  const [shot, setShot] = useState(0);
  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, string>>>({});
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
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

  const step = PHOTO_STEPS[shot];
  const taken = Object.keys(photos).length;
  const progress = useMemo(() => {
    const base = STAGE_ORDER.indexOf(stage) / (STAGE_ORDER.length - 1);
    if (stage === "shots") return (1 + shot / PHOTO_STEPS.length) / (STAGE_ORDER.length - 1);
    return base;
  }, [stage, shot]);

  const patch = (p: Partial<typeof form>) => setForm({ ...form, ...p });

  const askGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Twoja przeglądarka nie udostępnia lokalizacji.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
        }),
      () => setGpsError("Nie udało się pobrać lokalizacji. Wpisz współrzędne ręcznie."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
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
            Zajmie ci to 3 minuty. Robisz 6 zdjęć według instrukcji, telefon przypina pinezkę z GPS,
            a my sprawdzamy zgłoszenie i publikujemy. Konto nie jest wymagane — ale z kontem
            dostaniesz powiadomienie o publikacji i punkty w rankingu.
          </p>

          <h2 className="mt-8 text-[12px] uppercase tracking-[0.18em] text-faint">
            Tak mają wyglądać kadry
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PHOTO_STEPS.map((s, i) => (
              <div key={s.kind} className="glass overflow-hidden rounded-2xl">
                <div className="relative aspect-[4/3]">
                  <PhotoPlaceholder kind={s.kind} seed={7 + i * 5} />
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[11px] font-bold">
                    {i + 1}
                  </span>
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
            <li>· Nie fotografuj ludzi w zbliżeniu — zgłoszenia z twarzami odrzucamy.</li>
            <li>· Jeśli boisko ma jeden kosz, krok 3 pomiń przyciskiem „pomiń”.</li>
          </ul>

          <button
            onClick={() => setStage("shots")}
            className="mt-8 w-full rounded-2xl flame-gradient px-6 py-4 text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99]"
          >
            Zaczynamy
          </button>
        </section>
      )}

      {stage === "shots" && (
        <section className="rise">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="text-[12px] uppercase tracking-[0.16em] text-flame">
                zdjęcie {shot + 1} z {PHOTO_STEPS.length}
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-1 text-[13px] text-muted">{step.hint}</p>
            </div>
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-hairline">
              <PhotoPlaceholder kind={step.kind} seed={7 + shot * 5} />
            </div>
          </div>

          {photos[step.kind] ? (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[step.kind]}
                alt={step.title}
                className="aspect-[4/3] w-full rounded-[24px] border border-hairline object-cover"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setPhotos({ ...photos, [step.kind]: undefined })}
                  className="glass flex-1 rounded-2xl px-4 py-3.5 text-[14px] font-medium"
                >
                  Powtórz
                </button>
                <button
                  onClick={() =>
                    shot + 1 < PHOTO_STEPS.length ? setShot(shot + 1) : setStage("gps")
                  }
                  className="flex-1 rounded-2xl flame-gradient px-4 py-3.5 text-[14px] font-bold text-black"
                >
                  {shot + 1 < PHOTO_STEPS.length ? "Następne zdjęcie" : "Dalej — lokalizacja"}
                </button>
              </div>
            </div>
          ) : (
            <CameraCapture
              kind={step.kind}
              onCapture={(dataUrl) => setPhotos({ ...photos, [step.kind]: dataUrl })}
            />
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => (shot > 0 ? setShot(shot - 1) : setStage("intro"))}
              className="flex items-center gap-1 text-[13px] text-muted transition hover:text-ink"
            >
              <ArrowLeftIcon className="h-4 w-4" /> wstecz
            </button>
            <div className="flex gap-1.5">
              {PHOTO_STEPS.map((s, i) => (
                <span
                  key={s.kind}
                  className={`h-1.5 w-6 rounded-full transition ${
                    photos[s.kind] ? "flame-gradient" : i === shot ? "bg-white/40" : "bg-white/12"
                  }`}
                />
              ))}
            </div>
            {step.kind === "kosz-b" ? (
              <button
                onClick={() => setShot(shot + 1)}
                className="text-[13px] text-muted transition hover:text-ink"
              >
                pomiń →
              </button>
            ) : (
              <span className="w-12" />
            )}
          </div>
        </section>
      )}

      {stage === "gps" && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">Gdzie stoisz?</h2>
          <p className="mt-2 text-[14px] text-muted">
            Stań na środku boiska i pobierz lokalizację — pinezka trafi dokładnie tam, gdzie jesteś.
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
                <p className="mt-1 text-[13px] text-muted">
                  dokładność ±{pos.accuracy ?? "?"} m
                  {(pos.accuracy ?? 0) > 30 && " — spróbuj ponownie na otwartej przestrzeni"}
                </p>
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

          {(gpsError || pos) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Szerokość (lat)">
                <input
                  type="number"
                  step="0.00001"
                  value={pos?.lat ?? ""}
                  onChange={(e) =>
                    setPos({ lat: Number(e.target.value), lng: pos?.lng ?? 0, accuracy: pos?.accuracy })
                  }
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
              <Field label="Długość (lng)">
                <input
                  type="number"
                  step="0.00001"
                  value={pos?.lng ?? ""}
                  onChange={(e) =>
                    setPos({ lat: pos?.lat ?? 0, lng: Number(e.target.value), accuracy: pos?.accuracy })
                  }
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              </Field>
            </div>
          )}

          <Nav
            onBack={() => setStage("shots")}
            onNext={() => setStage("details")}
            nextDisabled={!pos}
            nextLabel="Dalej — szczegóły"
          />
        </section>
      )}

      {stage === "details" && (
        <section className="rise">
          <h2 className="text-[24px] font-semibold tracking-tight">Szczegóły boiska</h2>
          <p className="mt-2 text-[14px] text-muted">
            Kilka pól, które trafią na kartę boiska. Możemy je jeszcze poprawić przy weryfikacji.
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
            nextLabel="Dalej — podsumowanie"
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
                Logowanie Google ruszy po podpięciu bazy — na razie zgłoszenie poleci jako
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
            pojawia się na mapie — zwykle w ciągu doby.
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
      <Cell label="Boisko" value={`${name || "—"}${city ? `, ${city}` : ""}`} />
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
