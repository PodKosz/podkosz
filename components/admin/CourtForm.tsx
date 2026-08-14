"use client";

import { useState } from "react";
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
import {
  AdminCourt,
  CourtValues,
  FormPhoto,
  isNewPhoto,
  reverseGeocode,
  saveCourt,
} from "@/lib/admin";
import { LocationPicker } from "./LocationPicker";
import { BasketApprovedBadge } from "../icons";

const KINDS = PHOTO_STEPS.map((s) => s.kind);

function emptyValues(): CourtValues {
  return {
    name: "",
    city: "",
    voivodeship: "",
    lat: 52.0,
    lng: 19.4,
    type: "otwarty",
    surface: "beton",
    hoops: 2,
    lit: false,
    fenced: false,
    access: "24h",
    hours: "całą dobę",
    description: "",
    basketApproved: false,
    basketNote: "",
    addedByName: "Basket",
  };
}

/** Ścieżka administratora: zdjęcia z dysku, wszystko wpisane ręcznie, publikacja od razu. */
export function CourtForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AdminCourt;
  onSaved: (slug: string) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<CourtValues>(initial ?? emptyValues());
  const [photos, setPhotos] = useState<FormPhoto[]>(
    initial?.photos.map((p) => ({
      key: p.key,
      kind: p.kind,
      storagePath: p.storagePath,
      previewUrl: p.previewUrl,
    })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const set = (p: Partial<CourtValues>) => setV((old) => ({ ...old, ...p }));

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added: FormPhoto[] = [...files].map((file, i) => ({
      key: `${file.name}-${i}-${photos.length + i}`,
      kind: KINDS[Math.min(photos.length + i, KINDS.length - 1)],
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((list) => [...list, ...added]);
  };

  const move = (index: number, delta: number) => {
    setPhotos((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const drop = (index: number) => {
    setPhotos((list) => {
      const photo = list[index];
      if (photo && isNewPhoto(photo)) URL.revokeObjectURL(photo.previewUrl);
      return list.filter((_, i) => i !== index);
    });
  };

  const setKind = (index: number, kind: PhotoKind) =>
    setPhotos((list) => list.map((p, i) => (i === index ? { ...p, kind } : p)));

  const fillFromMap = async () => {
    const found = await reverseGeocode(v.lat, v.lng);
    if (!found) return;
    set({
      city: found.city || v.city,
      voivodeship: VOIVODESHIPS.includes(found.voivodeship as (typeof VOIVODESHIPS)[number])
        ? found.voivodeship
        : v.voivodeship,
    });
  };

  /** Czyści formularz pod kolejny wpis, zostawiając potwierdzenie poprzedniego. */
  const reset = () => {
    photos.forEach((p) => {
      if (isNewPhoto(p)) URL.revokeObjectURL(p.previewUrl);
    });
    setPhotos([]);
    setV(emptyValues());
    setSavedSlug(null);
    setError(null);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const slug = await saveCourt(v, photos, initial?.id);
      setSavedSlug(slug);
      onSaved(slug);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ready = v.name.trim() && v.city.trim() && v.voivodeship && v.lat && v.lng;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">
          Zdjęcia z dysku — kolejność na stronie ustala rodzaj kadru
        </h2>
        <p className="mt-1.5 text-[12px] text-muted">
          Zdjęciem tytułowym jest zawsze <span className="text-ink">narożnik</span>, dalej kosz A,
          kosz B, detal kosza, nawierzchnia i ujęcie ogólne. Strzałki przestawiają zdjęcia tego
          samego rodzaju.
        </p>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-hairline bg-white/4 px-6 py-8 text-center transition hover:border-flame/50 hover:bg-white/6">
          <span className="grid h-11 w-11 place-items-center rounded-full flame-gradient text-[20px] text-black">
            +
          </span>
          <span className="text-[14px] font-medium">Wybierz zdjęcia</span>
          <span className="text-[12px] text-muted">
            Możesz zaznaczyć kilka naraz. Skalujemy je do 1920 px i zapisujemy jako JPEG.
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {photos.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <div key={p.key} className="glass overflow-hidden rounded-[20px]">
                <div className="relative aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => drop(i)}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-[14px] transition hover:text-ember"
                    aria-label="Usuń zdjęcie"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 p-2.5">
                  <select
                    value={p.kind}
                    onChange={(e) => setKind(i, e.target.value as PhotoKind)}
                    className="field flex-1 bg-transparent px-2.5 py-1.5 text-[12px] outline-none"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    className="rounded-lg border border-hairline px-2 py-1 text-[12px] text-muted transition hover:text-ink"
                    aria-label="W lewo"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    className="rounded-lg border border-hairline px-2 py-1 text-[12px] text-muted transition hover:text-ink"
                    aria-label="W prawo"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] uppercase tracking-[0.18em] text-faint">
          Lokalizacja
        </h2>
        <LocationPicker lat={v.lat} lng={v.lng} onChange={(lat, lng) => set({ lat, lng })} />

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Szerokość (lat)">
            <input
              type="number"
              step="0.000001"
              value={v.lat}
              onChange={(e) => set({ lat: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <Field label="Długość (lng)">
            <input
              type="number"
              step="0.000001"
              value={v.lng}
              onChange={(e) => set({ lng: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={fillFromMap}
            className="glass self-end rounded-2xl px-4 py-3 text-[13px] font-medium transition hover:bg-white/10"
          >
            Uzupełnij miasto z mapy
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] uppercase tracking-[0.18em] text-faint">Opis boiska</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nazwa">
            <input
              value={v.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="np. Park Jordana"
              className="w-full bg-transparent outline-none placeholder:text-faint"
            />
          </Field>
          <Field label="Miasto">
            <input
              value={v.city}
              onChange={(e) => set({ city: e.target.value })}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <Field label="Województwo">
            <select
              value={v.voivodeship}
              onChange={(e) => set({ voivodeship: e.target.value })}
              className="w-full bg-transparent outline-none"
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

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Typ">
            <select
              value={v.type}
              onChange={(e) => set({ type: e.target.value as CourtType })}
              className="w-full bg-transparent outline-none"
            >
              {(Object.keys(TYPE_LABEL) as CourtType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nawierzchnia">
            <select
              value={v.surface}
              onChange={(e) => set({ surface: e.target.value as Surface })}
              className="w-full bg-transparent outline-none"
            >
              {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => (
                <option key={s} value={s}>
                  {SURFACE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Liczba koszy">
            <input
              type="number"
              min={1}
              max={12}
              value={v.hoops}
              onChange={(e) => set({ hoops: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <Field label="Autor wpisu">
            <input
              value={v.addedByName}
              onChange={(e) => set({ addedByName: e.target.value })}
              className="w-full bg-transparent outline-none"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Dostępność">
            <select
              value={v.access}
              onChange={(e) =>
                set({
                  access: e.target.value as Access,
                  hours: e.target.value === "24h" ? "całą dobę" : v.hours,
                })
              }
              className="w-full bg-transparent outline-none"
            >
              {(Object.keys(ACCESS_LABEL) as Access[]).map((a) => (
                <option key={a} value={a}>
                  {ACCESS_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Godziny">
            <input
              value={v.hours}
              onChange={(e) => set({ hours: e.target.value })}
              placeholder="np. 06:00 - 22:00"
              className="w-full bg-transparent outline-none placeholder:text-faint"
            />
          </Field>
          <Toggle label="Oświetlenie" on={v.lit} onClick={() => set({ lit: !v.lit })} />
          <Toggle label="Ogrodzenie" on={v.fenced} onClick={() => set({ fenced: !v.fenced })} />
        </div>

        <Field label="Opis">
          <textarea
            value={v.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
            placeholder="Stan nawierzchni, obręcze, o której schodzi się towarzystwo…"
            className="w-full resize-none bg-transparent outline-none placeholder:text-faint"
          />
        </Field>

        <div
          className={`rounded-2xl border transition ${
            v.basketApproved ? "border-basket/60 bg-basket/12" : "border-hairline bg-white/4"
          }`}
        >
          <button
            type="button"
            onClick={() => set({ basketApproved: !v.basketApproved })}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <BasketApprovedBadge />
            <span className="text-[13px] text-muted">
              Twoja osobista rekomendacja — sekcja na karcie boiska
            </span>
            <span className="switch ml-auto" data-on={v.basketApproved} />
          </button>

          {v.basketApproved && (
            <div className="border-t border-basket/25 px-4 py-3">
              <textarea
                value={v.basketNote}
                onChange={(e) => set({ basketNote: e.target.value })}
                rows={3}
                maxLength={400}
                placeholder="Dwa, trzy zdania: dlaczego to boisko jest wyjątkowe…"
                className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-faint">
                <span>Tekst pojawi się dużą czcionką w fioletowej sekcji.</span>
                <span>{v.basketNote.length}/400</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {error}
        </p>
      )}

      {savedSlug && !error && (
        <div className="glass flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3 text-[13px]">
          <span className="grid h-7 w-7 place-items-center rounded-full flame-gradient text-black">
            ✓
          </span>
          <span className="flex-1">Boisko opublikowane i widoczne na mapie.</span>
          <Link href={`/boisko/${savedSlug}`} className="font-semibold text-flame hover:text-glow">
            zobacz kartę →
          </Link>
          {!initial && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-hairline bg-white/5 px-3 py-1.5 font-medium transition hover:bg-white/10"
            >
              Dodaj kolejne
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="glass rounded-2xl px-5 py-3.5 text-[14px] font-medium"
          >
            Anuluj
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready || saving}
          className="flex-1 rounded-2xl flame-gradient px-6 py-3.5 text-[15px] font-bold text-black transition hover:brightness-110 disabled:opacity-35"
        >
          {saving
            ? "Zapisuję i wgrywam zdjęcia…"
            : initial
              ? "Zapisz zmiany"
              : "Opublikuj boisko na mapie"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span className="field flex px-3.5 py-2.5 text-[13px]">{children}</span>
    </label>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="field flex flex-col items-start gap-2 px-3.5 py-2.5"
    >
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="switch" data-on={on} />
    </button>
  );
}
