"use client";

import Link from "next/link";
import {
  DB_LIMIT,
  STORAGE_LIMIT,
  formatBytes,
  useAdminOverview,
} from "@/lib/stats";

/** Tabelka stanu projektu: baza, ludzie, kolejka i zużycie darmowych limitów. */
export function StatsAdmin() {
  const { data, loading, error, reload } = useAdminOverview();

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Liczę statystyki…
      </p>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
        <p>{error ?? "Brak danych."}</p>
        <p className="mt-2 text-muted">
          Jeśli to pierwszy raz po wdrożeniu, uruchom migrację
          <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5">
            supabase/migration-statystyki-plakietka-shorts.sql
          </code>
          — dokłada funkcję <code>admin_overview()</code>.
        </p>
      </div>
    );
  }

  const storagePct = Math.min(100, (data.storage_bytes / STORAGE_LIMIT) * 100);
  const dbPct = Math.min(100, (data.db_bytes / DB_LIMIT) * 100);

  return (
    <div className="space-y-6">
      {/* zużycie darmowych limitów */}
      <section className="glass rounded-[24px] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Miejsce na hostingu</h2>
          <button
            onClick={() => void reload()}
            className="text-[12px] uppercase tracking-[0.12em] text-muted transition hover:text-ink"
          >
            odśwież
          </button>
        </div>

        <Bar
          label="Zdjęcia w Storage"
          used={data.storage_bytes}
          limit={STORAGE_LIMIT}
          pct={storagePct}
          note={`${data.storage_files} plików · ${
            data.photos > 0
              ? formatBytes(Math.round(data.storage_bytes / Math.max(data.photos, 1)))
              : "0 B"
          } średnio na zdjęcie`}
        />

        <Bar
          label="Baza danych"
          used={data.db_bytes}
          limit={DB_LIMIT}
          pct={dbPct}
          note="wiersze, indeksy i kandydaci z OSM"
          className="mt-5"
        />

        <p className="mt-4 text-[12px] leading-relaxed text-faint">
          Limity darmowego planu Supabase: 1 GB na pliki i 500 MB na bazę. Przy obecnej wadze
          zdjęć zmieści się jeszcze około{" "}
          <b className="text-muted">
            {data.photos > 0 && data.storage_bytes > 0
              ? Math.max(
                  0,
                  Math.floor(
                    (STORAGE_LIMIT - data.storage_bytes) /
                      Math.max(1, (data.storage_bytes / Math.max(data.photos, 1)) * 8)
                  )
                )
              : "—"}
          </b>{" "}
          boisk po osiem zdjęć.
        </p>
      </section>

      {/* liczby */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile value={data.courts} label="Boiska na mapie" accent />
        <Tile value={data.photos} label="Zdjęć w galeriach" />
        <Tile value={data.likes} label="Podpaleń łącznie" />
        <Tile value={data.favorites} label="Dodań do ulubionych" />

        <Tile value={data.users} label="Kont użytkowników" />
        <Tile value={data.users_recent} label="Logowań w 30 dni" />
        <Tile value={data.unique_ips} label="Unikalnych adresów IP" />
        <Tile value={data.unique_ips_30d} label="Unikalnych IP w 30 dni" />

        <Tile value={data.submissions_pending} label="Zgłoszeń do akceptacji" warn={data.submissions_pending > 0} />
        <Tile value={data.reports_open} label="Otwartych błędów w danych" warn={data.reports_open > 0} />
        <Tile value={data.feedback_open} label="Nowych opinii" warn={data.feedback_open > 0} />
        <Tile value={data.visits_today} label="Wejść dzisiaj" />

        <Tile value={data.courts_approved} label="Basket Approved" />
        <Tile value={data.courts_funny} label="Dziwnych boisk" lime />
        <Tile value={data.courts_shorts} label="Boisk z filmikiem" />
        <Tile value={data.leads_new} label="Kandydatów OSM do sprawdzenia" />
      </section>

      <section className="glass rounded-[24px] p-5 text-[13px] leading-relaxed text-muted">
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Co z tego wynika</h2>
        <ul className="space-y-1.5">
          <li>
            · Zgłoszenia i błędy warto domykać na bieżąco —{" "}
            {data.submissions_pending + data.reports_open + data.feedback_open === 0
              ? "w tej chwili nic nie czeka."
              : `czeka ${data.submissions_pending + data.reports_open + data.feedback_open} spraw.`}
          </li>
          <li>
            · Z kandydatów OSM opublikowałeś już {data.leads_added} boisk, zostało{" "}
            {data.leads_new}.{" "}
            <Link href="/admin?edytuj=" className="text-flame hover:text-glow">
              &nbsp;
            </Link>
          </li>
          <li>
            · Unikalne adresy IP liczymy od wdrożenia tej wersji i wyłącznie jako skróty —
            surowych adresów nie zapisujemy, więc statystyka jest zgodna z RODO.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Bar({
  label,
  used,
  limit,
  pct,
  note,
  className = "",
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
  note?: string;
  className?: string;
}) {
  const danger = pct > 85;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {formatBytes(used)} / {formatBytes(limit)}{" "}
          <span className={danger ? "text-ember" : "text-faint"}>({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            danger ? "bg-ember" : "flame-gradient"
          }`}
          style={{ width: `${Math.max(1.5, pct)}%` }}
        />
      </div>
      {note && <p className="mt-1.5 text-[11px] text-faint">{note}</p>}
    </div>
  );
}

function Tile({
  value,
  label,
  accent,
  lime,
  warn,
}: {
  value: number;
  label: string;
  accent?: boolean;
  lime?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="glass rounded-[20px] p-4">
      <p
        className={`text-[26px] font-bold leading-none tabular-nums ${
          accent ? "flame-text" : lime ? "lime-text" : warn ? "text-ember" : "text-ink"
        }`}
      >
        {value.toLocaleString("pl-PL")}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-muted">{label}</p>
    </div>
  );
}
