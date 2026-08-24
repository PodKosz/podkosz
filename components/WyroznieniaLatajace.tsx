import { wyroznienia, type StatystykiGracza } from "@/lib/odznaczenia";
import { IkonaOdznaczenia } from "./IkonaOdznaczenia";

/**
 * Zdobyte wyróżnienia krążące wokół zdjęcia profilowego.
 *
 * Wyróżnienia są za jednorazowe wyczyny, więc zamiast leżeć w tabelce, unoszą się wokół
 * właściciela jak trofea. Pokazujemy wyłącznie zdobyte - pusty slot niczego by nie mówił,
 * a lista „czego jeszcze nie mam" ma własne miejsce niżej na stronie.
 *
 * Pozycja każdego wyróżnienia liczy się z jego miejsca w PEŁNEJ liście, nie wśród
 * zdobytych. Dzięki temu odznaka ma raz na zawsze swój kąt na orbicie: nowe wyróżnienie
 * po prostu zapala się w wolnym miejscu, zamiast przestawiać wszystkie pozostałe.
 * Rozrzut robi mnożnik ROZRZUT, więc sąsiedzi z listy lądują po przeciwnych stronach
 * orbity i przy kilku zdobytych nie kleją się w jedną kupkę.
 *
 * Dół orbity jest pusty z rozmysłem - tam stoi nick i data dołączenia.
 *
 * Komponent jest serwerowy: ruch, zatrzymanie pod kursorem i dymek to czysty CSS.
 */

/**
 * Rozrzut miejsc na orbicie. Mnożnik musi być względnie pierwszy z liczbą wyróżnień,
 * inaczej część miejsc zostałaby pusta, a inne zajęte dwa razy.
 */
const ROZRZUT = 7;

/** Łuk od lewej, przez górę, po prawą. Dół zostaje wolny dla nicku. */
const KAT_OD = 152;
const KAT_DO = 388;

/** Powtarzalna „losowość" z identyfikatora - to samo wyróżnienie zawsze dostaje to samo. */
function ziarno(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function WyroznieniaLatajace({ statystyki }: { statystyki: StatystykiGracza }) {
  const wszystkie = wyroznienia(statystyki);
  const sloty = wszystkie.length;
  const zdobyte = wszystkie
    .map((w, i) => ({ w, slot: (i * ROZRZUT) % sloty }))
    .filter((o) => o.w.zdobyte);

  if (!zdobyte.length) return null;

  return (
    <div className="latacze pointer-events-none absolute left-1/2 top-1/2 z-10 h-[300px] w-[520px] -translate-x-1/2 -translate-y-1/2">
      {zdobyte.map(({ w, slot }) => {
        const z = ziarno(w.id);
        const kat = ((KAT_OD + ((KAT_DO - KAT_OD) * slot) / sloty) * Math.PI) / 180;

        /*
          Dwa pierścienie na przemian. Szesnaście miejsc na łuku dzieli od siebie niecałe
          15 stopni, a to przy jednym promieniu daje jakieś 43 px między środkami - mniej,
          niż odznaka ma szerokości, więc sąsiedzi na siebie wchodzili. Naprzemienny promień
          rozsuwa ich o kilkadziesiąt pikseli w głąb, zamiast rozpychać całą orbitę.
        */
        const blizej = slot % 2 === 1;
        const rx = (blizej ? 148 : 200) + (z - 0.5) * 22;
        const ry = (blizej ? 92 : 128) + (ziarno(`${w.id}-y`) - 0.5) * 18;

        const x = Math.round(Math.cos(kat) * rx);
        const y = Math.round(Math.sin(kat) * ry);

        return (
          <span
            key={w.id}
            className={`latacz pointer-events-auto barwa-${w.barwa}`}
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
          >
            <span
              className="latacz-ruch"
              style={{
                ["--dur" as string]: `${(7 + z * 6).toFixed(1)}s`,
                ["--opoz" as string]: `-${(z * 9).toFixed(1)}s`,
                ["--tor" as string]: `lot-${["a", "b", "c"][slot % 3]}`,
              }}
            >
              <span className="latacz-kula">
                <IkonaOdznaczenia id={w.id} className="h-[19px] w-[19px]" />
              </span>
            </span>

            {/* dymek otwiera się w dół, tak jak przy odznaczeniach - nad orbitą nie ma miejsca */}
            <span className="dymek latacz-dymek pointer-events-none left-1/2 top-full z-30 mt-2 w-max max-w-[220px] -translate-x-1/2 scale-95 px-4 py-3 text-left opacity-0">
              <span className="block text-[13px] font-semibold leading-tight">{w.nazwa}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-muted">{w.opis}</span>
              <span
                className="mt-1.5 block text-[11px] uppercase tracking-[0.12em]"
                style={{ color: "rgb(var(--b))" }}
              >
                wyróżnienie zdobyte
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
