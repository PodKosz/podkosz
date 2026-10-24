"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bywalcyBoiska, type Bywalec } from "@/lib/krol";
import { Arkusz } from "./Arkusz";
import { AwatarGracza, IkKorona } from "./NaBoisku";

/**
 * Król Boiska na zdjęciu tytułowym: awatar z koroną i nick. Dotknięcie otwiera arkusz
 * z rankingiem bywalców i zasadami. Kiedy nikt jeszcze nie zbierał punktów, ten sam
 * znaczek mówi „Korona wolna” - to też zaproszenie.
 *
 * Ranking liczy baza (`krol_boiska`): ostatnie 30 dni, 1 pkt za dzień obecności
 * potwierdzonej GPS-em i 1 pkt za props od innego gracza, najwyżej 3 dziennie.
 */
export function KrolBoiska({ courtId }: { courtId: string }) {
  const [bywalcy, setBywalcy] = useState<Bywalec[] | null>(null);
  const [otwarty, setOtwarty] = useState(false);

  useEffect(() => {
    let zywy = true;
    bywalcyBoiska(courtId, 10)
      .catch(() => [])
      .then((b) => zywy && setBywalcy(b));
    return () => {
      zywy = false;
    };
  }, [courtId]);

  /* do odpowiedzi bazy nic nie rysujemy - znaczek nie mruga „wolną” koroną przed królem */
  if (bywalcy === null) return null;
  const krol = bywalcy[0];

  return (
    <>
      <button type="button" className="kb-krol" onClick={() => setOtwarty(true)}>
        {krol ? (
          <>
            <AwatarGracza nick={krol.nick} avatar={krol.avatar} rozmiar={24} krol />
            <span>
              <small>Król boiska</small> @{krol.nick}
            </span>
          </>
        ) : (
          <>
            <IkKorona className="h-[18px] w-[18px]" />
            <span>Korona wolna</span>
          </>
        )}
      </button>

      {otwarty && (
        <Arkusz tytul="Król Boiska" onZamknij={() => setOtwarty(false)}>
          {krol ? (
            <ol className="mt-2">
              {bywalcy.map((b, i) => (
                <li key={b.id} className="kb-krol-wiersz">
                  <span className="kb-krol-nr font-display">{i + 1}</span>
                  <AwatarGracza nick={b.nick} avatar={b.avatar} rozmiar={36} krol={i === 0} />
                  <span className="min-w-0 flex-1">
                    {b.slug ? (
                      <Link href={`/gracz/${b.slug}`} className="block truncate text-[15px] font-semibold">
                        @{b.nick}
                      </Link>
                    ) : (
                      <b className="block truncate text-[15px]">@{b.nick}</b>
                    )}
                    <small className="block text-[12px] text-faint">
                      {b.dni} {b.dni === 1 ? "dzień" : "dni"} · {b.propsy} {b.propsy === 1 ? "props" : b.propsy < 5 && b.propsy > 1 ? "propsy" : "propsów"}
                    </small>
                  </span>
                  <b className="font-display text-[22px] font-normal tabular-nums">{b.punkty}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Nikt jeszcze nie zbierał tu punktów. Zamelduj się na boisku, a korona będzie Twoja.
            </p>
          )}
          <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
            Punkty z ostatnich 30 dni: 1 za każdy dzień na boisku potwierdzony lokalizacją i 1 za props od innego gracza,
            z którym byłeś na boisku w tym samym czasie (najwyżej 3 dziennie). W rankingu są tylko osoby, które pozwoliły
            pokazywać się innym na boisku.
          </p>
        </Arkusz>
      )}
    </>
  );
}
