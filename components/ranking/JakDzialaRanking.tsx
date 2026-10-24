"use client";

import { useState } from "react";

/** „zapas zaufania” ze wzoru - musi być równy `m` w `ranking_przelicz()` (migration-ranking-ocen.sql) */
const M = 5;

const zPrzecinkiem = (n: number, miejsca = 1) => n.toFixed(miejsca).replace(".", ",");
const wynik = (v: number, r: number, c: number) => (v * r + M * c) / (v + M);

/**
 * „Jak działa ranking” - na samym dole strony rankingu.
 *
 * Trzy zasady z dużymi numerami, przykład, który pokazuje sens średniej ważonej (trzy piątki
 * kontra tysiąc ocen po 4,5), suwaki „sprawdź sam” i na końcu wzór dla dociekliwych.
 * Średnia serwisu (C) przychodzi z serwera - ta sama, którą liczy baza.
 */
export function JakDzialaRanking({ sredniaSerwisu, prog }: { sredniaSerwisu: number; prog: number }) {
  const c = sredniaSerwisu;
  const [srednia, setSrednia] = useState(5);
  const [liczba, setLiczba] = useState(prog);

  const a = { v: 3, r: 5 };
  const b = { v: 1000, r: 4.5 };
  const wA = wynik(a.v, a.r, c);
  const wB = wynik(b.v, b.r, c);

  return (
    <section className="rk-jak" aria-labelledby="rk-jak-tytul">
      <p className="rk-nad">Zasady</p>
      <h2 id="rk-jak-tytul">Jak działa ranking</h2>
      <p className="rk-jak-wstep">
        Kolejność ustalają oceny graczy, ale nie zwykła średnia. Zwykła średnia nagradzałaby przypadek: jedna
        piątka od kolegi dałaby boisku pierwsze miejsce. Dlatego liczy się też to, ilu ludzi oceniło boisko.
      </p>

      <ol className="rk-jak-kroki">
        <li>
          <span className="font-display">01</span>
          <b>Gracze oceniają</b>
          <p>Każdy zalogowany gracz może raz ocenić boisko w skali od jednej do pięciu gwiazdek. Ocenę można potem zmienić.</p>
        </li>
        <li>
          <span className="font-display">02</span>
          <b>Liczba opinii ma wagę</b>
          <p>
            Każde boisko startuje tak, jakby miało {M} opinii na poziomie średniej całego serwisu ({zPrzecinkiem(c)}). Każda
            prawdziwa opinia przesuwa wynik w stronę jego własnej średniej - im więcej opinii, tym pewniejszy wynik.
          </p>
        </li>
        <li>
          <span className="font-display">03</span>
          <b>Próg {prog} opinii</b>
          <p>
            Do rankingu wchodzi boisko z co najmniej {prog} opiniami. Przy remisie wyżej jest boisko z większą liczbą opinii,
            a potem z większą liczbą polubień.
          </p>
        </li>
      </ol>

      <div className="rk-jak-przyklad">
        <div className={wA > wB ? "rk-jak-wygrywa" : ""}>
          <small>Boisko A</small>
          <p>
            {a.v} opinie <span>·</span> średnia {zPrzecinkiem(a.r)}
          </p>
          <b className="font-display">{zPrzecinkiem(wA, 2)}</b>
          <small>wynik w rankingu</small>
        </div>
        <span className="rk-jak-vs" aria-hidden>
          vs
        </span>
        <div className={wB >= wA ? "rk-jak-wygrywa" : ""}>
          <small>Boisko B</small>
          <p>
            {b.v} opinii <span>·</span> średnia {zPrzecinkiem(b.r)}
          </p>
          <b className="font-display">{zPrzecinkiem(wB, 2)}</b>
          <small>wynik w rankingu - wyżej</small>
        </div>
      </div>

      <div className="rk-jak-sym">
        <b className="rk-jak-sym-tytul">Sprawdź sam</b>
        <label>
          <span>
            Średnia ocen boiska <b>{zPrzecinkiem(srednia)}</b>
          </span>
          <input type="range" min={1} max={5} step={0.1} value={srednia} onChange={(e) => setSrednia(Number(e.target.value))} />
        </label>
        <label>
          <span>
            Liczba opinii <b>{liczba}</b>
          </span>
          <input type="range" min={prog} max={500} step={1} value={liczba} onChange={(e) => setLiczba(Number(e.target.value))} />
        </label>
        <div className="rk-jak-sym-wynik">
          <span>wynik w rankingu</span>
          <b className="font-display">{zPrzecinkiem(wynik(liczba, srednia, c), 2)}</b>
        </div>
      </div>

      <div className="rk-jak-wzor">
        <p className="font-display">wynik = (v · R + {M} · C) / (v + {M})</p>
        <p>
          v - liczba opinii boiska, R - jego średnia ocen, C - średnia wszystkich opinii w serwisie ({zPrzecinkiem(c, 2)}).
          Liczą się tylko widoczne opinie - ukryte przez moderację nie wchodzą do wyniku. Ranking odświeża się co kilka minut.
        </p>
      </div>
    </section>
  );
}
