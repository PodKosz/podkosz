"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminCourt, deleteCourt, listCourtsForAdmin } from "@/lib/admin";
import { TYPE_LABEL } from "@/lib/types";
import { CourtForm } from "./CourtForm";
import { FireBallIcon, BasketApprovedBadge, PinIcon } from "../icons";

/** Lista opublikowanych boisk z edycją i kasowaniem. */
export function CourtsAdmin({
  onChanged,
  editSlug,
}: {
  onChanged?: () => void;
  /** slug z adresu ?edytuj= — otwiera edytor tego boiska od razu po wczytaniu listy */
  editSlug?: string | null;
}) {
  const [courts, setCourts] = useState<AdminCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCourt | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCourtsForAdmin()
      .then((list) => {
        if (!alive) return;
        setCourts(list);
        if (editSlug) setEditing(list.find((c) => c.slug === editSlug) ?? null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // celowo tylko na starcie: później edytor otwiera się kliknięciem w liście
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    listCourtsForAdmin()
      .then((list) => {
        setCourts(list);
        setLoading(false);
        onChanged?.();
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [onChanged]);

  if (editing) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Edycja: {editing.name}, {editing.city}
          </h2>
          <Link
            href={`/boisko/${editing.slug}`}
            className="text-[13px] text-flame transition hover:text-glow"
          >
            otwórz kartę boiska →
          </Link>
        </div>
        <CourtForm
          initial={editing}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję boiska…
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

  if (!courts.length) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Na mapie nie ma jeszcze żadnego boiska.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {courts.map((c) => (
        <article key={c.id} className="glass flex items-center gap-4 rounded-[22px] p-3.5">
          <span className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-hairline bg-black/40">
            {c.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photos[0].previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <Link
                href={`/boisko/${c.slug}`}
                className="truncate text-[16px] font-semibold transition hover:text-flame"
              >
                {c.name}
              </Link>
              {c.basketApproved && <BasketApprovedBadge />}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
              <span className="flex items-center gap-1">
                <PinIcon className="h-3.5 w-3.5" /> {c.city}, {c.voivodeship}
              </span>
              <span>{TYPE_LABEL[c.type]}</span>
              <span>{c.photos.length} zdjęć</span>
              <span className="flex items-center gap-1 text-glow">
                <FireBallIcon className="h-3.5 w-3.5" /> {c.likes}
              </span>
            </span>
          </span>

          {confirming === c.id ? (
            <span className="flex shrink-0 items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await deleteCourt(c.id);
                    setConfirming(null);
                    reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
                className="rounded-xl bg-ember/20 px-3 py-2 text-[12px] font-semibold text-ember"
              >
                usuń na pewno
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="px-2 text-[12px] text-faint hover:text-muted"
              >
                anuluj
              </button>
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditing(c)}
                className="rounded-xl border border-hairline bg-white/5 px-4 py-2 text-[13px] font-medium transition hover:bg-white/10"
              >
                Edytuj
              </button>
              <button
                onClick={() => setConfirming(c.id)}
                className="px-2 text-[12px] text-faint transition hover:text-ember"
              >
                usuń
              </button>
            </span>
          )}
        </article>
      ))}
    </div>
  );
}
