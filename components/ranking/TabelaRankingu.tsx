"use client";

import { useState } from "react";
import Link from "next/link";
import type { Court } from "@/lib/types";
import { CourtPhoto } from "@/components/CourtPhoto";
import { plural } from "@/lib/site";

const CALA_POLSKA = "Cała Polska";
/** zakres paska wyniku - poniżej 2,5 i tak nikt nie wejdzie wysoko, a skala od zera spłaszczyłaby różnice */
const SKALA_OD = 2.5;
const SKALA_DO = 5;

const ocenaTekstem = (n: number) => n.toFixed(1).replace(".", ",");
const wynikTekstem = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Tabela rankingu pod podium (propozycja 02): miejsce, boisko, ocena z gwiazdkami, liczba
 * opinii i wynik ważony z paskiem. Filtr województw liczy miejsca od nowa w regionie.
 *
 * W „Cała Polska” tabela zaczyna od czwartego miejsca - pierwsze trzy stoją na podium nad nią.
 * W województwie pokazuje wszystkie jego boiska, także te z podium, bo tam kolejność jest inna.
 */
export function TabelaRankingu({ boiska }: { boiska: Court[] }) {
  const [wybrane, setWybrane] = useState(CALA_POLSKA);

  const regiony = [...new Set(boiska.map((b) => b.voivodeship))].sort((a, b) => a.localeCompare(b, "pl"));
  const calaPolska = wybrane === CALA_POLSKA;
  const lista = calaPolska ? boiska.slice(3) : boiska.filter((b) => b.voivodeship === wybrane);
  const przesuniecie = calaPolska ? 3 : 0;

  if (calaPolska && boiska.length <= 3 && regiony.length < 2) return null;

  return (
    <section className="rk-tabela" aria-label="Cały ranking">
      <div className="rk-chipy" role="group" aria-label="Województwo">
        {[CALA_POLSKA, ...regiony].map((w) => (
          <button key={w} type="button" className="rk-chip" aria-pressed={w === wybrane} onClick={() => setWybrane(w)}>
            {w}
            {w !== CALA_POLSKA && <b>{boiska.filter((b) => b.voivodeship === w).length}</b>}
          </button>
        ))}
      </div>

      <div className="rk-tab">
        <div className="rk-tab-glowa" aria-hidden>
          <span>#</span>
          <span>Boisko</span>
          <span className="rk-pc">Ocena</span>
          <span className="rk-pc">Opinie</span>
          <span className="rk-pc">Wynik w rankingu</span>
        </div>

        {lista.map((b, i) => {
          const srednia = b.opinie?.srednia ?? null;
          const liczba = b.opinie?.liczba ?? 0;
          const wynik = b.rankingWynik ?? srednia ?? 0;
          const pas = Math.max(0, Math.min(1, (wynik - SKALA_OD) / (SKALA_DO - SKALA_OD)));
          return (
            <Link key={b.id} href={`/boisko/${b.slug}`} className="rk-w">
              <span className="rk-w-nr font-display">{i + 1 + przesuniecie}</span>
              <span className="rk-w-boisko">
                <span className="rk-w-foto">
                  <CourtPhoto photo={b.photos[0]} seed={b.seed} sizes="44px" />
                </span>
                <span className="min-w-0">
                  <b>{b.name}</b>
                  <small>{b.city}</small>
                </span>
              </span>
              <span className="rk-w-ocena rk-pc">
                {srednia !== null && <Gwiazdki ocena={srednia} />}
                <b>{srednia !== null ? ocenaTekstem(srednia) : "–"}</b>
              </span>
              <span className="rk-w-opinie rk-pc">{liczba}</span>
              <span className="rk-w-wynik rk-pc">
                <b className="font-display">{wynikTekstem(wynik)}</b>
                <span className="rk-pas">
                  <i style={{ width: `${pas * 100}%` }} />
                </span>
              </span>
              {/* telefon: zamiast trzech kolumn sama ocena i liczba opinii */}
              <span className="rk-w-tel">
                <b>
                  <Gwiazdka /> {srednia !== null ? ocenaTekstem(srednia) : "–"}
                </b>
                <span>
                  {liczba} {plural(liczba, ["opinia", "opinie", "opinii"])}
                </span>
              </span>
            </Link>
          );
        })}

        {lista.length === 0 && <p className="rk-pusto">W tym województwie żadne boisko nie ma jeszcze 10 opinii.</p>}
      </div>
    </section>
  );
}

function Gwiazdka() {
  return (
    <svg viewBox="0 0 24 24" className="h-[0.9em] w-[0.9em]" fill="currentColor" aria-hidden>
      <path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
    </svg>
  );
}

function Gwiazdki({ ocena }: { ocena: number }) {
  const pelne = Math.round(ocena);
  return (
    <span className="rk-gwiazdki" aria-label={`${ocenaTekstem(ocena)} na 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-[11px] w-[11px]" fill={n <= pelne ? "currentColor" : "none"} stroke="currentColor" strokeWidth={n <= pelne ? 0 : 1.6} style={{ opacity: n <= pelne ? 1 : 0.35 }} aria-hidden>
          <path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
        </svg>
      ))}
    </span>
  );
}
