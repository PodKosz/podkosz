"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ACCESS_LABEL,
  Access,
  CourtType,
  PHOTO_KIND_LABEL,
  SURFACE_LABEL,
  Surface,
  TYPE_LABEL,
  VOIVODESHIPS,
} from "@/lib/types";
import { REJECT_REASONS, Submission, SubmissionStatus } from "@/lib/submissions";
import { useQueue } from "@/lib/queue";
import { supabaseEnabled } from "@/lib/supabase/config";
import { signInWithGoogle } from "@/lib/auth";
import { BasketApprovedBadge, PinIcon } from "../icons";
import { GoogleMark } from "../GoogleMark";
import { Lightbox } from "../Lightbox";
import { CourtsAdmin } from "./CourtsAdmin";
import { CourtForm } from "./CourtForm";
import { ReportsAdmin } from "./ReportsAdmin";
import { FeedbackAdmin } from "./FeedbackAdmin";
import { LeadsAdmin } from "./LeadsAdmin";
import { BrakiAdmin } from "./BrakiAdmin";
import { StatsAdmin } from "./StatsAdmin";
import { BetaAdmin } from "./BetaAdmin";
import { ZapisyAdmin } from "./ZapisyAdmin";
import { UsersAdmin } from "./UsersAdmin";
import { NewFromLead } from "./NewFromLead";

const TABS: [SubmissionStatus, string][] = [
  ["pending", "Do akceptacji"],
  ["approved", "Opublikowane"],
  ["rejected", "Odrzucone"],
];

type View =
  | "queue"
  | "stats"
  | "reports"
  | "braki"
  | "feedback"
  | "courts"
  | "leads"
  | "beta"
  | "zapisy"
  | "users"
  | "new";

const VIEWS: [View, string][] = [
  ["queue", "Kolejka zgłoszeń"],
  ["stats", "Statystyki"],
  ["reports", "Błędy w danych"],
  ["braki", "Braki w danych"],
  ["feedback", "Opinie"],
  ["courts", "Boiska na mapie"],
  ["leads", "Kandydaci OSM"],
  ["beta", "Beta testerzy"],
  ["zapisy", "Zapisy na otwarcie"],
  ["users", "Użytkownicy"],
  ["new", "Dodaj ręcznie"],
];

export function AdminPanel({ isAdmin, signedIn }: { isAdmin: boolean; signedIn: boolean }) {
  const path = usePathname();
  const params = useSearchParams();
  // ?edytuj=<slug> - skrót z przycisku „Edytuj” na karcie boiska
  const editSlug = params.get("edytuj");
  // ?nowe=<id kandydata> - skrót z szarej pinezki na mapie
  const newLeadId = params.get("nowe");
  const queue = useQueue();
  const [view, setView] = useState<View>(
    editSlug ? "courts" : newLeadId ? "new" : "queue"
  );
  const [tab, setTab] = useState<SubmissionStatus>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** zaznaczone zgłoszenia do publikacji paczką */
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** czy w otwartym zgłoszeniu jest rozwinięty formularz odrzucenia (skrót R) */
  const [rejecting, setRejecting] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const list = queue.list;
  const visible = list.filter((s) => s.status === tab);
  const open = list.find((s) => s.id === openId) ?? null;

  /**
   * Powiadamia autora o decyzji. Endpoint sam pilnuje, żeby ta sama decyzja nie poszła
   * dwa razy, a brak konfiguracji poczty nie może wywrócić moderacji.
   */
  const notifyAuthor = async (
    s: Submission,
    decision: "approved" | "rejected",
    reason?: string
  ) => {
    if (!s.author.email) return false;
    try {
      const res = await fetch("/api/mail-zgloszenie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: s.id,
          decision,
          reason,
          courtName: s.name,
        }),
      });
      const data = (await res.json()) as { sent?: boolean };
      return !!data.sent;
    } catch {
      return false;
    }
  };

  /*
    Skróty klawiszowe kolejki. Przy pięćdziesięciu zgłoszeniach dziennie różnica między
    klikaniem i klawiaturą to kilkanaście minut. Ignorujemy klawisze wpisywane w pola
    tekstowe, żeby nie odrzucać zgłoszenia przy pisaniu powodu.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "queue" || e.ctrlKey || e.metaKey || e.altKey) return;

      const cel = e.target as HTMLElement | null;
      if (
        cel &&
        (cel.tagName === "INPUT" ||
          cel.tagName === "TEXTAREA" ||
          cel.tagName === "SELECT" ||
          cel.isContentEditable)
      ) {
        return;
      }

      const idx = visible.findIndex((x) => x.id === openId);
      const key = e.key.toLowerCase();

      if (key === "escape") {
        setOpenId(null);
        setRejecting(false);
      } else if (key === "j") {
        const next = visible[idx < 0 ? 0 : Math.min(idx + 1, visible.length - 1)];
        if (next) {
          setOpenId(next.id);
          setRejecting(false);
        }
      } else if (key === "k") {
        const prev = visible[idx <= 0 ? 0 : idx - 1];
        if (prev) {
          setOpenId(prev.id);
          setRejecting(false);
        }
      } else if (key === "a" && open?.status === "pending") {
        e.preventDefault();
      } else if (key === "r" && open?.status === "pending") {
        e.preventDefault();
        setRejecting(true);
      } else {
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, visible, openId, open]);

  /** Publikuje po kolei wszystkie zaznaczone zgłoszenia. */
  const approveMany = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of picked) {
      const s = list.find((x) => x.id === id);
      if (!s || s.status !== "pending") continue;
      try {
        await queue.approve(id);
        await notifyAuthor(s, "approved");
        ok += 1;
      } catch {
        // pojedyncza wywrotka nie może zatrzymać reszty paczki
      }
    }
    setPicked([]);
    setBulkBusy(false);
    flash(`Opublikowano ${ok} z ${picked.length} zaznaczonych.`);
  };


  const approve = async (s: Submission) => {
    try {
      await queue.approve(s.id);
      setOpenId(null);
      const sent = await notifyAuthor(s, "approved");
      flash(
        sent
          ? "Opublikowano. Autor dostał maila o publikacji."
          : s.author.email
            ? "Opublikowano. Maila nie udało się wysłać - sprawdź konfigurację poczty."
            : "Opublikowano. Pinezka jest już na mapie."
      );
    } catch (e) {
      flash(`Nie udało się opublikować: ${(e as Error).message}`);
    }
  };

  const reject = async (s: Submission, reason: string) => {
    await queue.reject(s.id, reason);
    setOpenId(null);
    const sent = await notifyAuthor(s, "rejected", reason);
    flash(
      sent
        ? `Odrzucono. Autor dostał maila z powodem: „${reason}”.`
        : s.author.email
          ? "Odrzucono. Maila nie udało się wysłać - sprawdź konfigurację poczty."
          : "Odrzucono. Zgłoszenie anonimowe - brak adresu do powiadomienia."
    );
  };



  /* Z podpiętą bazą kolejkę widzi wyłącznie administrator (pilnuje tego też RLS). */
  if (supabaseEnabled && !isAdmin) {
    return (
      <div className="glass mx-auto max-w-lg rounded-[26px] p-8 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">Panel administratora</h1>
        <p className="mt-3 text-[14px] text-muted">
          {signedIn
            ? "Twoje konto nie ma uprawnień moderatora. Nadaj sobie rolę „admin” w tabeli profiles."
            : "Zaloguj się kontem administratora, żeby zobaczyć kolejkę zgłoszeń."}
        </p>
        {!signedIn && (
          <button
            onClick={() => signInWithGoogle(path)}
            className="mx-auto mt-6 flex items-center gap-3 rounded-2xl border border-hairline bg-white/6 px-5 py-3 text-[14px] font-medium transition hover:bg-white/10"
          >
            <GoogleMark className="h-6 w-6" /> Zaloguj przez Google
          </button>
        )}
      </div>
    );
  }

  if (view !== "queue") {
    return (
      <div className="relative">
        <Header view={view} setView={setView} live={queue.live} />
        {view === "stats" ? (
          <StatsAdmin />
        ) : view === "courts" ? (
          <CourtsAdmin editSlug={editSlug} />
        ) : view === "reports" ? (
          <ReportsAdmin />
        ) : view === "braki" ? (
          <BrakiAdmin />
        ) : view === "feedback" ? (
          <FeedbackAdmin />
        ) : view === "leads" ? (
          <LeadsAdmin />
        ) : view === "beta" ? (
          <BetaAdmin />
        ) : view === "zapisy" ? (
          <ZapisyAdmin />
        ) : view === "users" ? (
          <UsersAdmin />
        ) : newLeadId ? (
          <NewFromLead leadId={newLeadId} onSaved={() => undefined} />
        ) : (
          <CourtForm onSaved={() => undefined} />
        )}
        {toast && (
          <div className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-[14px] rise">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Header view={view} setView={setView} live={queue.live} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-full border border-hairline bg-white/5 p-1">
          {TABS.map(([k, label]) => {
            const n = list.filter((s) => s.status === k).length;
            return (
              <button
                key={k}
                onClick={() => {
                  setTab(k);
                  setOpenId(null);
                }}
                className={`rounded-full px-5 py-2.5 text-[13px] font-medium transition ${
                  tab === k ? "flame-gradient text-black" : "text-muted hover:text-ink"
                }`}
              >
                {label} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
        {queue.live && (
          <button
            onClick={queue.reload}
            className="rounded-full border border-hairline bg-white/5 px-4 py-2.5 text-[12px] uppercase tracking-[0.1em] text-muted transition hover:text-ink"
          >
            odśwież
          </button>
        )}
      </div>

      {queue.error && (
        <p className="mb-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
          {queue.error}
        </p>
      )}

      {queue.loading && (
        <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
          Wczytuję kolejkę…
        </p>
      )}

      {!queue.loading && !visible.length && (
        <div className="glass rounded-[24px] p-10 text-center">
          <p className="text-[15px] text-muted">
            {tab === "pending" ? "Brak zgłoszeń w kolejce." : "Nic tu jeszcze nie ma."}
          </p>
          {tab === "pending" && (
            <Link
              href="/dodaj"
              className="mt-4 inline-block rounded-2xl flame-gradient px-5 py-3 text-[14px] font-bold text-black"
            >
              Wyślij testowe zgłoszenie
            </Link>
          )}
        </div>
      )}

      {tab === "pending" && visible.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              setPicked(picked.length === visible.length ? [] : visible.map((s) => s.id))
            }
            className="rounded-full border border-hairline bg-white/5 px-4 py-2 text-[12px] uppercase tracking-[0.1em] text-muted transition hover:text-ink"
          >
            {picked.length === visible.length ? "odznacz wszystkie" : "zaznacz wszystkie"}
          </button>
          {picked.length > 0 && (
            <button
              onClick={() => void approveMany()}
              disabled={bulkBusy}
              className="rounded-full flame-gradient px-4 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {bulkBusy
                ? "publikuję…"
                : `opublikuj zaznaczone (${picked.length})`}
            </button>
          )}
          <span className="text-[12px] text-faint">
            skróty: A - opublikuj otwarte, R - odrzuć, J / K - następne i poprzednie, Esc - zwiń
          </span>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((s) => (
          <article
            key={s.id}
            className={`glass overflow-hidden rounded-[24px] ${
              openId === s.id ? "ring-1 ring-flame/50" : ""
            }`}
          >
            <div className="flex items-center gap-3 p-4 pb-0">
              {tab === "pending" && (
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-muted">
                  <input
                    type="checkbox"
                    checked={picked.includes(s.id)}
                    onChange={() =>
                      setPicked(
                        picked.includes(s.id)
                          ? picked.filter((id) => id !== s.id)
                          : [...picked, s.id]
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-flame)]"
                  />
                  do publikacji
                </label>
              )}
            </div>
            <button
              onClick={() => setOpenId(openId === s.id ? null : s.id)}
              className="flex w-full items-center gap-4 p-4 text-left"
            >
              <span className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-hairline bg-black/40">
                {s.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photos[0].url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[16px] font-semibold">
                    {s.name || "(bez nazwy)"}
                  </span>
                  {s.basketApproved && <BasketApprovedBadge />}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span className="flex items-center gap-1">
                    <PinIcon className="h-3.5 w-3.5" /> {s.city}, {s.voivodeship}
                  </span>
                  <span>{s.photos.length} zdjęć</span>
                  <span>
                    {s.author.mode === "guest" ? "gość" : "konto"}
                    {s.author.email ? ` · ${s.author.email}` : ""}
                  </span>
                  <span>{new Date(s.createdAt).toLocaleString("pl-PL")}</span>
                </span>
                {s.rejectReason && (
                  <span className="mt-1 block text-[12px] text-ember">Powód: {s.rejectReason}</span>
                )}
              </span>
              <span className="shrink-0 text-[12px] uppercase tracking-[0.12em] text-faint">
                {openId === s.id ? "zwiń" : "otwórz"}
              </span>
            </button>

            {open?.id === s.id && (
              <Editor
                s={open}
                rejecting={rejecting}
                setRejecting={setRejecting}
                onPatch={(p) => queue.patch(s.id, p)}
                onDeletePhoto={(i) => queue.removePhoto(open, i)}
                onApprove={() => approve(open)}
                onReject={(r) => reject(open, r)}
                onDelete={async () => {
                  await queue.remove(s.id);
                  setOpenId(null);
                  flash("Zgłoszenie usunięte na stałe.");
                }}
              />
            )}
          </article>
        ))}
      </div>

      {!queue.live && list.length > 0 && (
        <button
          onClick={() => {
            queue.clearAll();
            flash("Wyczyszczono lokalną kolejkę.");
          }}
          className="mt-8 text-[12px] uppercase tracking-[0.12em] text-faint transition hover:text-muted"
        >
          wyczyść wszystkie zgłoszenia (dane testowe)
        </button>
      )}

      {toast && (
        <div className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-[14px] rise">
          {toast}
        </div>
      )}
    </div>
  );
}

function Header({
  view,
  setView,
  live,
}: {
  view: View;
  setView: (v: View) => void;
  live: boolean;
}) {
  const TITLES: Record<View, [string, string]> = {
    queue: [
      "Kolejka zgłoszeń",
      "Zgłoszenia z formularza „Dodaj boisko”. Popraw dane, usuń nieudane zdjęcia, nadaj Mualę albo odrzuć z konkretnym powodem.",
    ],
    courts: [
      "Boiska na mapie",
      "Wszystko, co jest już opublikowane. Możesz poprawić opis, wymienić zdjęcia albo skasować wpis.",
    ],
    reports: [
      "Błędy w danych",
      "Zgłoszenia od użytkowników: złe godziny, nieaktualne informacje, zdjęcia nie z tego boiska. Domyślnie na górze te boiska, na które skarży się najwięcej osób.",
    ],
    braki: [
      "Braki w danych",
      "Opublikowane boiska z lukami: bez zdjęć, bez godzin, bez nawierzchni albo z jednozdaniowym opisem. Lista do odhaczenia, zamiast szukania po mapie.",
    ],
    feedback: [
      "Opinie",
      "Co użytkownicy chcieliby poprawić. Każdy może wysłać jedną opinię na dobę - okienko jest na stronie „O nas”.",
    ],
    stats: [
      "Statystyki",
      "Stan projektu w liczbach: baza, ludzie, kolejka i zużycie darmowych limitów hostingu.",
    ],
    leads: [
      "Kandydaci OSM",
      "Boiska wypatrzone w OpenStreetMap - lista miejsc do sprawdzenia. Widzisz je tylko Ty, jako szare pinezki na mapie po włączeniu przycisku.",
    ],
    users: [
      "Użytkownicy",
      "Konta w serwisie. Blokada nie usuwa konta - osoba nadal przegląda mapę, ale baza odrzuca jej zgłoszenia, podpalenia, ulubione i zapisy na grę. Niżej lista słów zakazanych w nickach.",
    ],
    zapisy: [
      "Zapisy na otwarcie",
      "Adresy zostawione na stronie „Już niedługo”. W dniu premiery wysyłasz stąd jedną wiadomość: strona działa, można się logować. Poczta przyjmuje 90 listów naraz, więc przy większej liczbie kliknij kilka razy - licznik pokaże, ile zostało.",
    ],
    beta: [
      "Beta testerzy",
      "Adresy, które wchodzą na stronę przed premierą. Osoba z listy loguje się przez Google tym adresem i widzi cały serwis; wszyscy inni zostają na „Już niedługo”.",
    ],
    new: [
      "Dodaj boisko ręcznie",
      "Ścieżka redakcyjna: zdjęcia z dysku, pinezka wskazana na mapie, opis wpisany z ręki. Publikuje od razu, z pominięciem kolejki.",
    ],
  };
  const [title, lead] = TITLES[view];

  return (
    <header className="mb-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-flame">Panel administratora</p>
      <h1 className="mt-2 text-[clamp(30px,5vw,46px)] font-semibold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        {lead}
        {!live && (
          <span className="text-faint"> Tryb testowy - dane siedzą w tej przeglądarce.</span>
        )}
      </p>

      <div className="mt-6 inline-flex gap-1 rounded-full border border-hairline bg-white/5 p-1">
        {VIEWS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`rounded-full px-5 py-2.5 text-[13px] font-medium transition ${
              view === k ? "bg-white/14 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Editor({
  s,
  onPatch,
  onDeletePhoto,
  onApprove,
  onReject,
  onDelete,
  rejecting,
  setRejecting,
}: {
  s: Submission;
  onPatch: (p: Partial<Submission>) => void;
  onDeletePhoto: (index: number) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
  /** stan formularza odrzucenia siedzi w rodzicu, żeby dał się włączyć skrótem klawiszowym */
  rejecting: boolean;
  setRejecting: (v: boolean) => void;
}) {
  const [customReason, setCustomReason] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);

  return (
    <div className="border-t border-hairline p-5">
      {zoom !== null && (
        <Lightbox
          items={s.photos.map((p) => ({
            url: p.url,
            caption: PHOTO_KIND_LABEL[p.kind] ?? p.kind,
          }))}
          index={zoom}
          onIndex={setZoom}
          onClose={() => setZoom(null)}
        />
      )}
      <h3 className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Zdjęcia - klik powiększa, × usuwa nieudane
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {s.photos.map((p, i) => (
          <div
            key={p.id ?? i}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-hairline"
          >
            <button
              type="button"
              onClick={() => setZoom(i)}
              className="absolute inset-0 z-10"
              aria-label="Powiększ zdjęcie"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.kind} className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[9px] uppercase tracking-wide text-muted">
              {PHOTO_KIND_LABEL[p.kind] ?? p.kind}
            </span>
            <button
              onClick={() => onDeletePhoto(i)}
              className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-[13px] text-ink opacity-0 transition group-hover:opacity-100"
              aria-label="Usuń zdjęcie"
            >
              ×
            </button>
          </div>
        ))}
        {!s.photos.length && <p className="col-span-6 text-[13px] text-muted">Brak zdjęć.</p>}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <L label="Nazwa">
          <input
            value={s.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className="w-full bg-transparent outline-none"
          />
        </L>
        <L label="Miasto">
          <input
            value={s.city}
            onChange={(e) => onPatch({ city: e.target.value })}
            className="w-full bg-transparent outline-none"
          />
        </L>
        <L label="Województwo">
          <select
            value={s.voivodeship}
            onChange={(e) => onPatch({ voivodeship: e.target.value })}
            className="w-full bg-transparent outline-none"
          >
            <option value="">-</option>
            {VOIVODESHIPS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </L>
        <L label="Godziny">
          <input
            value={s.hours}
            onChange={(e) => onPatch({ hours: e.target.value })}
            className="w-full bg-transparent outline-none"
          />
        </L>
        <L label="Typ">
          <select
            value={s.type}
            onChange={(e) => onPatch({ type: e.target.value as CourtType })}
            className="w-full bg-transparent outline-none"
          >
            {(Object.keys(TYPE_LABEL) as CourtType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </L>
        <L label="Nawierzchnia">
          <select
            value={s.surface}
            onChange={(e) => onPatch({ surface: e.target.value as Surface })}
            className="w-full bg-transparent outline-none"
          >
            {(Object.keys(SURFACE_LABEL) as Surface[]).map((t) => (
              <option key={t} value={t}>
                {SURFACE_LABEL[t]}
              </option>
            ))}
          </select>
        </L>
        <L label="Dostępność">
          <select
            value={s.access}
            onChange={(e) => onPatch({ access: e.target.value as Access })}
            className="w-full bg-transparent outline-none"
          >
            {(Object.keys(ACCESS_LABEL) as Access[]).map((t) => (
              <option key={t} value={t}>
                {ACCESS_LABEL[t]}
              </option>
            ))}
          </select>
        </L>
        <L label="Kosze">
          <input
            type="number"
            value={s.hoops}
            onChange={(e) => onPatch({ hoops: Number(e.target.value) })}
            className="w-full bg-transparent outline-none"
          />
        </L>
        <L label="Współrzędne">
          <span className="flex gap-2">
            <input
              type="number"
              step="0.00001"
              value={s.lat}
              onChange={(e) => onPatch({ lat: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
            <input
              type="number"
              step="0.00001"
              value={s.lng}
              onChange={(e) => onPatch({ lng: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </span>
        </L>
        <L label="Opis / uwagi">
          <input
            value={s.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            className="w-full bg-transparent outline-none"
          />
        </L>
      </div>

      <div
        className={`mt-5 rounded-2xl border transition ${
          s.basketApproved ? "border-basket/60 bg-basket/12" : "border-hairline bg-white/4"
        }`}
      >
        <button
          onClick={() => onPatch({ basketApproved: !s.basketApproved })}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <BasketApprovedBadge />
          <span className="text-[13px] text-muted">
            Twoja rekomendacja - fioletowa sekcja na karcie i fioletowa pinezka na mapie
          </span>
          <span className="switch ml-auto" data-on={!!s.basketApproved} />
        </button>

        {s.basketApproved && (
          <div className="border-t border-basket/25 px-4 py-3">
            <textarea
              value={s.basketNote ?? ""}
              onChange={(e) => onPatch({ basketNote: e.target.value })}
              rows={3}
              maxLength={400}
              placeholder="Dwa, trzy zdania: dlaczego to boisko jest wyjątkowe…"
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-faint">
              <span>Trafi dużą czcionką do sekcji Basket Approved.</span>
              <span>{(s.basketNote ?? "").length}/400</span>
            </div>
          </div>
        )}
      </div>

      {s.status === "pending" && !rejecting && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onApprove}
            className="flex-1 rounded-2xl flame-gradient px-5 py-3.5 text-[14px] font-bold text-black"
          >
            Akceptuj i opublikuj
          </button>
          <button
            onClick={() => setRejecting(true)}
            className="rounded-2xl border border-hairline bg-white/5 px-5 py-3.5 text-[14px] font-medium text-muted transition hover:text-ink"
          >
            Odrzuć
          </button>
          <button
            onClick={onDelete}
            className="rounded-2xl px-4 py-3.5 text-[13px] text-faint transition hover:text-ember"
          >
            usuń trwale
          </button>
        </div>
      )}

      {s.status === "pending" && rejecting && (
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Powód odrzucenia - trafi do autora
          </h3>
          <div className="mt-3 space-y-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => onReject(r)}
                className="w-full rounded-xl border border-hairline bg-white/4 px-4 py-3 text-left text-[13px] transition hover:border-ember/50 hover:bg-ember/10"
              >
                {r}
              </button>
            ))}
            <div className="field flex gap-2 px-4 py-2.5">
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="własny powód…"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
              <button
                onClick={() => customReason && onReject(customReason)}
                className="text-[12px] font-semibold text-flame disabled:opacity-40"
                disabled={!customReason}
              >
                wyślij
              </button>
            </div>
          </div>
          <button
            onClick={() => setRejecting(false)}
            className="mt-3 text-[12px] uppercase tracking-[0.12em] text-faint hover:text-muted"
          >
            anuluj
          </button>
        </div>
      )}

      {s.status !== "pending" && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onPatch({ status: "pending", rejectReason: undefined })}
            className="glass rounded-2xl px-5 py-3 text-[13px]"
          >
            Cofnij do kolejki
          </button>
          <button
            onClick={onDelete}
            className="rounded-2xl px-4 py-3 text-[13px] text-faint transition hover:text-ember"
          >
            usuń trwale
          </button>
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span className="field flex px-3.5 py-2.5 text-[13px]">{children}</span>
    </label>
  );
}
