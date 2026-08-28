"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { plural } from "@/lib/site";

/**
 * Ilu ludzi jest na stronie w tej chwili - tylko dla administratora.
 *
 * Liczba bierze się z pulsu: każda otwarta i widoczna karta odzywa się co czterdzieści
 * pięć sekund, a baza liczy tych, którzy odezwali się w ostatnich dwóch minutach. To nie
 * to samo, co licznik wizyt - ten mówi „ilu było dziś", a ten „ilu patrzy teraz".
 *
 * Odpytujemy co piętnaście sekund. Częściej nie ma sensu, bo sam puls idzie rzadziej,
 * a rzadziej - licznik przestaje być „live".
 */
async function pobierz(): Promise<number | null> {
  const supabase = await supabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("ilu_online");
  return error || typeof data !== "number" ? null : data;
}

export function LicznikOnline() {
  const [ilu, setIlu] = useState<number | null>(null);

  useEffect(() => {
    let aktualne = true;

    const odswiez = async () => {
      const n = await pobierz();
      if (aktualne) setIlu(n);
    };

    void odswiez();
    const zegar = window.setInterval(() => void odswiez(), 15_000);

    return () => {
      aktualne = false;
      window.clearInterval(zegar);
    };
  }, []);

  if (ilu === null) return null;

  return (
    <span className="szklo-pro inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px]">
      {/* kropka pulsuje tylko wtedy, gdy ktoś faktycznie jest - inaczej miga na pustkę */}
      <span className={`kropka-live ${ilu > 0 ? "kropka-live-zywa" : ""}`} />
      <b className="text-ink">{ilu}</b>
      <span className="text-muted">
        {plural(ilu, ["osoba na stronie", "osoby na stronie", "osób na stronie"])}
      </span>
    </span>
  );
}
