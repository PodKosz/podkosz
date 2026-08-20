"use client";

import { useState } from "react";
import { useBetaTesterzy } from "@/lib/beta";

/**
 * Beta testerzy: adresy, które wchodzą na stronę przed premierą.
 *
 * Osoba z listy loguje się na `podkosz.pl` przez Google tym właśnie adresem - zasłona
 * przepuszcza ją dalej i od tego momentu widzi cały serwis. Bez konta (albo z innym adresem)
 * zostaje na stronie „Już niedługo".
 */
export function BetaAdmin() {
  const { items, loading, error, dodaj, usun } = useBetaTesterzy();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  const zapisz = async () => {
    setZapisuje(true);
    const wynik = await dodaj(email, note);
    setZapisuje(false);
    setBlad(wynik);
    if (!wynik) {
      setEmail("");
      setNote("");
    }
  };

  if (loading) {
    return (
      <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
        Wczytuję listę…
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
    <div className="space-y-6">
      <div className="glass rounded-[24px] p-6">
        <h2 className="text-[17px] font-semibold tracking-tight">Dodaj beta testera</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Wpisz adres Google, którym ta osoba się zaloguje. Po zalogowaniu na{" "}
          <span className="text-ink">podkosz.pl</span> przechodzi przez zasłonę i widzi cały
          serwis - łącznie z dodawaniem boisk. Adres musi być dokładnie ten, na który ma konto
          Google.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setBlad(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void zapisz();
            }}
            placeholder="imie.nazwisko@gmail.com"
            className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-flame/60"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void zapisz();
            }}
            placeholder="notatka, np. „Kuba z Krakowa”"
            className="min-w-0 flex-1 rounded-2xl border border-hairline bg-white/6 px-4 py-3 text-[14px] outline-none transition focus:border-flame/60 sm:max-w-[280px]"
          />
          <button
            onClick={() => void zapisz()}
            disabled={zapisuje || !email.trim()}
            className="shrink-0 rounded-2xl flame-gradient px-6 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {zapisuje ? "Dodaję…" : "Dodaj"}
          </button>
        </div>

        {blad && (
          <p className="mt-3 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-[13px] text-ember">
            {blad}
          </p>
        )}

      </div>

      <div>
        <h2 className="mb-3 text-[13px] uppercase tracking-[0.16em] text-faint">
          Na liście: {items.length}
        </h2>

        {!items.length ? (
          <p className="glass rounded-[24px] p-10 text-center text-[15px] text-muted">
            Nikogo tu jeszcze nie ma. Poza Tobą stronę widzi tylko osoba z kluczem w adresie.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <li
                key={b.email}
                className="glass flex items-center gap-4 rounded-[20px] px-4 py-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{b.email}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {b.note ? `${b.note} · ` : ""}
                    dodany {new Date(b.created_at).toLocaleDateString("pl-PL")}
                  </span>
                </span>
                <button
                  onClick={() => void usun(b.email)}
                  className="shrink-0 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium text-muted transition hover:border-ember/50 hover:text-ember"
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
